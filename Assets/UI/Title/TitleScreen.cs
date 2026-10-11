using DG.Tweening;
using Febucci.TextAnimatorForUnity;
using KwGame.View;
using KwGame.Persistence;
using Sirenix.OdinInspector;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UIElements;

namespace KwGame.Title
{
    [RequireComponent(typeof(UIDocument))]
    public sealed class TitleScreen : MonoBehaviour
    {
        [SerializeField, Required, AssetsOnly, Title("타이틀 UI")]
        private VisualTreeAsset layout;
        [SerializeField]
        private string gameScene = "Main";

        private const string VolumeKey = "kw.title.volume";
        private VisualElement root, content, overlay, dialog, settingsBody;
        private Button continueButton, newGameButton, settingsButton, quitButton, apiButton;
        private Button confirmButton, cancelButton, returnFocus;
        private Label dialogTitle, dialogMessage, loadingLabel;
        private Slider volumeSlider;
        private Toggle fullscreenToggle;
        private AnimatedLabel story;
        private Tween entranceTween, dialogTween, launchTween;
        private bool launching, confirmingQuit, confirmingNewGame;
        private string saveStatus;

        [ShowInInspector, ReadOnly]
        private string SaveStatus => saveStatus;

        private void OnEnable()
        {
            launching = false;
            confirmingQuit = false;
            confirmingNewGame = false;
            var document = GetComponent<UIDocument>();
            document.visualTreeAsset = layout;
            root = document.rootVisualElement.Q("titleRoot");
            content = root.Q("titleContent");
            overlay = root.Q("dialogOverlay");
            dialog = root.Q("dialogPanel");
            settingsBody = root.Q("settingsBody");
            continueButton = root.Q<Button>("continueButton");
            newGameButton = root.Q<Button>("newGameButton");
            settingsButton = root.Q<Button>("settingsButton");
            quitButton = root.Q<Button>("quitButton");
            apiButton = root.Q<Button>("apiStatusButton");
            confirmButton = root.Q<Button>("dialogConfirmButton");
            cancelButton = root.Q<Button>("dialogCancelButton");
            dialogTitle = root.Q<Label>("dialogTitle");
            dialogMessage = root.Q<Label>("dialogMessage");
            loadingLabel = root.Q<Label>("loadingLabel");
            volumeSlider = root.Q<Slider>("volumeSlider");
            fullscreenToggle = root.Q<Toggle>("fullscreenToggle");

            RefreshSaveStatus();
            continueButton.clicked += ContinueGame;
            newGameButton.clicked += StartGame;
            settingsButton.clicked += ShowSettings;
            apiButton.clicked += ShowApiSettings;
            quitButton.clicked += ShowQuit;
            confirmButton.clicked += ConfirmDialog;
            cancelButton.clicked += CloseDialog;
            volumeSlider.RegisterValueChangedCallback(ChangeVolume);
            fullscreenToggle.RegisterValueChangedCallback(ChangeFullscreen);
            root.RegisterCallback<KeyDownEvent>(HandleKey, TrickleDown.TrickleDown);
            root.RegisterCallback<NavigationMoveEvent>(BlockSettingsTabNavigation, TrickleDown.TrickleDown);
            root.RegisterCallback<GeometryChangedEvent>(ResizeLayout);

            AudioListener.volume = PlayerPrefs.GetFloat(VolumeKey, AudioListener.volume);
            story = new AnimatedLabel();
            story.AddToClassList("story-text");
            var hook = root.Q("storyHook");
            hook.Clear();
            hook.Add(story);
            story.Typewriter.ShowText("D+1. 첫 데이트 귀갓길, 여자친구 폰에 증거금 부족 경고가 떴다.");

            content.style.opacity = 0;
            entranceTween = Fade(content, 1, 0.45f);
            root.schedule.Execute(() => (continueButton.enabledSelf ? continueButton : newGameButton).Focus());
        }

        private void Update()
        {
            story?.Typewriter?.UpdateTypewriter();
        }

