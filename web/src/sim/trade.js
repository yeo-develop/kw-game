/* sim/trade.js — 주식(장 시간) · 코인(24시간·레버리지) 매매. 펀딩비는 시세 이동(flow.marketTick)에서. */
import { D, R, st } from "./core.js";
import { T, man } from "./fmt.js";
import { roundHalfUp } from "./num.js";
import { STK, has, Tnow, absDay, stockOpen, tkOpen, cpnl } from "./state.js";
import { augFx } from "./effects.js";

export const stockFee = where => has("vip") ? 0 : where === "broker" ? R().FEE_BROKER : R().FEE_APP;
export function buyStock(tk, amt, fee) {
  const S = st();
  amt = Math.floor(Math.min(amt, S.cash) / 1000) * 1000;
  if (amt < 10000 || !stockOpen()) return null;
  const p = S.mk[tk].p;
  const h = S.hold[tk] || (S.hold[tk] = { q: 0, cost: 0, t0: Tnow(), bday: 0 });
  if (h.q <= 0) h.t0 = Tnow();
  h.q += amt * (1 - fee) / p; h.cost += amt; h.bday = absDay(); S.invIn = (S.invIn || 0) + amt;
  S.cash -= amt; S.st.invest++; S.workStreak = 0;
  return amt;
}
export function sellStock(tk, frac, fee, force) {
  const S = st();
  const h = S.hold[tk]; if (!h || h.q <= 0 || (!stockOpen() && !force)) return null;
  const p = S.mk[tk].p, q = h.q * frac, basis = h.cost * frac, gross = q * p;
  let pnl = gross - basis;
  if (pnl > 0) {
    let m = 1;
    if (has("scalp") && h.bday === absDay()) { m += 0.2; augFx("scalp", T("aug.scalp")); }
    if (has("hodl") && Tnow() - h.t0 >= 12) { m += 0.3; augFx("hodl", T("aug.hodl")); }
    if (has("inverse") && D.TK[tk].inv) { m += 0.25; augFx("inverse", T("aug.inverse")); }
    pnl *= m;
  } else if (pnl < 0 && has("diverse") && STK().filter(k => S.hold[k] && S.hold[k].q > 0).length >= 3) { pnl *= 0.6; augFx("diverse", T("aug.diverse")); }
  const back = roundHalfUp(Math.max(0, basis + pnl - gross * fee));
  S.cash += back; h.q -= q; h.cost -= basis;
  if (frac >= 0.999 || h.q * p < 100) delete S.hold[tk];
  S.today.push({ kind: "invest", amt: back - basis, label: T("lbl.sell", { n: D.TK[tk].name }) }); S.realized += back - basis;
  S.st.invest++;
  return back - basis;
}
export function openCoin(tk, dir, lev, margin) {
  const S = st();
  margin = Math.floor(margin / 1000) * 1000;
  const fee = roundHalfUp(margin * lev * R().COIN_FEE);
  if (margin < 10000 || margin + fee > S.cash || !tkOpen(tk)) return null;
  lev = Math.min(lev, D.TK[tk].maxLev);
  const mult = has("allin") && margin + fee >= S.cash * 0.95 ? 1.5 : 1;
  const c = { id: S.pid++, tk, dir, lev, margin, entry: S.mk[tk].p, mult, t0: Tnow(), bonus: has("kimp") && dir > 0 && S.kimpDay !== absDay() ? Math.min(300000, roundHalfUp(margin * 0.05)) : 0 };
  if (c.bonus) S.kimpDay = absDay();
  S.cash -= margin + fee; S.cps.push(c); S.st.invest++; S.workStreak = 0; S.invIn = (S.invIn || 0) + margin; S.realized -= fee;
  if (mult > 1) augFx("allin", T("aug.allin"));
  if (c.bonus) augFx("kimp", T("aug.kimp", { m: man(c.bonus) }));
  return c;
}
export function closeCoin(c, force) {
  const S = st();
  if (!force && c.t0 === Tnow()) return null;
  let pnl = cpnl(c);
  if (pnl > 0 && c.dir < 0 && has("inverse")) { pnl *= 1.25; augFx("inverse", T("aug.short")); }
  const fee = roundHalfUp(c.margin * c.lev * R().COIN_FEE);
  const back = roundHalfUp(Math.max(0, c.margin + pnl + c.bonus - fee));
  S.cash += back; S.cps = S.cps.filter(x => x !== c);
  S.today.push({ kind: "invest", amt: back - c.margin, label: T("lbl.close", { n: D.TK[c.tk].name, lev: c.lev, d: T(c.dir > 0 ? "long" : "short") }) }); S.realized += back - c.margin - c.bonus;
  return back - c.margin;
}
export function closeAll() { const S = st(); let t = 0; STK().forEach(k => { if (S.hold[k]) t += sellStock(k, 1, R().FEE_APP, true) || 0; }); S.cps.slice().forEach(c => t += closeCoin(c, true) || 0); return t; }
