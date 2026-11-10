using System;
using System.Collections.Generic;
using System.Linq;
using KwGame.Audio;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.View
{
    /// 게임 안 설정 창 (퀵메뉴 "설정"): 음량 · 글자 속도 · 화면 효과 · 읽은 대사 빨리 넘기기. Esc 로 닫기
    public partial class GameController
    {
        const string TextSpeedKey = "kw.text.speed", FxKey = "kw.fx", SkipSeenKey = "kw.skipSeen", SeenKey = "kw.seen";
        const int SeenCap = 500;
        static readonly string[] TextSpeedNames = { "느림", "보통", "빠름", "즉시" };
        static readonly float[] TextSpeedMult = { 2f, 1f, 0.45f, 0f };

        VisualElement settingsEl;
        int textSpeed = 1;
        bool skipSeen, sceneInstant;
        List<string> seenScenes;
        float baseNormal = -1, baseLong, baseMiddle;

        /// 시작할 때 (새 게임 · 이어하기 모두) 저장된 설정 적용
        void LoadPlayPrefs()
        {
            AudioListener.volume = PlayerPrefs.GetFloat(GameAudioManager.MasterVolumeKey, AudioListener.volume);
            textSpeed = Mathf.Clamp(PlayerPrefs.GetInt(TextSpeedKey, 1), 0, 3);
            Ui.FxOff = PlayerPrefs.GetInt(FxKey, 1) == 0;
            skipSeen = PlayerPrefs.GetInt(SkipSeenKey, 0) == 1;
            seenScenes = PlayerPrefs.GetString(SeenKey, "").Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries).ToList();
            ApplyTextSpeed();
        }

        void ApplyTextSpeed()
        {
            if (dialogueTiming == null) return;
            if (baseNormal < 0) { baseNormal = dialogueTiming.waitForNormalChars; baseLong = dialogueTiming.waitLong; baseMiddle = dialogueTiming.waitMiddle; }
            float m = TextSpeedMult[Mathf.Clamp(textSpeed, 0, 3)];
            dialogueTiming.waitForNormalChars = baseNormal * m;
            dialogueTiming.waitLong = baseLong * m;
            dialogueTiming.waitMiddle = baseMiddle * m;
        }

        bool SeenScene(string key) => seenScenes != null && seenScenes.Contains(key);

        void MarkSceneSeen(string key)
        {
            if (string.IsNullOrEmpty(key) || key.Contains(",")) return;
            seenScenes ??= new List<string>();
            if (seenScenes.Contains(key)) return;
            seenScenes.Add(key);
            if (seenScenes.Count > SeenCap) seenScenes.RemoveRange(0, seenScenes.Count - SeenCap);
            PlayerPrefs.SetString(SeenKey, string.Join(",", seenScenes));
            PlayerPrefs.Save();
        }

        void OpenSettings()
        {
            if (settingsEl != null) { CloseSettings(); return; }
            settingsEl = Ui.Box(new Color(0, 0, 0, 0.6f)); Ui.Fill(settingsEl); settingsEl.name = "settingsOverlay";
            settingsEl.style.alignItems = Align.Center; settingsEl.style.justifyContent = Justify.Center;
            settingsEl.RegisterCallback<PointerDownEvent>(e => { if (e.target == settingsEl) CloseSettings(); });
            root.Add(settingsEl);
            RenderSettings();
        }

        void CloseSettings()
        {
            if (settingsEl == null) return;
            settingsEl.RemoveFromHierarchy();
            settingsEl = null;
            PlayerPrefs.Save();
        }

        void RenderSettings()
        {
            if (settingsEl == null) return;
            settingsEl.Clear();
            var card = GlassBox(32, 18); card.style.width = 760; card.name = "settingsPanel";
            settingsEl.Add(card);
            var t = Ui.Label("설정", 34, Ui.Gold, true); t.style.marginBottom = 18; card.Add(t);

            var audio = GameAudioManager.Instance;
            card.Add(VolumeRow("전체 음량", AudioListener.volume, v => { AudioListener.volume = v; PlayerPrefs.SetFloat(GameAudioManager.MasterVolumeKey, v); }));
            card.Add(VolumeRow("배경음", audio != null ? audio.MusicVolume : 1f, v => GameAudioManager.Instance?.SetMusicVolume(v)));
            card.Add(VolumeRow("효과음", audio != null ? audio.EffectsVolume : 1f, v => GameAudioManager.Instance?.SetEffectsVolume(v)));

            var sr = SettingRow("글자 속도");
            for (int i = 0; i < TextSpeedNames.Length; i++)
            {
                int k = i;
                sr.Add(Ui.Chip(TextSpeedNames[i], () => { textSpeed = k; PlayerPrefs.SetInt(TextSpeedKey, k); ApplyTextSpeed(); RenderSettings(); }, false, textSpeed == k ? Ui.Accent : new Color(1, 1, 1, 0.06f)));
            }
            card.Add(sr);

            card.Add(OnOffRow("화면 효과", !Ui.FxOff, on => { Ui.FxOff = !on; PlayerPrefs.SetInt(FxKey, on ? 1 : 0); }, "흔들림 · 폭죽 · 카톡 폭탄 연출"));
            card.Add(OnOffRow("읽은 대사 빨리 넘기기", skipSeen, on => { skipSeen = on; PlayerPrefs.SetInt(SkipSeenKey, on ? 1 : 0); }, "본 장면은 글자가 한 번에 나와요"));

            var close = Ui.Button("닫기", CloseSettings, null, false, Ui.Accent); close.style.marginTop = 18; close.style.alignSelf = Align.FlexEnd; close.style.marginBottom = 0;
            card.Add(close);
            card.Add(Ui.Label("Esc 로 닫기", 18, Ui.Dim));
        }

        VisualElement SettingRow(string name)
        {
            var r = Ui.Row(); r.style.marginBottom = 14; r.style.minHeight = 48;
            var l = Ui.Label(name, 22, Ui.Text, true); l.style.width = 220; l.style.flexShrink = 0; r.Add(l);
            return r;
        }

        VisualElement OnOffRow(string name, bool on, Action<bool> set, string hint)
        {
            var r = SettingRow(name);
            r.Add(Ui.Chip("켜짐", () => { set(true); RenderSettings(); }, false, on ? Ui.Accent : new Color(1, 1, 1, 0.06f)));
            r.Add(Ui.Chip("꺼짐", () => { set(false); RenderSettings(); }, false, !on ? Ui.Accent : new Color(1, 1, 1, 0.06f)));
            var h = Ui.Label(hint, 18, Ui.Dim); h.style.flexShrink = 1; h.style.marginLeft = 6; r.Add(h);
            return r;
        }

        /// UI Toolkit Slider — 메인 씬 패널엔 테마 스타일시트가 없어서 막대·손잡이 모양을 직접 입힘
        VisualElement VolumeRow(string name, float value, Action<float> set)
        {
            var r = SettingRow(name);
            var s = new Slider(0, 1) { value = Mathf.Clamp01(value) };
            s.style.flexGrow = 1; s.style.height = 36; s.style.marginLeft = 0; s.style.marginRight = 12;
            var input = s.Q(className: BaseField<float>.inputUssClassName);
            if (input != null) { input.style.flexGrow = 1; input.style.height = Length.Percent(100); }
            var drag = s.Q(className: Slider.dragContainerUssClassName);
            if (drag != null) { drag.style.flexGrow = 1; drag.style.height = Length.Percent(100); }
            var tracker = s.Q(className: Slider.trackerUssClassName);
            if (tracker != null)
            {
                Ui.Abs(tracker, 0, null, 0); tracker.style.top = Length.Percent(50); tracker.style.height = 8; tracker.style.marginTop = -4;
                tracker.style.backgroundColor = new Color(1, 1, 1, 0.18f); Ui.Radius(tracker, 4);
            }
            var dragger = s.Q(className: Slider.draggerUssClassName);
            if (dragger != null)
            {
                dragger.style.position = Position.Absolute; dragger.style.top = Length.Percent(50);
                dragger.style.width = 24; dragger.style.height = 24; dragger.style.marginTop = -12;
                dragger.style.backgroundColor = Ui.Accent; Ui.Radius(dragger, 12);
            }
            var pct = Ui.Label($"{s.value * 100:0}%", 20, Ui.Dim); pct.style.width = 64; pct.style.flexShrink = 0; pct.style.unityTextAlign = TextAnchor.MiddleRight;
            s.RegisterValueChangedCallback(e => { set(e.newValue); pct.text = $"{e.newValue * 100:0}%"; });
            r.Add(s); r.Add(pct);
            return r;
        }
    }
}
