using System;
using System.Collections.Generic;
using System.Linq;

namespace KwGame.Sim
{
    // games.js — 알바(미니게임 판) · 카지노 · 경마 · 즉석 복권 · 빚또
    public partial class GameSim
    {
        /// 여러 단계 행동의 결과: err (잘못된 명령) 또는 done (칸을 썼는지). 둘 다 없으면 계속.
        public class Sub { public string err; public bool? done; public static Sub Done(bool d) => new Sub { done = d }; public static Sub Err(string e) => new Sub { err = e }; public static Sub Go() => new Sub(); }

        // ---------- 알바 ----------
        public double mgHard() => 1 + (S.month - 1) * 0.08 + Math.Min(4, Math.Max(0, S.workStreak - 1)) * 0.03;
        void workStart(string key, string loc)
        {
            var J = D.JOBS[key];
            S.lastJob = key;
            scene(J.bg, "face", "tired", "mode", "loc");
            M(pick(J.lines), "angry"); hideDlg();
            S.pending = new Pending("work") { key = key, loc = loc, setup = null };
        }
        WorkSetup workSetup(bool practice)
        {
            var P = S.pending; double H = mgHard();
            WorkSetup su;
            if (P.key == "cafe")
            {
                Func<int[]> mk = () => { var c = new int[5]; int n = 3 + (int)Math.Floor(rnd() * 3); for (int i = 0; i < n; i++) c[(int)Math.Floor(rnd() * 5)]++; return c; };
                var o1 = mk(); var o2 = mk(); var o3 = mk();
                su = new WorkSetup { H = H, orders = new List<int[]> { o1, o2, o3 } };
            }
            else if (P.key == "store") { double a = rnd(), b = rnd(), c = rnd(), d = rnd(), e = rnd(); su = new WorkSetup { H = H, u = new[] { a, b, c, d, e } }; }
            else if (P.key == "mart")
            {
                int n = (int)rhu(14 * H); var drops = new List<double[]>();
                for (int i = 0; i < n; i++)
                {
                    double t = rhu((0.04 + 0.88 * i / n + rnd() * 0.05) * 1000) / 1000;
                    double x = rhu(rnd() * 1000) / 1000;
                    double k = rnd() < 0.3 ? 1 : 0;
                    drops.Add(new[] { t, x, k });
                }
                su = new WorkSetup { H = H, drops = drops };
            }
            else su = new WorkSetup { H = H, w = rnd() };
            su.hp = S.hp; su.hpm = hpMult();
            su.practice = practice;
            P.setup = su;
            return su;
        }
        Sub workResult(double score)
        {
            var P = S.pending; var J = D.JOBS[P.key]; string key = P.key;
            score = clamp(double.IsNaN(score) ? 0 : score, 0, 1);
            double hm = hpMult(), sc = score * hm;
            double pay = round1k(J.@base + J.var * sc);
            if (has("grind")) { pay = round1k(pay * R.GRIND_PAY); augFx("grind", T("aug.grind")); }
            S.st.work++; S.st.earned += pay; S.workStreak++;
            money(pay, "work", T("lbl.work", "n", J.name, "p", rhu(sc * 100)));
            hp(-jobHp(J), T("why.work"));
            galReact("work", V("amt", man(pay) + D.U("won"), "int", man(interestDue()) + D.U("won"), "pct", JsFmt.ToFixed(pay / Math.Max(1, interestDue()) * 100, 1), "conv", conv(pay)), 2);
            stress(5 + 2 * Math.Min(S.workStreak - 1, 4));
            if (hm < 1) bubble(T("work.tired", "p", rhu((1 - hm) * 100)), 2500, "tired");
            else if (S.workStreak >= 5) bubble(T("work.slave", "n", S.workStreak), 2500, "angry");
            if (sc >= 0.7) M(T("work.good", "pay", won(pay), "c", conv(pay), "x50", man(pay * 50)), "smug");
            else M(T("work.bad", "pay", won(pay), "c", conv(pay)), "angry");
            pushK("m", T(key == "ware" ? "work.kWare" : "work.k"));
            hideDlg();
            return Sub.Done(true);
        }

