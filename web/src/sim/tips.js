/* sim/tips.js — 정보(팁) 시스템.
   팁 = {출처 who, 종목 tk, 방향 dir, 크기 mag, 만든 칸 T0, 결과 칸 Tr, 종류 kind(real/fake/pd)}.
   만들 때 출처 적중률(acc)로 진짜/가짜/펌프앤덤프를 굴리고, 진짜면 결과 칸 시세에 '숨은 충격'을 심는다.
   (가짜 = 충격 없음 · 펌프앤덤프 = 결과 1칸 전 +0.4×크기, 결과 칸 −1.5×크기) */
import { D, R, st, emit } from "./core.js";
import { rnd, frnd, fpick } from "./rng.js";
import { T, stars } from "./fmt.js";
import { roundHalfUp } from "./num.js";
import { TKS, has, Tnow, absDay, tkOpen } from "./state.js";
import { addShock } from "./market.js";
import { pushF, pushKR } from "./effects.js";
import { ANON, HY, MATH, RES, SUB } from "./ids.js";

export const srcOf = t => D.SRC[t.who] || D.SRC[SUB];
const repAcc = d => d.tier === "rep" && has("vip") ? 0.85 : d.acc;
export const WALKERS = () => Object.keys(D.SRC).filter(k => D.SRC[k].tier === "walk");

export function rollTip(who, o = {}) {
  const S = st(), d = D.SRC[who], T0 = Tnow(), TK = D.TK;
  let cands = TKS().filter(k => tkOpen(k) && (!TK[k].meme || d.meme) && (d.stock ? TK[k].type === "stock" && !TK[k].inv : true) && (d.coin ? TK[k].type === "coin" : true));
  if (d.meme && tkOpen("MMC") && rnd() < 0.5) cands = ["MMC"];
  const tk = o.tk && cands.includes(o.tk) ? o.tk : cands[Math.floor(rnd() * cands.length)];
  const stockish = TK[tk].type === "stock";
  const dir = o.dir || (rnd() < (d.up != null ? d.up : stockish ? 0.65 : 0.5) ? 1 : -1);
  let mag = d.mag[0] + rnd() * (d.mag[1] - d.mag[0]);
  if (!stockish) mag = Math.min(TK[tk].meme ? 1 : 0.6, mag * (TK[tk].meme ? 2.5 : 1.4));
  let Tr = T0 + d.lag[0] + Math.floor(rnd() * (d.lag[1] - d.lag[0] + 1));
  const r = rnd(), acc = repAcc(d);
  const kind = r < acc ? "real" : r < acc + (d.pd || 0) ? "pd" : "fake";
  if (kind === "pd" && Tr < T0 + 1) Tr = T0 + 1;
  let pre = false;
  if (kind === "real") { pre = !!(d.pre && rnd() < d.pre); addShock(Tr, tk, dir * mag * (pre ? 0.15 : 1)); }
  if (kind === "pd") { addShock(Tr - 1, tk, dir * mag * 0.4); addShock(Tr, tk, -dir * mag * 1.5); }
  const t = { id: S.gid++, who, tier: d.tier, tk, dir, mag, T0, Tr, kind, pre, p0: S.mk[tk].p, res: "" };
  S.tips.push(t);
  if (S.tips.length > 80) { const i = S.tips.findIndex(x => x.res); if (i >= 0) S.tips.splice(i, 1); }
  return t;
}
/* 칸 끝: 결과 칸이 된 팁 판정 (만든 때 가격 → 지금 가격) */
export function resolveTips() {
  const S = st(), done = [];
  for (const t of S.tips) {
    if (t.res) continue;
    if (t.Tr < Tnow()) { t.res = "void"; continue; }
    if (t.Tr !== Tnow()) continue;
    const rr = S.mk[t.tk].p / t.p0 - 1, hit = (rr >= 0 ? 1 : -1) === t.dir;
    t.rr = rr; t.res = t.kind === "pd" ? "pd" : hit ? "hit" : "miss";
    const g = S.srcStat[t.who] || (S.srcStat[t.who] = [0, 0]); g[1]++; if (t.res === "hit") g[0]++;
    done.push(t);
  }
  return done;
}
export const activeTips = tk => st().tips.filter(t => !t.res && t.Tr >= Tnow() && (!tk || t.tk === tk));
/* 리포트: 앱 리서치 (하루 무료 1, VIP 2 / 유료 RSCH_FEE × RSCH_PAID_MAX) */
export function rsch() { const S = st(); if (!S.rsch || S.rsch.d !== absDay()) S.rsch = { d: absDay(), free: 0, paid: 0 }; return S.rsch; }
export const freeMax = () => has("vip") ? 2 : 1;
export function getReport(paid) {
  const S = st(), Rr = rsch(), fee = R().RSCH_FEE;
  if (paid) { if (Rr.paid >= R().RSCH_PAID_MAX || S.cash < fee) return null; S.cash -= fee; Rr.paid++; S.today.push({ kind: "ev", amt: -fee, label: T("lbl.paidReport") }); }
  else { if (Rr.free >= freeMax()) return null; Rr.free++; }
  return rollTip(RES);
}
/* 길에서 만난 사람: 지도에서 장소로 갈 때 ENCOUNTER_P 확률 → 출처 id 또는 null */
export function encounterRoll() { const W = WALKERS(); return rnd() < R().ENCOUNTER_P ? W[Math.floor(rnd() * W.length)] : null; }

