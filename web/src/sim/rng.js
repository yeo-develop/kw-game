/* sim/rng.js — 시드 난수. 상태에 두 줄기: S.rng(게임 규칙) · S.fx(문구·갤 글 같은 연출 선택).
   S.rngv 로 규격을 고른다 (스펙·테스트 값: docs/ARCHITECTURE.md "난수" 절).
   - v2 (기본, 이식 대상): mulberry32 uint32 + 파생값을 + − × ÷ 만으로 계산 → C# double 과 비트 단위로 같음.
       float = u / 2^32 · gauss = (float 12개 합) − 6 (Irwin–Hall, 정확한 합) · sq(x) = x*x · pexp/plog = 아래 다항식 구현
   - v1 (레거시, v3.2 회귀 비교용): 같은 mulberry32 이지만 gauss = Box–Muller(Math.log·cos·sqrt), Math.pow·Math.exp·Math.log 사용
       → JS 엔진 수학 함수에 의존해 C# 과 끝자리가 다를 수 있음. */
import { st } from "./core.js";

/* mulberry32 한 걸음: 32비트 정수 연산만 (C#: uint 덧셈·곱셈·xor·시프트). 반환 [새 상태(int32), 출력 uint32] */
export function m32(a) {
  a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [a, (t ^ (t >>> 14)) >>> 0];
}
const U = 4294967296;
/* 0 ≤ x < 1 (= uint32 / 2^32, double 로 정확) */
export function rnd() { const S = st(); const [a, u] = m32(S.rng); S.rng = S.rngv >= 2 ? a >>> 0 : a; return u / U; }
export function frnd() { const S = st(); const [a, u] = m32(S.fx); S.fx = S.rngv >= 2 ? a >>> 0 : a; return u / U; }
export function gauss() {
  if (st().rngv >= 2) { let s = 0; for (let i = 0; i < 12; i++) s += rnd(); return s - 6; }
  const u = Math.max(rnd(), 1e-9), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export const pick = arr => arr[Math.floor(rnd() * arr.length)];
export const fpick = arr => arr[Math.floor(frnd() * arr.length)];
export const sq = x => st().rngv >= 2 ? x * x : Math.pow(x, 2);

/* ---------- 이식 가능한 exp·ln (사칙연산만, 같은 순서로 계산하면 어느 IEEE-754 double 환경에서도 같은 비트) ---------- */
const LN2 = 0.6931471805599453;
/* e^x: x = k·ln2 + r (|r| ≤ ln2/2), e^r = 테일러 20항, 2^k 는 2 곱셈/나눗셈 반복(정확) */
export function pexpP(x) {
  if (x > 700) x = 700; if (x < -700) return 0;
  const k = Math.floor(x / LN2 + 0.5), r = x - k * LN2;
  let term = 1, sum = 1;
  for (let i = 1; i <= 20; i++) { term = term * r / i; sum += term; }
  let y = sum;
  if (k > 0) for (let i = 0; i < k; i++) y *= 2; else for (let i = 0; i < -k; i++) y /= 2;
  return y;
}
/* ln x (x > 0): x = m·2^e (1 ≤ m < 2, 2 곱셈/나눗셈 반복), ln m = 2·atanh((m−1)/(m+1)) 급수 30항 */
export function plogP(x) {
  if (!(x > 0)) return -Infinity;
  let m = x, e = 0;
  while (m >= 2) { m /= 2; e++; }
  while (m < 1) { m *= 2; e--; }
  const s = (m - 1) / (m + 1), s2 = s * s;
  let term = s, sum = 0;
  for (let i = 0; i < 30; i++) { sum += term / (2 * i + 1); term *= s2; }
  return 2 * sum + e * LN2;
}
export const pexp = x => st().rngv >= 2 ? pexpP(x) : Math.exp(x);
export const plog = x => st().rngv >= 2 ? plogP(x) : Math.log(x);