        static bool isBig(double net, double before) => Math.Abs(net) >= 1000000 || (Math.Abs(net) >= 300000 && Math.Abs(net) >= Math.Max(1, before) * 0.5);
        void gambled(string kind, double net, double before, double? staked = null)
        {
            double m = has("addict") ? 1.5 : 1;
            S.st.gnet += net; S.workStreak = 0;
            double a = R.Gain(kind) * (staked != null && before > 0 ? 0.1 + 0.9 * sq(Math.Min(1, staked.Value / before)) : 1);
            if (net > 0 && isBig(net, before)) a += R.Gain("bigwin") * (S.st.bigWin < 1 ? 1.5 : 1);
            else if (net < 0 && isBig(net, before)) a += R.Gain("bigloss");
            addict(a * m);
            hp(-hpCost(kind));
        }

        // ---------- 카지노 ----------
        public static double hlMult(int a, bool hi) { int n = hi ? 13 - a : a - 1; return n <= 0 ? 0 : Math.Min(11, Math.Floor(0.95 * 12 / n * 100) / 100); }
        public static int ladderEnd(IList<int> rungs, int choice) { int lane = choice; foreach (var r in rungs) { if (r == lane) lane = r + 1; else if (r >= 0 && r + 1 == lane) lane = r; } return lane; }
        void casinoStart(string kind, string loc)
        {
            Emit("face", "f", "smug"); bubble(fpick(D.ML["preG"]), 2200, "smug");
            int A = 1 + (int)Math.Floor(rnd() * 13), As = (int)Math.Floor(rnd() * 4);
            S.pending = new Pending("casino") { kind = kind, loc = loc, A = A, As = As, rounds = 0, total = 0, staked = 0, before = S.cash, jackpot = false };
        }
        Sub casinoBet(double stake, int choice)
        {
            var P = S.pending; string kind = P.kind;
            stake = Math.Floor(double.IsNaN(stake) ? 0 : stake);
            if (stake < 10000 || stake > S.cash) return Sub.Err("stake");
            S.cash -= stake; Emit("stake", "stake", stake);
            double mult = 0, extra = 0; string txt = ""; Dictionary<string, object> show = new Dictionary<string, object>();
            if (kind == "oddeven")
            {
                bool win = rnd() < 0.495, odd = win ? choice == 1 : choice != 1;
                int n = 1 + (int)Math.Floor(rnd() * 10) * 2; if (!odd) n += 1;
                mult = win ? 2 : 0; txt = T("cas.oddeven", "n", n, "s", T(odd ? "cas.odd" : "cas.even")); show = V("n", n);
            }
            if (kind == "card")
            {
                int A = P.A, B = 1 + (int)Math.Floor(rnd() * 13), Bs = (int)Math.Floor(rnd() * 4); double m = hlMult(A, choice == 1);
                if (B == A) { mult = 1; txt = T("cas.cardSame", "a", D.RK[A], "b", D.RK[B]); }
                else { bool w = choice == 1 ? B > A : B < A; mult = w ? m : 0; txt = T(w ? "cas.cardHit" : "cas.cardMiss", "a", D.RK[A], "b", D.RK[B]); }
                show = V("A", A, "As", P.As, "B", B, "Bs", Bs);
                P.A = B; P.As = Bs;
            }
            if (kind == "slot")
            {
                var SY = D.SLOT_SYM; double r = rnd(); List<string> res;
                Func<string, List<string>> three = s => new List<string> { s, s, s };
                if (r < 0.01) { res = three(SY[3]); mult = 50; P.jackpot = true; }
                else if (r < 0.035) { res = three(SY[2]); mult = 8; }
                else if (r < 0.085) { res = three(pick(new[] { SY[0], SY[1] })); mult = 4; }
                else if (r < 0.105) { res = three(SY[4]); mult = 0; extra = stake; }
                else if (r < 0.305)
                {
                    string a = pick(SY); string b = pick(SY.Where(x => x != a).ToList()); res = new List<string> { a, a, b };
                    int k = (int)Math.Floor(rnd() * 3); var tmp = res[k]; res[k] = res[2]; res[2] = tmp; mult = 0.5;
                }
                else
                {
                    var pool = SY.ToList(); res = new List<string>();
                    for (int i = 0; i < 3; i++) { int j = (int)Math.Floor(rnd() * pool.Count); res.Add(pool[j]); pool.RemoveAt(j); }
                    mult = 0;
                }
                txt = string.Join(" ", res) + (mult >= 50 ? T("cas.jackpot") : extra != 0 ? T("cas.crash") : ""); show = V("res", res);
            }
            if (kind == "ladder")
            {
                int prize = (int)Math.Floor(rnd() * 3); var rungs = new List<int>();
                for (int lv = 0; lv < 5; lv++) { double r = rnd(); rungs.Add(r < 0.42 ? 0 : r < 0.84 ? 1 : -1); }
                int endLane = ladderEnd(rungs, choice);
                mult = endLane == prize ? 2.8 : 0; txt = T(mult != 0 ? "cas.ladHit" : "cas.ladMiss", "c", "ABC"[Math.Max(0, Math.Min(2, choice))].ToString(), "e", endLane + 1); show = V("prize", prize, "rungs", rungs, "endLane", endLane);
            }
            if (mult > 1 && has("addict")) { mult = 1 + (mult - 1) * 1.1; augFx("addict", T("aug.addictWin")); }
            double payout = rhu(stake * mult) - extra, net = payout - stake;
            S.cash += payout; coverNeg(); P.total += net; P.staked += stake; P.rounds++;
            if (S.st.g == null) S.st.g = new Dictionary<string, double[]>();
            if (!S.st.g.TryGetValue(kind, out var gk)) S.st.g[kind] = gk = new double[3];
            gk[0] += stake; gk[1] += net; gk[2]++;
            S.st.gN++; if (net > 0) S.st.gW++;
            Emit("casino", "kind", kind, "stake", stake, "choice", choice, "mult", mult, "net", net, "txt", txt, "show", show, "total", P.total, "rounds", P.rounds);
            if (P.rounds >= 3 || S.cash < 10000) return casinoEnd();
            return Sub.Go();
        }
        Sub casinoEnd()
        {
            var P = S.pending;
            Emit("panelEnd", "k", "casino");
            if (P.rounds == 0) return Sub.Done(false);
            S.st.gamble++;
            var title = D.CAS_TITLE[P.kind];
            S.today.Add(new Ledger { kind = "gamble", amt = P.total, label = T("lbl.casino", "n", title.Substring(Math.Min(2, title.Length)).Trim(), "r", P.rounds) });
            gambled("casino", P.total, P.before, P.staked);
            react(P.total, new ReactCtx { before = P.before, gamble = true, jackpot = P.jackpot });
            return Sub.Done(true);
        }

