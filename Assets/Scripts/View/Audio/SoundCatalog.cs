using System;
using Sirenix.OdinInspector;
using UnityEngine;
using UnityEngine.Audio;

namespace KwGame.Audio
{
    public enum SoundCue { ButtonClick, TradeSuccess, Income, Loss, Liquidation, Kakao, Kim, AffUp, AffDown, Unlock, News, Repaid, Clear, BadEnding, Faint, WorkPay, MinigameStart, Morning, Menhera, UiDenied, UiSelect, PhoneOpen, PhoneClose, ToastPop, Blip, BackgroundMusic }

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
        [BoxGroup("게임 이벤트"), InlineProperty, LabelText("코인 청산")] public SoundClip liquidation = new SoundClip { volume = 0.9f };
        [BoxGroup("게임 이벤트"), InlineProperty, LabelText("카톡 (미래 등)")] public SoundClip kakao = new SoundClip { volume = 0.6f };
        [BoxGroup("게임 이벤트"), InlineProperty, LabelText("김사장 카톡")] public SoundClip kim = new SoundClip { volume = 0.75f };
        [BoxGroup("게임 이벤트"), InlineProperty, LabelText("호감 상승")] public SoundClip affUp = new SoundClip { volume = 0.6f };
        [BoxGroup("게임 이벤트"), InlineProperty, LabelText("호감 하락")] public SoundClip affDown = new SoundClip { volume = 0.7f };
        [BoxGroup("게임 이벤트"), InlineProperty, LabelText("해금 (대출·레버리지·숏)")] public SoundClip unlock = new SoundClip { volume = 0.85f };
        [BoxGroup("게임 이벤트"), InlineProperty, LabelText("속보")] public SoundClip news = new SoundClip { volume = 0.55f };
        [BoxGroup("게임 이벤트"), InlineProperty, LabelText("빚 상환 · 이자 납부")] public SoundClip repaid = new SoundClip { volume = 0.85f };
        [BoxGroup("게임 이벤트"), InlineProperty, LabelText("클리어 엔딩")] public SoundClip clear = new SoundClip { volume = 0.9f };
        [BoxGroup("게임 이벤트"), InlineProperty, LabelText("배드 엔딩 (원양어선)")] public SoundClip badEnding = new SoundClip { volume = 0.9f };
        [BoxGroup("게임 이벤트"), InlineProperty, LabelText("기절")] public SoundClip faint = new SoundClip { volume = 0.8f };
        [BoxGroup("게임 이벤트"), InlineProperty, LabelText("알바 일당")] public SoundClip workPay = new SoundClip { volume = 0.8f };
        [BoxGroup("게임 이벤트"), InlineProperty, LabelText("알바 시작")] public SoundClip minigameStart = new SoundClip { volume = 0.7f };
        [BoxGroup("게임 이벤트"), InlineProperty, LabelText("아침")] public SoundClip morning = new SoundClip { volume = 0.5f };
        [BoxGroup("게임 이벤트"), InlineProperty, LabelText("카톡 폭탄 (멘헤라)")] public SoundClip menhera = new SoundClip { volume = 0.7f };
        [BoxGroup("UI"), InlineProperty, LabelText("잠긴 버튼")] public SoundClip uiDenied = new SoundClip { volume = 0.5f };
        [BoxGroup("UI"), InlineProperty, LabelText("칩 고르기 (배율·롱숏 등)")] public SoundClip uiSelect = new SoundClip { volume = 0.6f };
        [BoxGroup("UI"), InlineProperty, LabelText("폰 열기")] public SoundClip phoneOpen = new SoundClip { volume = 0.5f };
        [BoxGroup("UI"), InlineProperty, LabelText("폰 닫기")] public SoundClip phoneClose = new SoundClip { volume = 0.5f };
        [BoxGroup("UI"), InlineProperty, LabelText("알림 팝 (미래 말풍선 등)")] public SoundClip toastPop = new SoundClip { volume = 0.45f };
        [BoxGroup("UI"), InlineProperty, LabelText("대사 타자음")] public SoundClip blip = new SoundClip { volume = 0.25f };
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
                case SoundCue.Liquidation: return liquidation;
                case SoundCue.Kakao: return kakao;
                case SoundCue.Kim: return kim;
                case SoundCue.AffUp: return affUp;
                case SoundCue.AffDown: return affDown;
                case SoundCue.Unlock: return unlock;
                case SoundCue.News: return news;
                case SoundCue.Repaid: return repaid;
                case SoundCue.Clear: return clear;
                case SoundCue.BadEnding: return badEnding;
                case SoundCue.Faint: return faint;
                case SoundCue.WorkPay: return workPay;
                case SoundCue.MinigameStart: return minigameStart;
                case SoundCue.Morning: return morning;
                case SoundCue.Menhera: return menhera;
                case SoundCue.UiDenied: return uiDenied;
                case SoundCue.UiSelect: return uiSelect;
                case SoundCue.PhoneOpen: return phoneOpen;
                case SoundCue.PhoneClose: return phoneClose;
                case SoundCue.ToastPop: return toastPop;
                case SoundCue.Blip: return blip;
                case SoundCue.BackgroundMusic: return backgroundMusic;
                default: throw new ArgumentOutOfRangeException(nameof(cue));
            }
        }
    }
}
