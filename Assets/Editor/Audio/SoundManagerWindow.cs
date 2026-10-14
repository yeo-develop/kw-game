using System;
using KwGame.Audio;
using UnityEditor;
using UnityEditor.UIElements;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.EditorTools
{
    public sealed class SoundManagerWindow : EditorWindow
    {
        SerializedObject serializedCatalog;
        Label status;
        IVisualElementScheduledItem statusUpdate;

        [MenuItem("KwGame/사운드 관리")]
        public static void Open() => GetWindow<SoundManagerWindow>("사운드 관리");

        void OnEnable()
        {
            minSize = new Vector2(650, 520);
            AssemblyReloadEvents.beforeAssemblyReload += StopPreview;
            EditorApplication.playModeStateChanged += PlayModeChanged;
        }

        void OnDisable()
        {
            StopPreview();
            statusUpdate?.Pause();
            AssemblyReloadEvents.beforeAssemblyReload -= StopPreview;
            EditorApplication.playModeStateChanged -= PlayModeChanged;
            rootVisualElement.Unbind();
            serializedCatalog?.Dispose();
        }

        void PlayModeChanged(PlayModeStateChange state) { StopPreview(); RefreshStatus(); }
        static void StopPreview() => SoundPreview.Stop();

        public void CreateGUI()
        {
            statusUpdate?.Pause();
            rootVisualElement.Unbind();
            rootVisualElement.Clear();
            serializedCatalog?.Dispose(); serializedCatalog = null;
            rootVisualElement.styleSheets.Add(AssetDatabase.LoadAssetAtPath<StyleSheet>("Assets/Editor/Audio/SoundManagerWindow.uss"));
            rootVisualElement.AddToClassList("sound-window");
            var toolbar = new Toolbar(); rootVisualElement.Add(toolbar);
            toolbar.Add(new ToolbarButton(() => { SoundDefaults.EnsureCatalog(); CreateGUI(); }) { text = "기본 음원 연결" });
            toolbar.Add(new ToolbarButton(() => Selection.activeObject = AssetDatabase.LoadAssetAtPath<SoundCatalog>(SoundDefaults.CatalogPath)) { text = "Inspector에서 열기" });
            toolbar.Add(new ToolbarButton(() => { if (serializedCatalog != null) AssetDatabase.SaveAssetIfDirty(serializedCatalog.targetObject); }) { text = "저장" });
            toolbar.Add(new ToolbarButton(StopPreview) { text = "미리 듣기 정지" });
            var catalog = AssetDatabase.LoadAssetAtPath<SoundCatalog>(SoundDefaults.CatalogPath);
            if (catalog == null)
            {
                rootVisualElement.Add(new HelpBox("기본 음원 연결을 누르면 관리 에셋을 만듭니다. 기존 연결과 음량은 유지됩니다.", HelpBoxMessageType.Info));
                return;
            }
            serializedCatalog = new SerializedObject(catalog);
            var scroll = new ScrollView(); rootVisualElement.Add(scroll);
            var header = new Label("게임 사운드"); header.AddToClassList("sound-heading"); scroll.Add(header);
            scroll.Add(new Label("클립과 음량을 한곳에서 관리합니다. 변경은 Undo / Redo를 지원합니다."));
            var asset = new ObjectField("설정 에셋") { objectType = typeof(SoundCatalog), value = catalog, allowSceneObjects = false };
            asset.SetEnabled(false); scroll.Add(asset);
            var channel = new VisualElement(); channel.AddToClassList("sound-channels"); scroll.Add(channel);
            AddVolume(channel, "음악 채널", serializedCatalog.FindProperty("musicVolume"));
            AddVolume(channel, "효과음 채널", serializedCatalog.FindProperty("effectsVolume"));
            AddCue(scroll, "버튼 클릭", "활성 버튼 실행 시. 마우스 / 키보드 공통.", "buttonClick", false);
            AddCue(scroll, "거래 주문 성공", "주식 매수·매도 / 코인 진입·종료가 실제 체결됐을 때.", "tradeSuccess", false);
            AddCue(scroll, "수익 발생", "실현 거래 손익, 지급금, 카지노·경마 결과, 복권 당첨금의 양수 값.", "income", false);
            AddCue(scroll, "손실 발생", "음수 손익·지출 이벤트 및 코인 강제청산. 거래 원금 이동 제외.", "loss", false);
            AddCue(scroll, "기본 배경 음악", "반복 재생. Title → Main 전환에도 이어집니다.", "backgroundMusic", true);
            var routing = new Foldout { text = "믹서 라우팅 (선택)", value = false }; scroll.Add(routing);
            foreach (string field in new[] { "musicGroup", "effectsGroup" }) routing.Add(new PropertyField(serializedCatalog.FindProperty(field)));
            scroll.Add(new HelpBox("전체 음량은 타이틀 설정을 사용합니다. 편집 모드 미리 듣기는 클립 원음을 재생합니다. 채널·클립 음량은 Play에서 확인하세요. 아침 배당·선물, 펀딩비는 별도 금액 이벤트가 없어 이번 자동 연결 범위에서 제외됩니다.", HelpBoxMessageType.Info));
            status = new Label(); status.AddToClassList("sound-status"); rootVisualElement.Add(status);
            rootVisualElement.Bind(serializedCatalog);
            statusUpdate = rootVisualElement.schedule.Execute(RefreshStatus).Every(500);
            RefreshStatus();
        }

        static void AddVolume(VisualElement parent, string label, SerializedProperty property)
        {
            var slider = new Slider(label, 0, 1) { showInputField = true };
            slider.AddToClassList("sound-volume"); slider.BindProperty(property); parent.Add(slider);
        }

        void AddCue(VisualElement parent, string title, string description, string field, bool music)
        {
            var card = new VisualElement(); card.AddToClassList("sound-card"); parent.Add(card);
            var row = new VisualElement(); row.AddToClassList("sound-card-heading"); card.Add(row);
            var heading = new Label(title); heading.AddToClassList("sound-card-title"); row.Add(heading);
            var property = serializedCatalog.FindProperty(field);
            var clipProperty = property.FindPropertyRelative("clip");
            var preview = new Button(() => SoundPreview.Play(clipProperty.objectReferenceValue as AudioClip, music)) { text = "미리 듣기" };
            row.Add(preview);
            var hint = new Label(description); hint.AddToClassList("sound-description"); card.Add(hint);
            var clip = new ObjectField("오디오 클립") { objectType = typeof(AudioClip), allowSceneObjects = false };
            clip.BindProperty(clipProperty); card.Add(clip);
            AddVolume(card, "클립 음량", property.FindPropertyRelative("volume"));
            var info = new Label(); info.AddToClassList("sound-description"); card.Add(info);
            void UpdateClip()
            {
                var audio = clipProperty.objectReferenceValue as AudioClip;
                preview.SetEnabled(audio != null);
                info.text = audio == null ? "클립 미연결, 이 소리는 재생하지 않습니다." : $"{audio.length:0.00}초 · {audio.channels}채널 · {audio.frequency:N0} Hz";
            }
            clip.RegisterValueChangedCallback(_ => { StopPreview(); card.schedule.Execute(UpdateClip); });
            card.TrackPropertyValue(clipProperty, _ => UpdateClip());
            UpdateClip();
        }

        void RefreshStatus()
        {
            if (status == null) return;
            var manager = GameAudioManager.Instance;
            status.text = !EditorApplication.isPlaying ? "편집 모드 · 클립 미리 듣기 가능" : manager == null ? "Play 모드 · 매니저 초기화 대기" :
                $"Play 모드 · BGM {(manager.Music.isPlaying ? "재생 중" : "정지")} · 효과음 {manager.ActiveEffects}/{GameAudioManager.MaxEffects} · 전체 음량 {AudioListener.volume:P0}";
        }
    }
}