        // ---------- 경마 ----------
        void raceStart(string loc)
        {
            var names = D.HORSES.ToList(); var H = new List<Horse>();
            for (int i = 0; i < 5; i++) { int j = (int)Math.Floor(rnd() * names.Count); string nm = names[j]; names.RemoveAt(j); double w = 0.08 + sq(rnd()) * 3; H.Add(new Horse { name = nm, w = w }); }
            double sw = 0; foreach (var h in H) sw = sw + h.w;
            foreach (var h in H) { h.p = h.w / sw; h.odds = clamp(rhu(0.85 / h.p * 10) / 10, 1.2, 50); }
            S.pending = new Pending("race") { loc = loc, H = H, race = absDay() };
        }
        Sub raceBet(double choiceD, double stake)
        {
            var P = S.pending; var H = P.H;
            stake = Math.Floor(double.IsNaN(stake) ? 0 : stake);
            if (!(choiceD >= 0 && choiceD < 5) || stake < 10000 || stake > S.cash) return Sub.Err("stake");
            int choice = (int)choiceD;
            double before = S.cash;
            S.cash -= stake; Emit("stake", "stake", stake);
            double r = rnd(); int win = 0; for (int i = 0; i < 5; i++) { r -= H[i].p; if (r <= 0) { win = i; break; } win = i; }
            double mult = choice == win ? H[choice].odds : 0;
            if (mult > 1 && has("addict")) { mult = 1 + (mult - 1) * 1.1; augFx("addict", T("aug.addictWin")); }
            double payout = rhu(stake * mult), net = payout - stake;
            S.cash += payout;
            if (S.st.g == null) S.st.g = new Dictionary<string, double[]>();
            if (!S.st.g.TryGetValue("race", out var gk)) S.st.g["race"] = gk = new double[3];
            gk[0] += stake; gk[1] += net; gk[2]++;
            Emit("race", "choice", choice, "win", win, "net", net, "stake", stake);
            S.st.gamble++; S.st.race++; S.st.gN++; if (net > 0) S.st.gW++;
            S.today.Add(new Ledger { kind = "gamble", amt = net, label = T("lbl.race", "n", H[choice].name, "o", H[choice].odds) });
            gambled("race", net, before, stake);
            galReact("race", V("horse", H[choice].name), 1);
            react(net, new ReactCtx { before = before, gamble = true });
            return Sub.Done(true);
        }

