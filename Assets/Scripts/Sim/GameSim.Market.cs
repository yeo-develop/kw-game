using System;
using System.Collections.Generic;
using System.Linq;

namespace KwGame.Sim
{
    // market.js — 칸 시작에 시세 계획(planMarket), 칸 끝에 적용(applyMarket)
    public partial class GameSim
    {
        static double sh(Dictionary<string, double> d, string k) => d != null && d.TryGetValue(k, out var v) ? v : 0;

        MarketPlan planMarket(Dictionary<string, double> shock, bool evening, MarketState M = null)
        {
            M = M ?? S.mk;
            if (rnd() > 0.9) M.reg = -M.reg;
            double mret = M.reg * 0.0027 + gauss() * (evening ? 0.0092 : 0.0058) + sh(shock, "MKT");
            bool whale = evening && S.mk == M && has("whale");
            var P = new MarketPlan { whale = whale };
            foreach (var t in D.TKList)
            {
                string k = t.id; var s = M.tk[k];
                if (rnd() > (t.type == "coin" ? 0.85 : 0.9)) s.tr = -s.tr;
                double r;
                if (t.inv) r = -2 * mret - 0.001 + gauss() * t.vol;
                else if (t.meme) r = rnd() < 0.46 ? 0.45 + rnd() * 0.45 : -(0.28 + rnd() * 0.3);
                else if (t.type == "stock") r = t.beta * mret + s.tr * t.tr + gauss() * t.vol * (evening ? 1.3 : 1);
                else r = (s.tr * t.tr + gauss() * t.vol) * (whale ? 2 : 1);
                r += sh(shock, k);
                P.r[k] = clamp(r, -0.7, 1.5);
                double wig = t.vol * (whale ? 2 : 1) * (0.2 + rnd() * 0.6);
                double w0 = wig * rnd(); double w1 = wig * rnd();
                P.w[k] = new[] { w0, w1 };
            }
            return P;
        }
        Dictionary<string, Move> applyMarket(MarketPlan P, MarketState M = null)
        {
            M = M ?? S.mk;
            var outp = new Dictionary<string, Move>();
            foreach (var t in D.TKList)
            {
                string k = t.id; var s = M.tk[k];
                double o = s.p, c = Math.Max(o * (1 + P.r[k]), t.p0 * 0.001);
                double h = Math.Max(o, c) * (1 + P.w[k][0]), l = Math.Min(o, c) * (1 - P.w[k][1]);
                s.hist.Add(new Candle { o = o, h = h, l = l, c = c }); if (s.hist.Count > 40) s.hist.RemoveAt(0);
                s.p = c; outp[k] = new Move { o = o, c = c, h = h, l = l, r = c / o - 1 };
            }
            return outp;
        }
        Dictionary<string, Move> stepMarket(Dictionary<string, double> shock, bool evening, MarketState M) => applyMarket(planMarket(shock, evening, M), M);
        MarketPlan planNext()
        {
            int T = Tnow();
            var sh0 = S.shocks.TryGetValue(T, out var o) ? new Dictionary<string, double>(o) : new Dictionary<string, double>();
            S.shocks.Remove(T);
            if (S.news != null && !S.news.fake) sh0[S.news.tk] = sh(sh0, S.news.tk) + S.news.r;
            S.mplan = planMarket(sh0, isEve()); S.mplan.T = T; return S.mplan;
        }
        MarketPlan curPlan() => (S.mplan != null && S.mplan.T == Tnow()) ? S.mplan : planNext();
        MarketState initMarket()
        {
            var M = new MarketState { reg = rnd() < 0.6 ? 1 : -1 };
            foreach (var t in D.TKList) M.tk[t.id] = new TkState { p = t.p0, tr = rnd() < 0.5 ? 1 : -1 };
            for (int i = 0; i < 14; i++) stepMarket(new Dictionary<string, double>(), i % R.SLOTS == R.SLOTS - 1, M);
            return M;
        }
        void addShock(int T, string tk, double r)
        {
            if (S.mplan != null && S.mplan.T == T) { S.mplan.r[tk] = clamp(S.mplan.r[tk] + r, -0.7, 1.5); return; }
            if (!S.shocks.TryGetValue(T, out var o)) S.shocks[T] = o = new Dictionary<string, double>();
            o[tk] = sh(o, tk) + r;
        }
        bool liqHit(CoinPos c, Move mv, double vol)
        {
            double L = liqPx(c), sg = vol * R.INTRA;
            double a = c.dir > 0 ? Rng.PLog(mv.o / L) : Rng.PLog(L / mv.o);
            double b = c.dir > 0 ? Rng.PLog(mv.c / L) : Rng.PLog(L / mv.c);
            if (a <= 0 || b <= 0) return true;
            return rnd() < Rng.PExp(-2 * a * b / (sg * sg));
        }
        News genNews()
        {
            if (rnd() > 0.32) return null;
            var pool = TKS().Where(k => k != "INV" && tkOpen(k)).Concat(new[] { "MKT" }).ToList();
            string tk = pick(pool);
            var nw = pick(D.NEWS[tk]);
            D.TK.TryGetValue(tk, out var t);
            double mag = tk == "MKT" ? 0.02 + rnd() * 0.02 : t.type == "stock" ? 0.05 + rnd() * 0.07 : t.meme ? 0.4 : 0.07 + rnd() * 0.09;
            return new News { tk = tk, h = nw.h, dir = nw.dir, r = nw.dir * mag, fake = rnd() < 0.3 };
        }
    }
}
