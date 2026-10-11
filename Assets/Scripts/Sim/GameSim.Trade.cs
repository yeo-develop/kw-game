using System;
using System.Collections.Generic;
using System.Linq;

namespace KwGame.Sim
{
    // trade.js — 주식(장 시간) · 코인(24시간·레버리지)
    public partial class GameSim
    {
        public double stockFee(string where) => has("vip") ? 0 : where == "broker" ? R.FEE_BROKER : R.FEE_APP;
        double? buyStock(string tk, double amt, double fee)
        {
            amt = Math.Floor(Math.Min(amt, S.cash) / 1000) * 1000;
            if (amt < 10000 || !stockOpen()) return null;
            double p = S.mk.tk[tk].p;
            var h = S.hold.Get(tk);
            if (h == null) { h = new Holding { q = 0, cost = 0, t0 = Tnow(), bday = 0 }; S.hold.Set(tk, h); }
            if (h.q <= 0) h.t0 = Tnow();
            h.q += amt * (1 - fee) / p; h.cost += amt; h.bday = absDay(); S.invIn = S.invIn + amt;
            S.cash -= amt; S.st.invest++; S.workStreak = 0;
            return amt;
        }
        double? sellStock(string tk, double frac, double fee, bool force = false)
        {
            var h = S.hold.Get(tk); if (h == null || h.q <= 0 || (!stockOpen() && !force)) return null;
            double p = S.mk.tk[tk].p, q = h.q * frac, basis = h.cost * frac, gross = q * p;
            double pnl = gross - basis;
            if (pnl > 0)
            {
                double m = 1;
                if (has("scalp") && h.bday == absDay()) { m += 0.2; augFx("scalp", T("aug.scalp")); }
                if (has("hodl") && Tnow() - h.t0 >= 3 * R.SLOTS) { m += 0.3; augFx("hodl", T("aug.hodl")); }
                if (has("inverse") && D.TK[tk].inv) { m += 0.25; augFx("inverse", T("aug.inverse")); }
                pnl *= m;
            }
            else if (pnl < 0 && has("diverse") && STK().Count(k => S.hold.Has(k) && S.hold[k].q > 0) >= 3) { pnl *= 0.6; augFx("diverse", T("aug.diverse")); }
            double back = rhu(Math.Max(0, basis + pnl - gross * fee));
            S.cash += back; h.q -= q; h.cost -= basis;
            if (frac >= 0.999 || h.q * p < 100) S.hold.Remove(tk);
            S.today.Add(new Ledger { kind = "invest", amt = back - basis, label = T("lbl.sell", "n", D.TK[tk].name) }); S.realized += back - basis;
            S.st.invest++; S.st.iN++; if (back > basis) S.st.iW++;
            return back - basis;
        }
        CoinPos openCoin(string tk, int dir, double lev, double margin)
        {
            margin = Math.Floor(margin / 1000) * 1000;
            double fee = rhu(margin * lev * R.COIN_FEE);
            if (margin < 10000 || margin + fee > S.cash || !tkOpen(tk)) return null;
            lev = Math.Min(lev, D.TK[tk].maxLev);
            double mult = has("allin") && margin + fee >= S.cash * 0.95 ? 1.5 : 1;
            var c = new CoinPos { id = S.pid++, tk = tk, dir = dir, lev = lev, margin = margin, entry = S.mk.tk[tk].p, mult = mult, t0 = Tnow(),
                bonus = has("kimp") && dir > 0 && S.kimpDay != absDay() ? Math.Min(300000, rhu(margin * 0.05)) : 0 };
            if (c.bonus != 0) S.kimpDay = absDay();
            S.cash -= margin + fee; S.cps.Add(c); S.st.invest++; S.workStreak = 0; S.invIn = S.invIn + margin; S.realized -= fee;
            if (lev >= R.ADD_COIN_LEV) { double f = Math.Min(1, margin / Math.Max(1, S.cash + margin + fee)); addict(R.Gain("coin") * (0.1 + 0.9 * f * f) * (has("addict") ? 1.5 : 1)); }
            if (mult > 1) augFx("allin", T("aug.allin"));
            if (c.bonus != 0) augFx("kimp", T("aug.kimp", "m", man(c.bonus)));
            return c;
        }
        double? closeCoin(CoinPos c, bool force = false)
        {
            if (!force && c.t0 == Tnow()) return null;
            double pnl = cpnl(c);
            if (pnl > 0 && c.dir < 0 && has("inverse")) { pnl *= 1.25; augFx("inverse", T("aug.short")); }
            double fee = rhu(c.margin * c.lev * R.COIN_FEE);
            double back = rhu(Math.Max(0, c.margin + pnl + c.bonus - fee));
            S.cash += back; S.cps.Remove(c);
            S.today.Add(new Ledger { kind = "invest", amt = back - c.margin, label = T("lbl.close", "n", D.TK[c.tk].name, "lev", c.lev, "d", T(c.dir > 0 ? "long" : "short")) }); S.realized += back - c.margin - c.bonus;
            S.st.iN++; if (back > c.margin) S.st.iW++;
            return back - c.margin;
        }
        double closeAll()
        {
            double t = 0;
            foreach (var k in STK().ToList()) if (S.hold.Has(k)) t += sellStock(k, 1, R.FEE_APP, true) ?? 0;
            foreach (var c in S.cps.ToList()) t += closeCoin(c, true) ?? 0;
            return t;
        }
    }
}