        // ---------- 즉석 복권 ----------
        void scratchStart(string loc) => S.pending = new Pending("scratch") { loc = loc, n = 0, spent = 0, got = 0, card = null };
        Sub scratchBuy()
        {
            var P = S.pending; double price = R.SCRATCH_PRICE;
            if (P.n >= R.SCRATCH_MAX || S.cash < price || (P.card != null && !P.card.done)) return Sub.Err("buy");
            S.cash -= price; P.spent += price; P.n++; S.st.lotto++;
            double r = rnd(); (string s, double amt, double p)? prize = null;
            foreach (var pz in D.SC_PRIZE) { if (r < pz.p) { prize = pz; break; } r -= pz.p; }
            var all = D.SCRATCH_SYM;
            List<string> sym;
            if (prize != null)
            {
                var fl = all.Where(s => s != prize.Value.s).ToList();
                string a = pick(fl), b = pick(fl), c = pick(fl);
                sym = new List<string> { prize.Value.s, prize.Value.s, prize.Value.s, a, b, c };
            }
            else
            {
                var pool = all.SelectMany(s => new[] { s, s }).ToList(); sym = new List<string>();
                for (int k = 0; k < 6; k++) { int j = (int)Math.Floor(rnd() * pool.Count); sym.Add(pool[j]); pool.RemoveAt(j); }
            }
            if (prize != null)
            {
                var f = sym.Skip(3).ToList(); var cnt = new Dictionary<string, int>();
                foreach (var s in f) cnt[s] = (cnt.TryGetValue(s, out var v) ? v : 0) + 1;
                if (cnt.Values.Any(v => v >= 3)) sym[5] = all.FirstOrDefault(s => s != prize.Value.s && s != sym[3]);
            }
            for (int k = 5; k > 0; k--) { int j = (int)Math.Floor(rnd() * (k + 1)); var tmp = sym[k]; sym[k] = sym[j]; sym[j] = tmp; }
            P.card = new ScratchCard { sym = sym, prize = prize, done = false };
            return Sub.Go();
        }
        Sub scratchReveal()
        {
            var P = S.pending; var c = P.card;
            if (c == null || c.done) return Sub.Err("card");
            c.done = true;
            if (c.prize != null) { S.cash += c.prize.Value.amt; P.got += c.prize.Value.amt; if (c.prize.Value.amt >= 500000) bubble(T("sc.big"), 2000, "flex"); }
            else bubble(fpick(TA("sc.miss")), 1600, "tired");
            Emit("scratch", "prize", c.prize.HasValue ? (object)new object[] { c.prize.Value.s, c.prize.Value.amt, c.prize.Value.p } : null, "got", P.got);
            return Sub.Go();
        }
        Sub scratchDone()
        {
            var P = S.pending;
            if (P.card != null && !P.card.done) scratchReveal();
            Emit("panelEnd", "k", "scratch");
            if (P.n == 0) return Sub.Done(false);
            S.today.Add(new Ledger { kind = "gamble", amt = P.got - P.spent, label = T("lbl.scratch", "n", P.n) });
            S.st.gN++; if (P.got > P.spent) S.st.gW++;
            gambled("scratch", P.got - P.spent, P.spent);
            if (P.got >= 500000) react(P.got - P.spent, new ReactCtx { before = P.spent, jackpot = P.got >= 1e7 });
            else
            {
                galReact("lotto", null, 1);
                M(P.got > P.spent ? T("sc.win", "a", won(P.got - P.spent)) : T("sc.lose", "a", won(P.spent - P.got), "c", conv(P.spent - P.got)), P.got > P.spent ? "smug" : "tired"); hideDlg();
            }
            return Sub.Done(true);
        }

