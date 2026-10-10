/* sim/fmt.js — 숫자·문구 포맷 (sim·view 공용). 한글 단위·문구는 전부 data(STR)에서 온다.
   T(key, vars): data/strings.json 의 STR[key] 템플릿 "{name}" 채우기. */
import { D } from "./core.js";
import { frnd } from "./rng.js";
import { roundHalfUp } from "./num.js";

const loc = n => n.toLocaleString("ko-KR");
const U = () => D.STR.U;
export const won = n => loc(roundHalfUp(n)) + U().won;
export const sgnWon = n => (n > 0 ? "+" : n < 0 ? "−" : "±") + loc(Math.abs(roundHalfUp(n))) + U().won;
export const man = n => {
  const a = Math.abs(n);
  const s = a >= 1e8 ? (a / 1e8).toFixed(2).replace(/\.?0+$/, "") + U().eok : a >= 1e4 ? loc(roundHalfUp(a / 1e4)) + U().man : loc(roundHalfUp(a));
  return (n < 0 ? "−" : "") + s;
};
export const sgnMan = n => (n > 0 ? "+" : n < 0 ? "" : "±") + man(n) + U().won;
export const pct = r => (r > 0 ? "▲" : r < 0 ? "▼" : "±") + Math.abs(r * 100).toFixed(1) + "%";
export const fmtP = p => p >= 100 ? loc(roundHalfUp(p)) : p >= 1 ? p.toFixed(2) : p.toFixed(4);
export const stars = n => "★".repeat(n) + "☆".repeat(5 - n);

/* 템플릿 채우기: 없는 변수는 빈 문자열 */
export const fill = (x, v) => String(x).replace(/\{(\w+)\}/g, (_, k) => v && v[k] != null ? v[k] : "");
export function T(key, v) {
  const x = D.STR[key];
  if (x == null) throw new Error("STR missing: " + key);
  return v ? fill(x, v) : x;
}
/* 배열 문구 */
export function TA(key) { const x = D.STR[key]; if (!Array.isArray(x)) throw new Error("STR array missing: " + key); return x; }

/* 돈 환산 드립 (연출 난수 S.fx 사용) */
export function conv(n) {
  const a = Math.abs(n);
  const ok = D.CONV.filter(c => a / c[1] >= 1 && a / c[1] < 100000);
  if (!ok.length) return T("convNone");
  const c = ok[Math.floor(frnd() * ok.length)], k = Math.floor(a / c[1]);
  return `${c[0]} ${loc(k)}${c[2]}`;
}
