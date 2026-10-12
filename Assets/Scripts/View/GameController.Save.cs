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

        void RenderSaveControls()
        {
            saveControls.Clear();
            var buttons = Ui.Row();
            var save = Ui.Chip("저장", () => SaveCheckpoint(true), !CanSave);
            save.name = "saveGameButton";
            buttons.Add(save);
            var title = Ui.Chip("타이틀로", ReturnToTitle, playing);
            title.name = "returnToTitleButton";
            buttons.Add(title);
            saveControls.Add(buttons);
            var status = Ui.Label(saveMessage, 18, Ui.Dim);
            status.name = "saveStatus";
            status.style.marginTop = 8;
            saveControls.Add(status);
        }

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
