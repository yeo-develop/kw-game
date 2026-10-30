using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.View
{
    public partial class GameController
    {
        WorkScreen workScreen;

        void ShowWorkSelection()
        {
            workScreen = new WorkScreen(Resources.Load<VisualTreeAsset>("UI/Work/WorkScreen"), D, G,
                id => Send("act", "k", "l-" + id), () => Send("leave"));
            root.Insert(root.IndexOf(modal), workScreen.View);
        }

        void CloseWorkSelection()
        {
            workScreen?.Dispose();
            workScreen = null;
        }
    }
}
