/* sim/market.js — 시세. 칸 시작 때 다음 움직임을 미리 '계획'(planMarket)하고 칸 끝에 적용(applyMarket).
   → 찌라시·리포트·고래 힌트의 적중률을 정확히 맞출 수 있음 (출처별 적중률 = 진짜 확률) */
import { D, R, st } from "./core.js";
import { rnd, gauss, pick, plog, pexp } from "./rng.js";
import { clamp } from "./num.js";
import { TKS, has, Tnow, tkOpen, liqPx, isEve } from "./state.js";

export function planMarket(shock, evening, M) {
  const S = st();
  M = M || S.mk;
  if (rnd() > 0.9) M.reg = -M.reg;
  const mret = M.reg * 0.0027 + gauss() * (evening ? 0.0092 : 0.0058) + (shock.MKT || 0);   /* v3.2: 주식 기본 노이즈 −35% → 정보가 주식 수익을 좌우 */
  const whale = evening && S.mk === M && has("whale");
  const P = { r: {}, w: {}, whale };
  for (const k of TKS()) {
    const t = D.TK[k], s = M[k];
    if (rnd() > (t.type === "coin" ? 0.85 : 0.9)) s.tr = -s.tr;
    let r;
    if (t.inv) r = -2 * mret - 0.001 + gauss() * t.vol;
    else if (t.meme) r = rnd() < 0.46 ? 0.45 + rnd() * 0.45 : -(0.28 + rnd() * 0.3);
    else if (t.type === "stock") r = t.beta * mret + s.tr * t.tr + gauss() * t.vol * (evening ? 1.3 : 1);
    else r = (s.tr * t.tr + gauss() * t.vol) * (whale ? 2 : 1);
    r += shock[k] || 0;
    P.r[k] = clamp(r, -0.7, 1.5);
    const wig = t.vol * (whale ? 2 : 1) * (0.2 + rnd() * 0.6);
    P.w[k] = [wig * rnd(), wig * rnd()];
  }
  return P;
}
export function applyMarket(P, M) {
  M = M || st().mk;
  const out = {};
  for (const k of TKS()) {
    const t = D.TK[k], s = M[k];
    const o = s.p, c = Math.max(o * (1 + P.r[k]), t.p0 * 0.001);
    const h = Math.max(o, c) * (1 + P.w[k][0]), l = Math.min(o, c) * (1 - P.w[k][1]);
    s.hist.push({ o, h, l, c }); if (s.hist.length > 40) s.hist.shift();
    s.p = c; out[k] = { o, c, h, l, r: c / o - 1 };
  }
  return out;
}
const stepMarket = (shock, evening, M) => applyMarket(planMarket(shock, evening, M), M);
/* 이번 칸 끝의 시세를 미리 계획 (뉴스 충격 포함) */
export function planNext() {
  const S = st(), T = Tnow();
  const sh = Object.assign({}, S.shocks[T] || {}); delete S.shocks[T];
  if (S.news && !S.news.fake) sh[S.news.tk] = (sh[S.news.tk] || 0) + S.news.r;
  S.mplan = planMarket(sh, isEve()); S.mplan.T = T; return S.mplan;
}
export const curPlan = () => { const S = st(); return (S.mplan && S.mplan.T === Tnow()) ? S.mplan : planNext(); };
export function initMarket() {
  const M = { reg: rnd() < 0.6 ? 1 : -1 };
  for (const k of TKS()) M[k] = { p: D.TK[k].p0, tr: rnd() < 0.5 ? 1 : -1, hist: [] };
  for (let i = 0; i < 14; i++) stepMarket({}, i % R().SLOTS === R().SLOTS - 1, M);
  return M;
}
/* 숨은 충격: 이미 계획된 칸이면 계획에 바로 더하고, 아니면 그 칸 계획 때 합쳐짐 */
export function addShock(T, tk, r) {
  const S = st();
  if (S.mplan && S.mplan.T === T) { S.mplan.r[tk] = clamp(S.mplan.r[tk] + r, -0.7, 1.5); return; }
  const o = S.shocks[T] || (S.shocks[T] = {}); o[tk] = (o[tk] || 0) + r;
}
/* 칸 안에서 청산가를 찍었는지: 브라운 브리지 경계 통과 확률 (칸 시작가 o → 끝 c, 칸 내부 변동성 σ).
   종가만 보면 고배율이 '손실은 증거금까지, 이익은 무한'이라 기대값이 플러스 → 경로 청산으로 막는다 */
export function liqHit(c, mv, vol) {
  const L = liqPx(c), sg = vol * R().INTRA;
  const a = c.dir > 0 ? plog(mv.o / L) : plog(L / mv.o), b = c.dir > 0 ? plog(mv.c / L) : plog(L / mv.c);
  if (a <= 0 || b <= 0) return true;
  return rnd() < pexp(-2 * a * b / (sg * sg));
}
export function genNews() {
  if (rnd() > 0.32) return null;
  const pool = TKS().filter(k => k !== "INV" && tkOpen(k)).concat(["MKT"]);
  const tk = pick(pool), [h, dir] = pick(D.NEWS[tk]), t = D.TK[tk];
  const mag = tk === "MKT" ? 0.02 + rnd() * 0.02 : t.type === "stock" ? 0.05 + rnd() * 0.07 : t.meme ? 0.4 : 0.07 + rnd() * 0.09;
  return { tk, h, dir, r: dir * mag, fake: rnd() < 0.3 };
}
