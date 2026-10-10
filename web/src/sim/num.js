/* sim/num.js — 숫자 규칙. 돈 반올림은 roundHalfUp 하나만 쓴다.
   roundHalfUp(x) = floor(x + 0.5)  (−2.5 → −2, 2.5 → 3). C# Math.Round 기본값(은행가 반올림)과 다름 → C# 은 Math.Floor(x + 0.5). */
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const roundHalfUp = x => Math.floor(x + 0.5);
/* 1000원 단위 반올림 */
export const round1k = x => roundHalfUp(x / 1000) * 1000;