export const resMark = r => T("res." + (r || "wait"));
export function srcRec(who) { const g = st().srcStat[who]; return g && g[1] ? `${g[0]}/${g[1]} (${roundHalfUp(g[0] / g[1] * 100)}%)` : T("rec.none"); }
export function whenLabel(Tr) {
  const n = R().SLOTS, k = Tr - Tnow(); if (k <= 0) return T("when.now");
  const d = Math.floor(Tr / n) - Math.floor(Tnow() / n), s = D.SLOT_NAME[Tr % n];
  return d === 0 ? T("when.today", { s }) : d === 1 ? T("when.tomorrow", { s }) : T("when.k", { k });
}
/* 정보 수첩 알림 + (집이면) 미래 말풍선 */
export function tipAnnounce(t, via) {
  const S = st();
  t.via = via; const d = srcOf(t);
  pushF("🔎", T("tip.feed", { ic: d.ic, n: d.name, tk: D.TK[t.tk].name, a: t.dir > 0 ? "▲" : "▼", w: whenLabel(t.Tr), s: stars(d.trust) }), "tip");
  const bub = via !== "post" && S.phase === "home" ? fpick(D.TIP_REACT[t.who === HY ? HY : t.tier]) : null;
  emit("tip", { id: t.id, via, bubble: bub, face: t.tier === "rep" ? "tired" : "smug" });
}
/* 팁 결과의 부수 효과: 갤 글 결과 댓글 · 형나믿지 DM 반응 */
export function onTipsResolved(list, postById) {
  for (const t of list) {
    const p = t.pid && postById(t.pid);
    if (p) {
      p.res = t.res === "hit" ? 1 : -1; p.rr = t.rr; p.pd = t.res === "pd";
      const pool = (t.res === "pd" ? D.TIP_RES.pd : D.TIP_RES[t.res === "hit" ? "hit" : "miss"]).slice(), k = 2 + Math.floor(frnd() * 2);
      for (let i = 0; i < k && pool.length; i++) p.cm.push({ au: frnd() < 0.6 ? ANON : fpick(D.STR.tipResAu), x: pool.splice(Math.floor(frnd() * pool.length), 1)[0].replace("{au}", t.who), up: Math.floor(frnd() * 30), res: 1 });
      if (t.res === "hit") p.up += 15 + Math.floor(frnd() * 30); else p.dn += 10 + Math.floor(frnd() * 25);
      p.best = p.up >= 50;
    }
    if (t.via === "dm" && t.who === HY) pushKR("hy", "hy", t.res === "hit" ? T("hy.hit") : t.res === "pd" ? T("hy.pd") : fpick(D.STR["hy.miss"]));
    if (t.via === "dm" && t.who === MATH) pushKR("hy", "hy", t.res === "hit" ? T("hy.mathHit") : T("hy.mathMiss"));
  }
}
