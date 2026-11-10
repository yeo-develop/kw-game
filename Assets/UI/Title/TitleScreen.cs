using System.Linq;
using DG.Tweening;
using Febucci.TextAnimatorForUnity;
using KwGame.View;
using KwGame.Audio;
using KwGame.Persistence;
using KwGame.Sim;
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
        private const string DiffKey = "kw.title.diff";
        private static readonly string[] DiffIds = { "easy", "normal", "hard" };
        private static readonly string[] DiffNames = { "순한맛", "보통", "매운맛" };
        private VisualElement root, content, overlay, dialog, settingsBody, newGameBody;
        private ScrollView recordsBody;
        private VisualElement[] bodies;
        private Button continueButton, newGameButton, settingsButton, recordsButton, quitButton, apiButton;
        private Button confirmButton, cancelButton, returnFocus, dailyButton;
        private Button[] diffButtons;
        private Label dialogTitle, dialogMessage, loadingLabel, metaLabel, dailyNote, seedError, overwriteNote;
        private TextField seedField;
        private string selectedDiff = "normal";
        private int pendingSeed;
        private GameData data;
        private Slider volumeSlider, musicVolumeSlider, effectsVolumeSlider;
        private Toggle fullscreenToggle;
        private AnimatedLabel story;
        private Tween entranceTween, dialogTween, launchTween;
        private bool launching, confirmingQuit, confirmingNewGame;
        private string saveStatus;
        private Button[] soundButtons;

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
            newGameBody = root.Q("newGameBody");
            recordsBody = root.Q<ScrollView>("recordsBody");
            bodies = new[] { settingsBody, newGameBody, recordsBody };
            recordsButton = root.Q<Button>("recordsButton");
            dailyButton = root.Q<Button>("dailyButton");
            diffButtons = new[] { root.Q<Button>("diffEasyButton"), root.Q<Button>("diffNormalButton"), root.Q<Button>("diffHardButton") };
            metaLabel = root.Q<Label>("metaLabel");
            dailyNote = root.Q<Label>("dailyNote");
            seedError = root.Q<Label>("seedError");
            overwriteNote = root.Q<Label>("overwriteNote");
            seedField = root.Q<TextField>("seedField");
            selectedDiff = System.Array.IndexOf(DiffIds, PlayerPrefs.GetString(DiffKey, "normal")) >= 0 ? PlayerPrefs.GetString(DiffKey, "normal") : "normal";
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
            musicVolumeSlider = root.Q<Slider>("musicVolumeSlider");
            effectsVolumeSlider = root.Q<Slider>("effectsVolumeSlider");
            fullscreenToggle = root.Q<Toggle>("fullscreenToggle");

            // LLM API 키 버튼·설명은 개발 빌드(에디터 포함)에서만
            apiButton.style.display = Debug.isDebugBuild ? DisplayStyle.Flex : DisplayStyle.None;
            var apiInfo = root.Q(className: "api-information");
            if (apiInfo != null) apiInfo.style.display = Debug.isDebugBuild ? DisplayStyle.Flex : DisplayStyle.None;

            RefreshSaveStatus();
            RefreshMetaLabel();
            try { RefreshDiffLabels(); } catch (System.Exception) { }   // 데이터가 깨져도 타이틀은 열리게 (uxml 기본 문구 유지)
            soundButtons = new[] { continueButton, newGameButton, settingsButton, recordsButton, quitButton, apiButton, confirmButton, cancelButton, dailyButton };
            foreach (var button in soundButtons) button.clicked += PlayButtonSound;
            continueButton.clicked += ContinueGame;
            newGameButton.clicked += StartGame;
            settingsButton.clicked += ShowSettings;
            recordsButton.clicked += ShowRecords;
            dailyButton.clicked += FillDailySeed;
            foreach (var button in diffButtons) button.clicked += SelectDiffSound;
            diffButtons[0].clicked += SelectEasy;
            diffButtons[1].clicked += SelectNormal;
            diffButtons[2].clicked += SelectHard;
            seedField.RegisterValueChangedCallback(ChangeSeedText);
            apiButton.clicked += ShowApiSettings;
            quitButton.clicked += ShowQuit;
            confirmButton.clicked += ConfirmDialog;
            cancelButton.clicked += CloseDialog;
            volumeSlider.RegisterValueChangedCallback(ChangeVolume);
            musicVolumeSlider.RegisterValueChangedCallback(ChangeMusicVolume);
            effectsVolumeSlider.RegisterValueChangedCallback(ChangeEffectsVolume);
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
            foreach (var button in soundButtons) button.clicked -= PlayButtonSound;
            continueButton.clicked -= ContinueGame;
            newGameButton.clicked -= StartGame;
            settingsButton.clicked -= ShowSettings;
            recordsButton.clicked -= ShowRecords;
            dailyButton.clicked -= FillDailySeed;
            foreach (var button in diffButtons) button.clicked -= SelectDiffSound;
            diffButtons[0].clicked -= SelectEasy;
            diffButtons[1].clicked -= SelectNormal;
            diffButtons[2].clicked -= SelectHard;
            seedField.UnregisterValueChangedCallback(ChangeSeedText);
            apiButton.clicked -= ShowApiSettings;
            quitButton.clicked -= ShowQuit;
            confirmButton.clicked -= ConfirmDialog;
            cancelButton.clicked -= CloseDialog;
            volumeSlider.UnregisterValueChangedCallback(ChangeVolume);
            musicVolumeSlider.UnregisterValueChangedCallback(ChangeMusicVolume);
            effectsVolumeSlider.UnregisterValueChangedCallback(ChangeEffectsVolume);
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

        private static void PlayButtonSound() => KwGame.Audio.GameAudioManager.Play(KwGame.Audio.SoundCue.ButtonClick);

        private void ResizeLayout(GeometryChangedEvent evt)
        {
            root.EnableInClassList("short", evt.newRect.height < 1000);
            root.EnableInClassList("narrow", evt.newRect.width / Mathf.Max(1, evt.newRect.height) < 1.5f);
        }

        private void RefreshSaveStatus()
        {
            bool available = SaveStore.Default.TryLoad(out var saved, out var error);
            if (available) available = SaveStore.IsCompatible(saved.State, Data, out error);
            saveStatus = available ? saved.Summary : error ?? "저장 데이터 없음";
            continueButton.SetEnabled(available);
            continueButton.Q<Label>(className: "menu-detail").text = available ? saved.Summary : error == null ? "저장 데이터 없음" : "저장 파일 확인 필요";
            continueButton.tooltip = saveStatus;
        }

        private GameData Data => data ??= GameController.LoadData();

        /// 메인 메뉴 아래 작은 줄: 엔딩 n/N · 도전과제 n/N (한 판도 안 했으면 숨김)
        /// 난이도 버튼 이름·설명을 데이터(V4_STR v4.diff.* · V4_DIFF)에서 (uxml 의 숫자는 자리만)
        private void RefreshDiffLabels()
        {
            var rules = Data.RULES;
            for (int i = 0; i < DiffIds.Length; i++)
            {
                var b = diffButtons[i]; if (b == null) continue;
                string id = DiffIds[i];
                try { b.Q<Label>(className: "diff-label").text = Data.S("v4.diff." + id); } catch { }
                if (rules.V4_DIFF != null && rules.V4_DIFF.TryGetValue(id, out var m))
                {
                    double rate = m.TryGetValue("rate", out var r) ? r : rules.RT_RATE, cash = m.TryGetValue("cash", out var c) ? c : 1, duo = m.TryGetValue("duo", out var d) ? d : rules.V4_DUO_DEBT;
                    string extra = id == "normal" ? "기본" : cash > 1 ? "시작 현금 넉넉" : cash < 1 ? "시작 현금 적음" : "";
                    if (id != "normal" && duo < rules.V4_DUO_DEBT) extra += " · 못 갚았을 때 미래가 따라와 주는 조건이 빡빡함";
                    if (id != "normal" && duo > rules.V4_DUO_DEBT) extra += " · 못 갚았을 때 미래가 따라와 주는 조건이 느슨함";
                    b.Q<Label>(className: "diff-detail").text = $"이자 {rate * 100:0.#}% · {extra}";
                }
            }
        }

        private void RefreshMetaLabel()
        {
            var meta = MetaStore.Default.Load();
            bool show = meta != null && meta.runs > 0;
            metaLabel.EnableInClassList("hidden", !show);
            if (!show) return;
            metaLabel.text = $"엔딩 {meta.EndingCount}/{GameSim.EndingCatalog(Data).Count} · 도전과제 {meta.AchCount}/{GameSim.Achievements(Data).Count}";
        }

        // 스크린샷 데모(-kwShots <폴더>): 타이틀을 찍고 바로 게임 씬으로 (게임 씬이 나머지를 찍음)
        private System.Collections.IEnumerator Start()
        {
            var args = System.Environment.GetCommandLineArgs();
            int i = System.Array.IndexOf(args, "-kwShots");
            if (i < 0 || i + 1 >= args.Length) yield break;
            System.IO.Directory.CreateDirectory(args[i + 1]);
            yield return new WaitForSeconds(3f);
            yield return new WaitForEndOfFrame();
            ScreenCapture.CaptureScreenshot(System.IO.Path.Combine(args[i + 1], "00_title_scene.png"));
            yield return new WaitForSeconds(0.5f);
            SceneManager.LoadScene(gameScene);
        }

        [Button("새로 시작"), DisableInEditorMode]
        public void StartGame()
        {
            if (launching) return;
            OpenDialog("새로 시작", "난이도와 판 코드를 고르세요.", newGameBody, newGameButton);
            confirmingNewGame = true;
            confirmButton.text = "시작";
            cancelButton.RemoveFromClassList("hidden");
            overwriteNote.EnableInClassList("hidden", !SaveStore.Default.HasFiles);
            seedError.AddToClassList("hidden");
            dailyNote.EnableInClassList("hidden", seedField.value != DailyCode());
            RefreshDiffButtons();
            diffButtons[System.Array.IndexOf(DiffIds, selectedDiff)].Focus();
        }

        private static string DailyCode()
        {
            var now = System.DateTime.Now;
            return GameSim.SeedCode(GameSim.DailySeed(now.Year, now.Month, now.Day));
        }

        private void FillDailySeed()
        {
            seedField.value = DailyCode();
            dailyNote.RemoveFromClassList("hidden");
        }

        private void ChangeSeedText(ChangeEvent<string> evt)
        {
            seedError.AddToClassList("hidden");
            dailyNote.EnableInClassList("hidden", evt.newValue != DailyCode());
        }

        private static void SelectDiffSound() => GameAudioManager.Play(SoundCue.UiSelect);
        private void SelectEasy() => SelectDiff(0);
        private void SelectNormal() => SelectDiff(1);
        private void SelectHard() => SelectDiff(2);

        private void SelectDiff(int index)
        {
            selectedDiff = DiffIds[index];
            PlayerPrefs.SetString(DiffKey, selectedDiff);
            PlayerPrefs.Save();
            RefreshDiffButtons();
        }

        private void RefreshDiffButtons()
        {
            for (int i = 0; i < diffButtons.Length; i++) diffButtons[i].EnableInClassList("diff-selected", DiffIds[i] == selectedDiff);
        }

        /// 판 코드 확인 → 시작. 틀린 코드면 빨간 줄만 띄우고 안 넘어감
        private void ConfirmNewGame()
        {
            string text = seedField.value?.Trim() ?? "";
            int seed = 0;
            if (text.Length > 0 && !GameSim.TryParseSeedCode(text, out seed))
            {
                seedError.RemoveFromClassList("hidden");
                GameAudioManager.Play(SoundCue.UiDenied);
                seedField.Focus();
                return;
            }
            pendingSeed = seed;
            LaunchGame(null);
        }

        private void ContinueGame()
        {
            if (launching) return;
            if (!SaveStore.Default.TryLoad(out var saved, out var error) ||
                !SaveStore.IsCompatible(saved.State, GameController.LoadData(), out error))
            {
                RefreshSaveStatus();
                OpenDialog("불러오지 못했습니다", error ?? "저장 데이터가 없습니다.", null, continueButton);
                return;
            }
            LaunchGame(saved.State);
        }

        private void LaunchGame(KwGame.Sim.GameState saved)
        {
            if (!Application.CanStreamedLevelBeLoaded(gameScene))
            {
                OpenDialog("게임을 시작할 수 없습니다", "Main 씬이 빌드 목록에 없습니다.", null, newGameButton);
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
                if (saved == null) TitleStartup.RequestNewGame(pendingSeed, selectedDiff);
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
            musicVolumeSlider.SetValueWithoutNotify(GameAudioManager.Instance.MusicVolume);
            effectsVolumeSlider.SetValueWithoutNotify(GameAudioManager.Instance.EffectsVolume);
            fullscreenToggle.SetValueWithoutNotify(Screen.fullScreen);
            OpenDialog("설정", "플레이 환경을 설정하세요.", settingsBody, owner);
        }

        private void ShowRecords()
        {
            BuildRecords();
            OpenDialog("기록", "지금까지 쌓인 판 기록이에요.", recordsBody, recordsButton);
            recordsBody.scrollOffset = Vector2.zero;
        }

        /// 기록 창: 통계 · 엔딩 도감 · 도전과제 · 최근 판 5개
        private void BuildRecords()
        {
            recordsBody.Clear();
            var meta = MetaStore.Default.Load() ?? new MetaProgress();
            void Heading(string text) { var l = new Label(text); l.AddToClassList("records-heading"); recordsBody.Add(l); }
            void Line(string text, string detail = null, bool dim = false)
            {
                var row = new VisualElement(); row.AddToClassList("records-row");
                var l = new Label(text); l.AddToClassList("records-line"); if (dim) l.AddToClassList("records-dim"); row.Add(l);
                if (!string.IsNullOrEmpty(detail)) { var d = new Label(detail); d.AddToClassList("records-detail"); row.Add(d); }
                recordsBody.Add(row);
            }
            Heading("통계");
            Line("판 수", $"{meta.runs}");
            Line("클리어", $"{meta.clears}");
            Line("최단 클리어", meta.bestDays > 0 ? $"{meta.bestDays}일" : "-");
            Line("최고 실현수익", meta.runs > 0 ? $"{meta.bestRealized:#,0}원" : "-");

            var endings = GameSim.EndingCatalog(Data);
            Heading($"엔딩 {meta.EndingCount}/{endings.Count}");
            foreach (var e in endings)
            {
                if (meta.endings != null && meta.endings.TryGetValue(e.key, out int n) && n > 0) Line(e.name, n > 1 ? $"×{n}" : null);
                else Line("???", e.hint, true);
            }

            var achs = GameSim.Achievements(Data);
            Heading($"도전과제 {meta.AchCount}/{achs.Count}");
            foreach (var a in achs)
            {
                if (meta.ach != null && meta.ach.Contains(a.id)) Line(a.name, a.hint);
                else Line("???", a.secret ? "비밀 도전과제" : a.hint, true);
            }

            Heading("최근 판");
            var recent = meta.recent ?? new System.Collections.Generic.List<RunEntry>();
            if (recent.Count == 0) Line("아직 끝낸 판이 없어요", null, true);
            foreach (var r in recent.Take(5))
            {
                string when = System.DateTime.TryParse(r.when, null, System.Globalization.DateTimeStyles.RoundtripKind, out var t) ? t.ToLocalTime().ToString("MM/dd HH:mm") : r.when ?? "";
                int di = System.Array.IndexOf(DiffIds, r.diff ?? "normal");
                string ending = endings.FirstOrDefault(e => e.key == r.key)?.name ?? r.key ?? "";
                Line($"{when} · {(di >= 0 ? DiffNames[di] : r.diff)} · {ending}", GameSim.SeedCode(r.seed));
            }
        }

        private void ShowQuit()
        {
            confirmingQuit = true;
            OpenDialog("게임을 종료할까요?", "종료하면 타이틀 화면을 닫습니다.", null, quitButton);
            confirmButton.text = "종료";
            cancelButton.RemoveFromClassList("hidden");
            cancelButton.Focus();
        }

        private void OpenDialog(string title, string message, VisualElement body, Button owner)
        {
            if (launching) return;
            if (owner != quitButton) confirmingQuit = false;
            confirmingNewGame = false;
            returnFocus = owner;
            dialogTitle.text = title;
            dialogMessage.text = message;
            foreach (var b in bodies) b.EnableInClassList("hidden", b != body);
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
            if (confirmingNewGame) { ConfirmNewGame(); return; }
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

        private void ChangeMusicVolume(ChangeEvent<float> evt) => GameAudioManager.Instance.SetMusicVolume(evt.newValue);

        private void ChangeEffectsVolume(ChangeEvent<float> evt) => GameAudioManager.Instance.SetEffectsVolume(evt.newValue);

        private void ChangeFullscreen(ChangeEvent<bool> evt)
        {
            Screen.fullScreen = evt.newValue;
        }

        private bool AnyBodyOpen => bodies.Any(b => !b.ClassListContains("hidden"));

        private void BlockSettingsTabNavigation(NavigationMoveEvent evt)
        {
            if (overlay.ClassListContains("hidden") || !AnyBodyOpen) return;
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
                if (AnyBodyOpen)
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