        // ---------- 빚또 ----------
        List<int> lottoNums() { var pool = Enumerable.Range(1, 20).ToList(); var o = new List<int>(); for (int i = 0; i < 4; i++) { int j = (int)Math.Floor(rnd() * pool.Count); o.Add(pool[j]); pool.RemoveAt(j); } o.Sort(); return o; }
        public int lottoToday() => S.lotto.Count(t => t.d == absDay());
        void lottoStart(string loc) => S.pending = new Pending("lotto") { loc = loc, n = 0 };
        Sub lottoBuy(int k)
        {
            var P = S.pending; double price = R.LOTTO_PRICE;
            for (int i = 0; i < k; i++) { if (lottoToday() >= R.LOTTO_MAX || S.cash < price) break; S.cash -= price; P.n++; S.st.lotto++; S.lotto.Add(new LottoTicket { d = absDay(), n = lottoNums() }); }
            return Sub.Go();
        }
        Sub lottoDone()
        {
            var P = S.pending;
            Emit("panelEnd", "k", "lotto");
            if (P.n == 0) return Sub.Done(false);
            S.today.Add(new Ledger { kind = "gamble", amt = -P.n * R.LOTTO_PRICE, label = T("lbl.lotto", "n", P.n) });
            gambled("lotto", 0, 0); S.st.gnet -= P.n * R.LOTTO_PRICE;
            galReact("lotto", null, 1);
            M(T("lotto.bought", "n", P.n), "smug"); hideDlg();
            return Sub.Done(true);
        }
        void lottoDraw()
        {
            int ad = absDay();
            var mine = S.lotto.Where(t => t.d == ad).ToList(); S.lotto = S.lotto.Where(t => t.d > ad).ToList();
            if (mine.Count == 0) return;
            var win = lottoNums(); double tot = 0;
            var rows = mine.Select(t => { int m = t.n.Count(x => win.Contains(x)); double pz = D.LOTTO_PRIZE.TryGetValue(m, out var v) ? v : 0; tot += pz; return V("n", t.n, "m", m, "pz", pz); }).ToList();
            if (tot != 0) { S.cash += tot; S.today.Add(new Ledger { kind = "gamble", amt = tot, label = T("lbl.lottoWin") }); }
            S.st.gnet += tot; S.st.gN++; if (tot > mine.Count * R.LOTTO_PRICE) S.st.gW++;
            if (tot >= 1e6) addict(R.Gain("bigwin"));
            pushF("🔮", T("lotto.feed", "w", string.Join("·", win), "r", tot != 0 ? T("lotto.feedWin", "a", won(tot)) : T("lotto.feedNone")), "money");
            Emit("lottoDraw", "win", win, "rows", rows, "tot", tot, "conv", tot != 0 ? conv(tot) : "");
            if (tot >= 1e7) { fx("flex", "amt", tot); galReact("bigwin", V("amt", sgnMan(tot), "conv", conv(tot)), 3); stress(-30); M(T("lotto.first"), "flex"); hideDlg(); }
        }
    }
}
