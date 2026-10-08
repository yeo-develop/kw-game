using NUnit.Framework;
using UnityEngine;

namespace KwGame.Tests
{
    // CLI 테스트 파이프라인이 살아 있는지만 확인한다. 게임 로직 테스트는 여기 옆에 추가.
    public class SmokeTests
    {
        [Test]
        public void ResolutionIs16By9()
        {
            Assert.That(1920f / 1080f, Is.EqualTo(16f / 9f).Within(1e-4));
        }

        [Test]
        public void PersuasionChanceIsClamped()
        {
            // 기획서 개입 판정식: P = clamp(20 + 0.5×신뢰 + 스타일 − 멘탈, 5, 85)
            float P(float trust, float style, float mental) => Mathf.Clamp(20 + 0.5f * trust + style - mental, 5, 85);
            Assert.That(P(100, 50, 0), Is.EqualTo(85));
            Assert.That(P(0, 0, 40), Is.EqualTo(5));
            Assert.That(P(20, 0, 0), Is.EqualTo(30));
        }
    }
}
