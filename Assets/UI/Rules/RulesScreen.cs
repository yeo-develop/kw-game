using System;
using System.Collections.Generic;
using KwGame.Sim;
using UnityEngine.UIElements;

namespace KwGame.View
{
    /// UXML owns the layout; this binding only supplies game values and tab navigation.
    public sealed class RulesScreen : IDisposable
    {
        public VisualElement View { get; }
        public bool ContinueRequested { get; private set; }

        readonly Button start;
        readonly Button[] tabs;
        readonly VisualElement[] pages;
        readonly Action[] selectTab;

        public RulesScreen(VisualTreeAsset layout, Rules rules, IEnumerable<string> fullRules)
        {
            View = layout.CloneTree();
            View.AddToClassList("rules-host");
            View.Q<Label>("startingDebt").text = rules.DEBT0.ToString("N0") + "원";
            View.Q<Label>("interestRate").text = (rules.RT_RATE * 100).ToString("0.#") + "%";
            View.Q<Label>("dayHours").text = $"{rules.RT_DAY0 / 60:00}:00 ~ 24:00";
            View.Q<Label>("actionHours").text = $"알바 {rules.RT_WORK / 60f:0.#}시간 · 다른 행동 {rules.RT_ACT / 60f:0.#}시간";
            View.Q<Label>("paydayWarning").text = $"한 달은 {rules.MONTH_DAYS}일 · {rules.MONTH_DAYS}일째 밤 이자 납부";

            var details = View.Q("fullRulesBody");
            foreach (var text in fullRules)
            {
                var label = new Label(text) { enableRichText = true };
                label.AddToClassList("rules-detail");
                details.Add(label);
            }

            tabs = new[] { View.Q<Button>("basicTab"), View.Q<Button>("moneyTab"), View.Q<Button>("healthTab"), View.Q<Button>("fullTab") };
            pages = new[] { View.Q("basicPage"), View.Q("moneyPage"), View.Q("healthPage"), View.Q("fullPage") };
            selectTab = new Action[tabs.Length];
            for (int i = 0; i < tabs.Length; i++)
            {
                int index = i;
                selectTab[i] = () => SelectTab(index);
                tabs[i].clicked += selectTab[i];
            }
            start = View.Q<Button>("startButton");
            start.clicked += Continue;
            View.RegisterCallback<GeometryChangedEvent>(Resize);
            SelectTab(0);
        }

        public void Continue() => ContinueRequested = true;

        void SelectTab(int index)
        {
            for (int i = 0; i < tabs.Length; i++)
            {
                tabs[i].EnableInClassList("rules-tab-selected", i == index);
                pages[i].EnableInClassList("rules-hidden", i != index);
            }
        }

        void Resize(GeometryChangedEvent evt)
        {
            View.EnableInClassList("rules-compact", evt.newRect.width < 1400 || evt.newRect.height < 900);
            View.EnableInClassList("rules-narrow", evt.newRect.width < 900);
        }

        public void Dispose()
        {
            start.clicked -= Continue;
            for (int i = 0; i < tabs.Length; i++) tabs[i].clicked -= selectTab[i];
            View.UnregisterCallback<GeometryChangedEvent>(Resize);
            View.RemoveFromHierarchy();
        }
    }
}
