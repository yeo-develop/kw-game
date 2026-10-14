using System.Collections.Generic;
using UnityEngine;

namespace KwGame.Audio
{
    [DisallowMultipleComponent]
    public sealed class GameAudioManager : MonoBehaviour
    {
        public const int MaxEffects = 8;
        public const string MasterVolumeKey = "kw.title.volume";
        public const string MusicVolumeKey = "kw.audio.music.volume";
        public const string EffectsVolumeKey = "kw.audio.effects.volume";
        public static GameAudioManager Instance { get; private set; }
        public SoundCatalog Catalog { get; private set; }
        public AudioSource Music { get; private set; }
        public float MusicVolume { get; private set; }
        public float EffectsVolume { get; private set; }
        public int ActiveEffects
        {
            get { int count = 0; foreach (var voice in voices) if (voice != null && voice.isPlaying) count++; return count; }
        }
        readonly AudioSource[] voices = new AudioSource[MaxEffects];
        SoundCue[] voiceCues = new SoundCue[MaxEffects];
        long[] voiceOrder = new long[MaxEffects];
        readonly HashSet<SoundCue> missingClips = new HashSet<SoundCue>();
        long sequence;
        double lastButton = double.NegativeInfinity;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetInstance() => Instance = null;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        static void Bootstrap() => EnsureInitialized();

        public static void EnsureInitialized()
        {
            if (!Application.isPlaying || Instance != null) return;
            Instance = FindAnyObjectByType<GameAudioManager>();
            if (Instance != null) return;
            new GameObject("Game Audio").AddComponent<GameAudioManager>();
        }

        public static void Play(SoundCue cue)
        {
            if (!Application.isPlaying) return;
            EnsureInitialized();
            Instance.PlayCue(cue);
        }

        void OnEnable()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
            Catalog = Resources.Load<SoundCatalog>(SoundCatalog.ResourcePath);
            // Play 중 코드 리로드에서는 Awake가 다시 호출되지 않아 기존 소스를 재연결한다.
            Music = null;
            int effects = 0;
            foreach (var source in GetComponents<AudioSource>())
            {
                if (source.loop && Music == null) Music = source;
                else if (!source.loop && effects < voices.Length) voices[effects++] = source;
            }
            if (Music == null) Music = CreateSource(true);
            for (int i = effects; i < voices.Length; i++) voices[i] = CreateSource(false);
            AudioListener.volume = Mathf.Clamp01(PlayerPrefs.GetFloat(MasterVolumeKey, 1));
            MusicVolume = Mathf.Clamp01(PlayerPrefs.GetFloat(MusicVolumeKey, 1));
            EffectsVolume = Mathf.Clamp01(PlayerPrefs.GetFloat(EffectsVolumeKey, 1));
            if (Catalog == null) Debug.LogWarning("[Audio] Resources/Audio/SoundCatalog 에셋이 없습니다. KwGame/사운드 관리에서 기본 연결을 생성하세요.", this);
            RefreshSettings();
        }

        AudioSource CreateSource(bool music)
        {
            var source = gameObject.AddComponent<AudioSource>();
            source.playOnAwake = false;
            source.loop = music;
            source.spatialBlend = 0;
            source.priority = music ? 32 : 128;
            return source;
        }

        void LateUpdate() => RefreshSettings();

        public void SetMusicVolume(float value)
        {
            MusicVolume = Mathf.Clamp01(value);
            PlayerPrefs.SetFloat(MusicVolumeKey, MusicVolume);
            PlayerPrefs.Save();
            RefreshSettings();
        }

        public void SetEffectsVolume(float value)
        {
            EffectsVolume = Mathf.Clamp01(value);
            PlayerPrefs.SetFloat(EffectsVolumeKey, EffectsVolume);
            PlayerPrefs.Save();
            RefreshSettings();
        }

        public void RefreshSettings()
        {
            if (Catalog == null || Music == null) return;
            var background = Catalog.backgroundMusic;
            var clip = background?.clip;
            if (clip == null && missingClips.Add(SoundCue.BackgroundMusic)) Debug.LogWarning("[Audio] 클립이 연결되지 않았습니다: BackgroundMusic", Catalog);
            Music.volume = MusicVolume * Mathf.Clamp01(Catalog.musicVolume) * Mathf.Clamp01(background?.volume ?? 0);
            if (Music.clip != clip)
            {
                Music.Stop();
                Music.clip = clip;
                if (clip != null) Music.Play();
            }
            Music.outputAudioMixerGroup = Catalog.musicGroup;
            for (int i = 0; i < voices.Length; i++)
            {
                if (voices[i] == null) continue;
                voices[i].volume = EffectsVolume * Mathf.Clamp01(Catalog.effectsVolume) * Mathf.Clamp01(Catalog.Get(voiceCues[i])?.volume ?? 0);
                voices[i].outputAudioMixerGroup = Catalog.effectsGroup;
            }
        }

        public void PlayCue(SoundCue cue)
        {
            if (Catalog == null) return;
            if (cue == SoundCue.BackgroundMusic) { RefreshSettings(); return; }
            var sound = Catalog.Get(cue);
            if (sound?.clip == null)
            {
                if (missingClips.Add(cue)) Debug.LogWarning("[Audio] 클립이 연결되지 않았습니다: " + cue, Catalog);
                return;
            }
            if (cue == SoundCue.ButtonClick)
            {
                double now = Time.unscaledTimeAsDouble;
                if (now - lastButton < 0.045) return;
                lastButton = now;
            }
            int index = -1;
            for (int i = 0; i < voices.Length; i++)
            {
                if (voices[i] == null) continue;
                if (!voices[i].isPlaying) { index = i; break; }
                if (index < 0 || voiceOrder[i] < voiceOrder[index]) index = i;
            }
            if (index < 0) return;
            voiceCues[index] = cue;
            voiceOrder[index] = ++sequence;
            var source = voices[index];
            source.Stop();
            source.clip = sound.clip;
            source.volume = EffectsVolume * Mathf.Clamp01(Catalog.effectsVolume) * Mathf.Clamp01(sound.volume);
            source.outputAudioMixerGroup = Catalog.effectsGroup;
            source.Play();
        }

        public void StopEffects()
        {
            foreach (var voice in voices) if (voice != null) voice.Stop();
        }

        void OnDestroy()
        {
            if (Instance != this) return;
            Instance = null;
            if (Music != null) Music.Stop();
            foreach (var voice in voices) if (voice != null) voice.Stop();
        }
    }
}
