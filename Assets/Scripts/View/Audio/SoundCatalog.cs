using System;
using Sirenix.OdinInspector;
using UnityEngine;
using UnityEngine.Audio;

namespace KwGame.Audio
{
    public enum SoundCue { ButtonClick, TradeSuccess, Income, Loss, BackgroundMusic }

    [Serializable]
    public sealed class SoundClip
    {
        [Required, AssetsOnly] public AudioClip clip;
        [Range(0, 1)] public float volume = 1;
    }

    [CreateAssetMenu(menuName = "KwGame/Sound Catalog")]
    public sealed class SoundCatalog : ScriptableObject
    {
        public const string ResourcePath = "Audio/SoundCatalog";
        [BoxGroup("효과음"), InlineProperty, LabelText("버튼 클릭")] public SoundClip buttonClick = new SoundClip { volume = 0.7f };
        [BoxGroup("효과음"), InlineProperty, LabelText("거래 주문 성공")] public SoundClip tradeSuccess = new SoundClip { volume = 0.9f };
        [BoxGroup("효과음"), InlineProperty, LabelText("수익 발생")] public SoundClip income = new SoundClip { volume = 0.9f };
        [BoxGroup("효과음"), InlineProperty, LabelText("손실 발생")] public SoundClip loss = new SoundClip { volume = 0.9f };
        [BoxGroup("배경 음악"), InlineProperty, LabelText("기본 BGM")] public SoundClip backgroundMusic = new SoundClip { volume = 0.65f };
        [BoxGroup("채널 음량"), Range(0, 1), LabelText("음악")] public float musicVolume = 0.5f;
        [BoxGroup("채널 음량"), Range(0, 1), LabelText("효과음")] public float effectsVolume = 1f;
        [FoldoutGroup("믹서 라우팅 (선택)"), LabelText("음악 그룹")] public AudioMixerGroup musicGroup;
        [FoldoutGroup("믹서 라우팅 (선택)"), LabelText("효과음 그룹")] public AudioMixerGroup effectsGroup;

        public SoundClip Get(SoundCue cue)
        {
            switch (cue)
            {
                case SoundCue.ButtonClick: return buttonClick;
                case SoundCue.TradeSuccess: return tradeSuccess;
                case SoundCue.Income: return income;
                case SoundCue.Loss: return loss;
                case SoundCue.BackgroundMusic: return backgroundMusic;
                default: throw new ArgumentOutOfRangeException(nameof(cue));
            }
        }
    }
}
