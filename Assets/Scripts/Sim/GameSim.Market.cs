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
            double v = rtVol();
            var rg = v4 ? regNow() : null; if (rg != null) v *= rg[2];   // v4 장별 시장 국면 (판마다 시나리오)
            double mret = M.reg * 0.0027 + gauss() * (evening ? 0.0092 : 0.0058) * v + sh(shock, "MKT") + (rg != null ? rg[0] * p2reg() : 0);
            bool whale = evening && S.mk == M && has("whale");
            var P = new MarketPlan { whale = whale };
            foreach (var t in D.TKList)
            {
                string k = t.id; var s = M.tk[k];
                if (rnd() > (t.type == "coin" ? 0.85 : 0.9)) s.tr = -s.tr;
                double r;
                if (t.inv) r = (t.of != null && P.r.ContainsKey(t.of) ? -2 * P.r[t.of] : -2 * mret) - 0.001 + gauss() * t.vol * v;
                else if (t.meme) r = S.rt ? (rnd() < R.RT_MEME_UP ? 0.4 + rnd() * 0.4 : -(0.3 + rnd() * 0.3)) : rnd() < 0.46 ? 0.45 + rnd() * 0.45 : -(0.28 + rnd() * 0.3);   // 실시간: 기대값 ≈ 0 (예전엔 칸당 +8% 라 몰빵이 정답)
                else if (t.type == "stock") r = t.beta * mret + s.tr * t.tr + gauss() * t.vol * v * (evening ? 1.3 : 1);
                else r = (s.tr * t.tr + gauss() * t.vol * v) * (whale ? (S.rt ? R.RT_WHALE_VOL : 2) : 1) + (rg != null ? rg[1] * p2reg() : 0);
                Op op0 = v4 && M == S.mk ? opOf(k) : null;
                if (op0 != null) r = opSlotR(op0, t, s, P);   // 작전 종목: 세력이 정한 길 (rng 는 위에서 평소대로 씀). 리포트 발표 충격은 아래에서 그 위에 얹힘
                if (!(t.inv && t.of != null) && !(op0 != null && opLocked(k))) r += sh(shock, k);   // 하한가에 잠긴 동안은 충격도 안 먹음
                r = wkGap(t, r, M);   // v4 주말 휴장: 국장은 안 움직이고 월요일 오전에 몰아서
                P.r[k] = clamp(r, -0.7, 1.5);
                double wig = t.vol * (whale ? (S.rt ? R.RT_WHALE_VOL : 2) : 1) * (0.2 + rnd() * 0.6);
                double w0 = wig * rnd(); double w1 = wig * rnd();
                P.w[k] = new[] { w0, w1 };
            }
            if (v4 && M == S.mk) S.gapT = Tnow();
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
            else if (S.news != null && v4 && R.V4_FAKE_HI > 0) sh0[S.news.tk] = sh(sh0, S.news.tk) - S.news.r * (R.V4_FAKE_LO + rnd() * (R.V4_FAKE_HI - R.V4_FAKE_LO));   // v4 가짜 속보 = 선반영 후 되돌림 (반대로 움직임 → 좋은 뉴스마다 사는 게 정답이 아님)
            S.mplan = planMarket(sh0, isEve()); S.mplan.T = T; planEvents(S.mplan); return S.mplan;
        }
        /// v4 칸 안 흐름: 속보 종목은 경유점을 거쳐 움직이고 (가짜 = 먼저 뉴스 방향으로 튀었다 되돌림), 중간에 후속 속보(확정/부인)가 뜰 수 있음.
        /// 뽑기는 씨앗 해시 (rng 흐름 안 건드림)
        void planEvents(MarketPlan P)
        {
            if (!v4 || !S.rt) return;
            var n = S.news; int T = Tnow();
            // 분석가 리포트 결과가 이번 칸이면: 칸 안 어느 순간에 발표 → 갭 (맞으면 리포트 방향, 틀리면 반대)
            foreach (var t in S.tips)
            {
                if (t.Tr != T || !string.IsNullOrEmpty(t.res) || (t.kind != "real" && t.kind != "anti") || !srcOf(t).an || !P.r.ContainsKey(t.tk)) continue;
                double js = (t.kind == "real" ? 1 : -1) * t.dir * t.mag, uj = 0.15 + 0.7 * hashU(T * 613 + t.id * 31);
                // 같은 종목에 발표가 여럿이면 각자 자기 순간에 따로 뜀 ([u1, 충격1, u2, 충격2, …] 시간순)
                var L0 = P.jmp.TryGetValue(t.tk, out var j0) ? j0.ToList() : new List<double>();
                int at = 0; while (at < L0.Count && L0[at] <= uj) at += 2;
                L0.Insert(at, uj); L0.Insert(at + 1, js); P.jmp[t.tk] = L0.ToArray();
                P.evs.Add(new PlanEv { u = uj, k = "report", tk = t.tk, ok = t.kind == "real", id = t.id });
            }
            if (n != null && n.tk != "MKT" && D.TK.TryGetValue(n.tk, out var nt) && !nt.meme && P.r.ContainsKey(n.tk) && tkOpen(n.tk) && R.V4_EARLY != null && R.V4_EARLY.Length == 2)
            {
                // 초반엔 진짜든 가짜든 뉴스 방향으로 조금 가거나 흔들림 (같은 분포) → 진짜는 그 뒤로 쭉, 가짜는 되돌림. 초반 시세만 보고는 못 가리고, 후속 속보·출처로 가려야 함
                var ns = S.mk.tk[n.tk]; double so0 = ns.sT == T && ns.so > 0 ? ns.so : ns.p;   // 칸 시가 (칸 중간에 다시 짜는 경우엔 이미 잡힌 시가)
                var JJ = jmpLogs(P, nt, ns, so0);
                double X1 = Math.Log(Math.Max(1e-9, rtCloseAt(nt, ns, P, so0) / so0)) - (JJ?.Sum() ?? 0), N = Math.Log(1 + Math.Abs(n.r)) * n.dir, e0 = N * (R.V4_EARLY[0] + hashU(T * 211 + 41) * (R.V4_EARLY[1] - R.V4_EARLY[0]));
                P.way[n.tk] = n.fake ? new[] { 0.3, e0, 0.6, e0 * 0.3 + X1 * 0.4 } : new[] { 0.3, e0, 0.7, e0 + (X1 - e0) * 0.75 };
                if (hashU(T * 131 + 17) < R.V4_FOLLOW_P) P.evs.Add(new PlanEv { u = 0.35, k = "follow", tk = n.tk, ok = hashU(T * 389 + 71) < R.V4_FOLLOW_ACC ? !n.fake : n.fake });   // 후속 속보도 가끔 틀림
            }
        }
        /// 발표 갭들의 로그 크기 (시간순). 가격제한(주식)·바닥을 적용한 값으로 — 발표 몫을 하나씩 뺀 종가들의 비
        double[] jmpLogs(MarketPlan P, Ticker t, TkState s, double so)
        {
            if (P.jmp == null || !P.jmp.TryGetValue(t.id, out var j) || !P.r.TryGetValue(t.id, out var r)) return null;
            int n = j.Length / 2; var J = new double[n]; double rest = 0;
            for (int i = 0; i < n; i++) rest += j[2 * i + 1];
            double lv(double rr) { double c = Math.Max(so * (1 + rr), t.p0 * 0.001); return t.IsStock ? limit(s, c) : c; }
            double prev = lv(r - rest);
            for (int i = 0; i < n; i++) { rest -= j[2 * i + 1]; double cur = lv(r - rest); J[i] = Math.Log(cur / prev); prev = cur; }
            return J;
        }
        /// 시가 so 기준 계획 종가 (rtClose 와 같은 규칙)
        double rtCloseAt(Ticker t, TkState s, MarketPlan P, double so) { double c = Math.Max(so * (1 + P.r[t.id]), t.p0 * 0.001); return t.IsStock ? limit(s, c) : c; }
        MarketPlan curPlan() => (S.mplan != null && S.mplan.T == Tnow()) ? S.mplan : planNext();
        MarketState initMarket()
        {
            var M = new MarketState { reg = rnd() < 0.6 ? 1 : -1 };
            foreach (var t in D.TKList) M.tk[t.id] = new TkState { p = t.p0, tr = rnd() < 0.5 ? 1 : -1 };
            if (S.rt) rtInitMarket(M);
            else for (int i = 0; i < 14; i++) stepMarket(new Dictionary<string, double>(), i % R.SLOTS == R.SLOTS - 1, M);
            return M;
        }
        void addShock(int T, string tk, double r)
        {
            if (S.mplan != null && S.mplan.T == T)
            {
                S.mplan.r[tk] = clamp(S.mplan.r[tk] + r, -0.7, 1.5);
                foreach (var t in D.TKList.Where(x => x.inv && x.of == tk)) S.mplan.r[t.id] = clamp(S.mplan.r[t.id] - 2 * r, -0.7, 1.5);   // 곱버스는 따라가는 종목 반대로
                return;
            }
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
            if (S.llm) return genNewsLlm();
            if (rnd() > (v4 ? R.V4_NEWS_P : 0.32)) return null;
            var pool = TKS().Where(k => k != "INV" && tkOpen(k) && opOf(k) == null).Concat(new[] { "MKT" }).ToList();   // 작전 중인 종목엔 속보를 안 붙임
            if (v4 && R.V4_NEWS_COIN_W > 1) { var coins = pool.Where(k => k != "MKT" && D.TK[k].IsCoin && !D.TK[k].meme).ToList(); for (int i = 1; i < R.V4_NEWS_COIN_W; i++) pool.AddRange(coins); }   // 레버리지를 걸 수 있는 코인 속보를 더 자주
            string tk = pick(pool);
            var nw = pick(D.NEWS[tk]);
            if (v4) { int want = newsDir(); var same = D.NEWS[tk].Where(x => x.dir == want).ToList(); if (same.Count > 0) nw = pick(same); }   // v4: 장별 국면 = 뉴스 방향 편향
            D.TK.TryGetValue(tk, out var t);
            double mag = (tk == "MKT" ? 0.02 + rnd() * 0.02 : t.type == "stock" ? 0.05 + rnd() * 0.07 : t.meme ? 0.4 : 0.07 + rnd() * 0.09) * (t != null ? t.nmag : 1);
            if (v4 && t != null && t.IsCoin && !t.meme) mag *= R.V4_NEWS_COIN_MAG;   // 코인 속보는 자주 뜨는 대신 한 번의 크기는 작게 (들고 자리를 비운 사람에겐 속보가 잡음)
            var n = new News { tk = tk, h = nw.h, dir = nw.dir, r = nw.dir * mag, fake = rnd() < 0.3 };
            logNews(n);
            return n;
        }
    }
}
