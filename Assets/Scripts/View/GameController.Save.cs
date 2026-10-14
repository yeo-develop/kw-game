using System.Linq;
using KwGame.Persistence;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UIElements;

namespace KwGame.View
{
    public partial class GameController
    {
        VisualElement saveControls;
        string saveMessage = "선택 완료 후 자동 저장";
        bool CanSave => G != null && !playing && S.pending != null && S.pending.t != "start";

        /// 대사창 아래 퀵메뉴 (문예부식): 집 행동 · 폰 · 저장 · 타이틀 · 시간 속도
        void RenderSaveControls()
        {
            saveControls.Clear();
            if (G == null || S.pending?.t == "start") return;
            bool home = S.pending?.t == "home" && !playing;
            Button Q(string text, System.Action a, bool dis = false, Color? bg = null)
            {
                var b = Ui.Chip(text, a, dis, bg ?? new Color(1, 1, 1, 0.06f)); b.style.flexShrink = 0; b.Q<Label>().style.whiteSpace = WhiteSpace.NoWrap;
                saveControls.Add(b); return b;
            }
            Q("외출", () => Send("map"), !home);
            Q(G.isEve() ? "자기" : "쉬기", () => Send("rest"), !home).tooltip = (S.rt ? (G.isEve() ? "자정까지 잠 · " : $"{D.RULES.RT_REST / 60}시간 · ") : "") + (S.rt ? $"체력 +{(G.isEve() ? D.RULES.RT_HP_REST_EVE + D.RULES.RT_HP_SLEEP : D.RULES.RT_HP_REST)} · 멘탈 {D.RULES.RT_REST_ST:0}" : $"체력 +{(G.isEve() ? D.RULES.HP_REST_EVE : D.RULES.HP_REST)} · 스트레스 −22");
            Q("빚 갚기", () => Send("repayOpen"), !home || S.cash < 10000 || S.debt <= 0, home && S.cash >= 10000 && S.debt > 0 ? new Color(0.16f, 0.36f, 0.24f, 1f) : (Color?)null).tooltip = $"남은 빚 {G.won(S.debt)} · 김사장 계좌로 바로 이체 (시간 안 씀)";
            Q("김사장 대출", () => Send("loanOpen"), !home).tooltip = $"선이자 {G.loanFee() * 100:0}% · 한도 {G.man(G.loanCap())}";
            int unread = G.kUnread();
            Q(phoneOpen ? "폰 닫기 (P)" : $"폰 (P){(unread > 0 ? $" · {unread}" : "")}", TogglePhone, false, phoneOpen ? Ui.Accent : (Color?)null);
            var sp = new VisualElement(); sp.style.flexGrow = 1; saveControls.Add(sp);
            var status = Ui.Label(saveMessage, 16, Ui.Dim); status.name = "saveStatus"; status.style.marginRight = 10; status.style.whiteSpace = WhiteSpace.NoWrap; saveControls.Add(status);
            var save = Q("저장", () => SaveCheckpoint(true), !CanSave); save.name = "saveGameButton";
            var title = Q("타이틀", ReturnToTitle, playing); title.name = "returnToTitleButton";
        }
        static bool GameController_PhoneOk(string t) => PHONE_OK.Contains(t);

        public bool SaveCheckpoint(bool notify)
        {
            if (!CanSave) return false;
            bool success = SaveStore.Default.TrySave(S, out var error);
            saveMessage = success ? $"저장 완료 · {System.DateTime.Now:HH:mm}" : error;
            if (notify || !success) Toast(saveMessage, success ? "good" : "liq");
            if (notify) RenderSaveControls();
            return success;
        }

        public void ReturnToTitle()
        {
            if (playing) return;
            if (!Application.CanStreamedLevelBeLoaded("Title"))
            {
                Toast("Title 씬이 빌드 목록에 없습니다.", "liq");
                return;
            }
            if (CanSave && !SaveCheckpoint(true)) return;
            SceneManager.LoadScene("Title");
        }

        void OnApplicationPause(bool paused)
        {
            if (paused) SaveCheckpoint(false);
        }

        void OnApplicationQuit() => SaveCheckpoint(false);
    }
}