        private void OnDisable()
        {
            entranceTween?.Kill();
            dialogTween?.Kill();
            launchTween?.Kill();
            story?.Typewriter?.StopShowingText();
            story?.PauseAnimation();
            if (root == null) return;
            continueButton.clicked -= ContinueGame;
            newGameButton.clicked -= StartGame;
            settingsButton.clicked -= ShowSettings;
            apiButton.clicked -= ShowApiSettings;
            quitButton.clicked -= ShowQuit;
            confirmButton.clicked -= ConfirmDialog;
            cancelButton.clicked -= CloseDialog;
            volumeSlider.UnregisterValueChangedCallback(ChangeVolume);
            fullscreenToggle.UnregisterValueChangedCallback(ChangeFullscreen);
            root.UnregisterCallback<KeyDownEvent>(HandleKey, TrickleDown.TrickleDown);
            root.UnregisterCallback<NavigationMoveEvent>(BlockSettingsTabNavigation, TrickleDown.TrickleDown);
            root.UnregisterCallback<GeometryChangedEvent>(ResizeLayout);
        }

        private Tween Fade(VisualElement target, float value, float duration)
        {
            return DOTween.To(() => target.resolvedStyle.opacity,
                    opacity => target.style.opacity = opacity, value, duration)
                .SetTarget(target).SetUpdate(true).SetLink(gameObject);
        }

        private void ResizeLayout(GeometryChangedEvent evt)
        {
            root.EnableInClassList("short", evt.newRect.height < 1000);
            root.EnableInClassList("narrow", evt.newRect.width / Mathf.Max(1, evt.newRect.height) < 1.5f);
        }

        private void RefreshSaveStatus()
        {
            bool available = SaveStore.Default.TryLoad(out var saved, out var error);
            if (available) available = SaveStore.IsCompatible(saved.State, GameController.LoadData(), out error);
            saveStatus = available ? saved.Summary : error ?? "저장 데이터 없음";
            continueButton.SetEnabled(available);
            continueButton.Q<Label>(className: "menu-detail").text = available ? saved.Summary : error == null ? "저장 데이터 없음" : "저장 파일 확인 필요";
            continueButton.tooltip = saveStatus;
        }

        [Button("새로 시작"), DisableInEditorMode]
        public void StartGame()
        {
            if (launching) return;
            if (SaveStore.Default.HasFiles)
            {
                OpenDialog("새 게임을 시작할까요?", "다음 자동 저장부터 기존 진행 상황이 교체됩니다.", false, newGameButton);
                confirmingNewGame = true;
                confirmButton.text = "새로 시작";
                cancelButton.RemoveFromClassList("hidden");
                cancelButton.Focus();
                return;
            }
            LaunchGame(null);
        }

        private void ContinueGame()
        {
            if (launching) return;
            if (!SaveStore.Default.TryLoad(out var saved, out var error) ||
                !SaveStore.IsCompatible(saved.State, GameController.LoadData(), out error))
            {
                RefreshSaveStatus();
                OpenDialog("불러오지 못했습니다", error ?? "저장 데이터가 없습니다.", false, continueButton);
                return;
            }
            LaunchGame(saved.State);
        }

        private void LaunchGame(KwGame.Sim.GameState saved)
        {
            if (!Application.CanStreamedLevelBeLoaded(gameScene))
            {
                OpenDialog("게임을 시작할 수 없습니다", "Main 씬이 빌드 목록에 없습니다.", false, newGameButton);
                return;
            }
            overlay.AddToClassList("hidden");
            launching = true;
            content.SetEnabled(false);
            apiButton.SetEnabled(false);
            loadingLabel.RemoveFromClassList("hidden");
            entranceTween?.Kill();
            story.Typewriter.SkipTypewriter();
            launchTween = Fade(root, 0, 0.25f).OnComplete(() =>
            {
                if (saved == null) TitleStartup.RequestNewGame();
                else TitleStartup.RequestContinue(saved);
                SceneManager.LoadScene(gameScene);
            });
        }

