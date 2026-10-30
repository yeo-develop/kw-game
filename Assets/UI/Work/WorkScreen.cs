using System;
using System.Linq;
using KwGame.Sim;
using UnityEngine.UIElements;

namespace KwGame.View
{
    public sealed class WorkScreen : IDisposable
    {
        static readonly string[] JobIds = { "cafe", "store", "ware", "mart" };

        public VisualElement View { get; }
        public string SelectedId { get; private set; } = "cafe";
        readonly GameData data;
        readonly GameSim game;
        readonly Action<string> confirm;
        readonly Action leave;
        readonly Button[] cards;
        readonly Action[] selections;
        readonly Button start, back, close;
        bool submitted;

        public WorkScreen(VisualTreeAsset layout, GameData data, GameSim game, Action<string> confirm, Action leave)
        {
            this.data = data; this.game = game; this.confirm = confirm; this.leave = leave;
            View = layout.CloneTree();
            View.AddToClassList("work-host");
            cards = JobIds.Select(id => View.Q<Button>(id + "Card")).ToArray();
            selections = new Action[cards.Length];
            for (int i = 0; i < cards.Length; i++)
            {
                string id = JobIds[i];
                selections[i] = () => { SelectedId = id; Refresh(); };
                cards[i].clicked += selections[i];
                View.Q<Label>(id + "Title").text = data.JOBS[id].name;
            }
            start = View.Q<Button>("startButton"); back = View.Q<Button>("backButton");
            close = View.Q<Button>("closeButton");
            start.clicked += Confirm;
            back.clicked += Leave;
            close.clicked += Leave;
            View.RegisterCallback<GeometryChangedEvent>(Resize);
            Refresh();
        }

        string PayRange(Job job)
        {
            double multiplier = game.has("grind") ? data.RULES.GRIND_PAY : 1;
            return $"{MathK.Round1k(game.jobPay(job, 0) * multiplier):N0} ~ {MathK.Round1k(game.jobPay(job, 1) * multiplier):N0}원";
        }

        public void Refresh()
        {
            var state = game.S;
            View.Q<Label>("dateLabel").text = $"{state.month}개월 {state.day}일";
            View.Q<Label>("clockLabel").text = game.clockNow();
            View.Q<Label>("cashLabel").text = $"현금  {state.cash:N0}원";
            View.Q<Label>("hpLabel").text = $"체력  {state.hp:0.#}";
            View.Q<Label>("dueLabel").text = state.paidMonth == state.month ? "이번 달 이자 납부 완료" : $"이자 납부 D-{data.RULES.MONTH_DAYS - state.day}";
            string duration = state.rt ? $"{data.RULES.RT_WORK / 60f:0.#}시간" : "1칸";
            View.Q<Label>("durationBadge").text = duration + " 소요";

            var options = game.Query(() => game.locOpts("work"));
            for (int i = 0; i < cards.Length; i++)
            {
                string id = JobIds[i]; var job = data.JOBS[id];
                bool selected = id == SelectedId;
                cards[i].EnableInClassList("work-card-selected", selected);
                cards[i].SetEnabled(!submitted && options.Any(o => o.k == "l-" + id && !o.dis));
                View.Q<Label>(id + "Pay").text = PayRange(job);
                View.Q<Label>(id + "Hp").text = $"체력 −{game.jobHp(job):0.#}";
                View.Q<Label>(id + "Check").text = selected ? "선택됨" : "";
            }

            var selectedJob = data.JOBS[SelectedId];
            double remainingHp = Math.Max(0, state.hp - game.jobHp(selectedJob));
            bool faintRisk = state.hp <= game.jobHp(selectedJob);
            View.Q<Label>("hpPreview").text = $"{state.hp:0.#} → {remainingHp:0.#}";
            int end = state.min + data.RULES.RT_WORK;
            View.Q<Label>("timePreview").text = !state.rt ? "이번 시간대 사용" : end >= 1440 ? $"다음 날 {GameSim.clockOf(data.RULES.RT_DAY0 + end - 1440)}" : $"{game.clockNow()} → {end / 60:00}:{end % 60:00}";
            var warning = View.Q<Label>("conditionHint");
            warning.text = faintRisk ? "기절 위험! 알바 후 체력이 0이 됩니다. 휴식을 권해요." : state.workStreak > 0 ? "연속 알바는 멘탈 부담을 늘려요. 쉬는 시간도 챙기세요." : "일당은 성과에 따라 달라져요. 선택 후 조작법을 안내해요.";
            warning.EnableInClassList("work-danger", faintRisk);
            View.Q<Label>("hpPreview").tooltip = "알바 자체의 체력 소모만 반영한 예상치예요.";
            View.Q<Label>("timePreview").tooltip = "돌발 상황과 날짜 변경에 따라 달라질 수 있어요.";
            start.tooltip = selectedJob.name + " 선택 후 조작법을 확인합니다. 보유 유품 효과가 반영돼요.";
            start.SetEnabled(!submitted && options.Any(o => o.k == "l-" + SelectedId && !o.dis));
        }

        void Confirm()
        {
            if (submitted || !start.enabledSelf) return;
            submitted = true;
            View.SetEnabled(false);
            confirm(SelectedId);
        }

        void Leave()
        {
            if (submitted) return;
            submitted = true;
            leave();
        }

        void Resize(GeometryChangedEvent evt)
        {
            View.EnableInClassList("work-compact", evt.newRect.width < 1300 || evt.newRect.height < 900);
            View.EnableInClassList("work-narrow", evt.newRect.width < 850);
        }

        public void Dispose()
        {
            start.clicked -= Confirm; back.clicked -= Leave; close.clicked -= Leave;
            for (int i = 0; i < cards.Length; i++) cards[i].clicked -= selections[i];
            View.UnregisterCallback<GeometryChangedEvent>(Resize);
            View.RemoveFromHierarchy();
        }
    }
}