        [Button("설정 열기"), DisableInEditorMode]
        public void ShowSettings() => OpenSettings(settingsButton);

        private void ShowApiSettings() => OpenSettings(apiButton);

        private void OpenSettings(Button owner)
        {
            volumeSlider.SetValueWithoutNotify(AudioListener.volume);
            fullscreenToggle.SetValueWithoutNotify(Screen.fullScreen);
            OpenDialog("설정", "플레이 환경을 설정하세요.", true, owner);
        }

        private void ShowQuit()
        {
            confirmingQuit = true;
            OpenDialog("게임을 종료할까요?", "종료하면 타이틀 화면을 닫습니다.", false, quitButton);
            confirmButton.text = "종료";
            cancelButton.RemoveFromClassList("hidden");
            cancelButton.Focus();
        }

        private void OpenDialog(string title, string message, bool settings, Button owner)
        {
            if (launching) return;
            if (owner != quitButton) confirmingQuit = false;
            confirmingNewGame = false;
            returnFocus = owner;
            dialogTitle.text = title;
            dialogMessage.text = message;
            settingsBody.EnableInClassList("hidden", !settings);
            cancelButton.AddToClassList("hidden");
            confirmButton.text = "닫기";
            overlay.RemoveFromClassList("hidden");
            content.SetEnabled(false);
            apiButton.SetEnabled(false);
            dialogTween?.Kill();
            dialog.style.opacity = 0;
            dialogTween = Fade(dialog, 1, 0.18f);
            confirmButton.Focus();
        }

        private void ConfirmDialog()
        {
            if (confirmingNewGame) { LaunchGame(null); return; }
            if (!confirmingQuit) { CloseDialog(); return; }
#if UNITY_EDITOR
            UnityEditor.EditorApplication.isPlaying = false;
#else
            Application.Quit();
#endif
        }

        private void CloseDialog()
        {
            dialogTween?.Kill();
            overlay.AddToClassList("hidden");
            content.SetEnabled(true);
            apiButton.SetEnabled(true);
            confirmingQuit = false;
            confirmingNewGame = false;
            var focus = returnFocus;
            root.schedule.Execute(() => focus?.Focus());
        }

        private void ChangeVolume(ChangeEvent<float> evt)
        {
            AudioListener.volume = evt.newValue;
            PlayerPrefs.SetFloat(VolumeKey, evt.newValue);
            PlayerPrefs.Save();
        }

        private void ChangeFullscreen(ChangeEvent<bool> evt)
        {
            Screen.fullScreen = evt.newValue;
        }

        private void BlockSettingsTabNavigation(NavigationMoveEvent evt)
        {
            if (overlay.ClassListContains("hidden") || settingsBody.ClassListContains("hidden")) return;
            if (evt.direction != NavigationMoveEvent.Direction.Next && evt.direction != NavigationMoveEvent.Direction.Previous) return;
            evt.PreventDefault();
            evt.StopPropagation();
        }

        private void HandleKey(KeyDownEvent evt)
        {
            if (launching) return;
            if (evt.keyCode == KeyCode.Escape)
            {
                if (overlay.ClassListContains("hidden")) ShowQuit();
                else CloseDialog();
                evt.StopPropagation();
            }
            else if (!overlay.ClassListContains("hidden") && evt.keyCode == KeyCode.Tab)
            {
                if (!settingsBody.ClassListContains("hidden"))
                {
                    evt.PreventDefault();
                    evt.StopPropagation();
                    return;
                }
                VisualElement[] controls = confirmingQuit || confirmingNewGame
                    ? new VisualElement[] { cancelButton, confirmButton } : new VisualElement[] { confirmButton };
                var focused = root.panel.focusController.focusedElement;
                var index = System.Array.FindIndex(controls, control => control == focused);
                var offset = evt.shiftKey ? controls.Length - 1 : 1;
                controls[(index + offset + controls.Length) % controls.Length].Focus();
                evt.PreventDefault();
                evt.StopPropagation();
            }
        }
    }
}
