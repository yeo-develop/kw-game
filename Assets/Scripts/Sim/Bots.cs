using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace KwGame.Sim
{
    /// 헤드리스 봇 (web/tools/bots.mjs @4ff230c). 골든 벡터의 명령열을 만든 봇과 같은 결정을 내린다.
    /// 봇 난수 = JS 의 double LCG ((bs·1103515245 + 12345) % 2^31) 를 double 연산 그대로.
    public class Bots
    {
        static readonly Dictionary<string, string[]> AUGPREF = new Dictionary<string, string[]>
        {
            ["steady"] = new[] { "grind", "ginseng", "vip", "loanbro", "posi", "divi", "hodl", "diverse", "scalp", "insure" },
            ["work"] = new[] { "grind", "ginseng", "posi", "loanbro", "divi", "insure" },
            ["gamble"] = new[] { "addict", "loanbro", "posi", "insure", "allin" },
            ["invest"] = new[] { "rumor", "meme", "whale", "kimp", "vip", "insure", "divi", "diverse", "scalp", "hodl", "inverse", "loanbro", "posi", "grind", "allin", "addict" },
        };
        static readonly string[] STOCKS = { "GSE", "BAT", "GUK", "INV" };
        static readonly string[] JOBS = { "l-cafe", "l-store", "l-ware", "l-mart" };
        const double POT = 15000000;

        public class Result
        {
            public int seed; public string strat, end, variant; public int month, day, steps, errs; public double debt, cash, fame, addict;
            public List<JObject> cmds; public GameSim game;
        }

        class Plan { public int T; public List<object[]> steps = new List<object[]>(); public object[] go; public double repayAmt; public string acted; }

        readonly GameData D; readonly string strat; readonly int seed;
        /// 미니게임 점수 범위 (bots.mjs 의 환경변수 MG="lo,hi", 기본 0.6~0.8)
        double mgLo = 0.6, mgHi = 0.8;
        double bs; GameSim G; GameState S => G.S;
        List<JObject> cmds; int steps, errs;
        Plan plan; double plan_repay;
        readonly Dictionary<int, HashSet<string>> tradeDone = new Dictionary<int, HashSet<string>>();

        Bots(GameData d, int seed, string strat) { D = d; this.seed = seed; this.strat = strat; bs = (uint)unchecked(seed * 7919 + 13); }

        double br() { bs = (bs * 1103515245 + 12345) % 2147483648; return bs / 2147483648; }
        T bpick<T>(IList<T> a) => a[(int)Math.Floor(br() * a.Count)];
        List<SimEvent> go(SimCommand c)
        {
            cmds?.Add(c.J);
            var e = G.Apply(c); steps++;
            foreach (var x in e) if (x.t == "error") errs++;
            return e;
        }
        List<SimEvent> go(string t, params object[] kv) => go(new SimCommand(t, kv));
        int Tnow() => G.Query(() => G.Tnow());

        public static Result Run(GameData data, int seed, string strat, bool record = false, int maxMonth = 12, double mgLo = 0.6, double mgHi = 0.8)
        {
            var b = new Bots(data, seed, strat) { cmds = record ? new List<JObject>() : null, mgLo = mgLo, mgHi = mgHi };
            return b.Play(maxMonth);
        }

        void trade()
        {
            int T = Tnow();
            if (!tradeDone.TryGetValue(T, out var d)) tradeDone[T] = d = new HashSet<string>();
            double E = S.cash + G.Query(() => G.holdVal()), due = G.Query(() => G.interestDue());
            double needCash = (S.paidMonth != S.month && S.day == 7 && S.slot >= 1) ? due * 1.05 : 0;
            bool rich = E >= S.debt + (S.paidMonth != S.month ? due : 0);
            bool open = G.Query(() => G.stockOpen());
            for (int guard = 0; guard < 12; guard++)
            {
                Func<CoinPos, bool> locked = c => c.t0 == Tnow();
                if (rich || (needCash != 0 && S.cash < needCash))
                {
                    var c = S.cps.FirstOrDefault(x => !locked(x)); if (c != null) { go("close", "id", c.id); continue; }
                    if (open) { var k = S.hold.Keys.FirstOrDefault(); if (k != null) { go("sell", "tk", k, "frac", 1, "where", "app"); continue; } }
                    return;
                }
                if (strat == "random")
                {
                    if (d.Count >= 2) return;
                    string tk = bpick(new[] { "GSE", "BAT", "GUK", "INV", "BTK", "TOK" }); d.Add("r" + d.Count);
                    if ((tk == "BTK" || tk == "TOK") && S.cash > 50000)
                    {
                        int dir = bpick(new[] { 1, -1 }); int lev = bpick(new[] { 1, 5, 10, 25, 50 }); double amt = Math.Floor(S.cash * bpick(new[] { 0.1, 0.3, 0.6 }) / 10000) * 10000;
                        go("open", "tk", tk, "dir", dir, "lev", lev, "amt", amt); continue;
                    }
                    if (open && S.cash > 50000) { go("buy", "tk", tk, "amt", Math.Floor(S.cash * 0.2 / 10000) * 10000, "where", "app"); continue; }
                    var c = S.cps.FirstOrDefault(x => !locked(x)); if (c != null) { go("close", "id", c.id); continue; }
                    return;
                }
                bool steady = strat == "steady";
                Func<Tip, bool> good = t => t.tier == "rep" || (!steady && (t.who == "수학자" || (S.srcStat.TryGetValue(t.who, out var g) && g[1] >= 4 && (double)g[0] / g[1] >= 0.62)));
                var tips = G.Query(() => G.activeTips()).Where(good).ToList(); double free = S.cash - needCash;
                var c0 = S.cps.FirstOrDefault(c => !locked(c) && !tips.Any(t => t.tk == c.tk && t.dir == c.dir)); if (c0 != null) { go("close", "id", c0.id); continue; }
                bool did = false;
                if (open)
                {
                    foreach (var k in S.hold.Keys.ToList()) if (!tips.Any(t => t.tk == k && t.dir > 0) && !d.Contains("s" + k)) { d.Add("s" + k); go("sell", "tk", k, "frac", 1, "where", "app"); did = true; break; }
                    if (did) continue;
                    foreach (var t in tips) if (STOCKS.Contains(t.tk) && t.dir > 0 && !S.hold.Has(t.tk) && !d.Contains("b" + t.tk))
                        {
                            d.Add("b" + t.tk); double amt = Math.Floor(Math.Min(E * (steady ? 0.7 : 0.3), free * (steady ? 0.9 : 0.6)) / 10000) * 10000;
                            if (amt >= 50000) { go("buy", "tk", t.tk, "amt", amt, "where", "app"); did = true; break; }
                        }
                    if (did) continue;
                }
                if (steady) return;
                foreach (var t in tips) if (!STOCKS.Contains(t.tk) && !S.cps.Any(c => c.tk == t.tk) && !d.Contains("o" + t.tk))
                    {
                        d.Add("o" + t.tk); double amt = Math.Floor(Math.Min(E * 0.1, free * 0.5) / 10000) * 10000;
                        if (amt >= 50000) { go("open", "tk", t.tk, "dir", t.dir, "lev", 2, "amt", amt); did = true; break; }
                    }
                if (!did) return;
            }
        }

        const double jobCost = 40;
        static object[] St(params object[] a) => a;
        Plan decide()
        {
            var p = new Plan { T = Tnow() };
            double room = G.Query(() => G.loanCap()) - S.debt, due = G.Query(() => G.interestDue()); bool unpaid = S.paidMonth != S.month;
            bool eve = S.slot == 2, stockSlot = G.Query(() => G.stockOpen());
            double hv() => G.Query(() => G.holdVal());
            if (strat == "work")
            {
                if (S.hp < jobCost + 2 || S.stress >= 60) p.steps.Add(St("rest"));
                else p.steps.Add(St("go", "work", bpick(JOBS)));
            }
            else if (strat == "steady")
            {
                // 알바만으론 이자만 막으니 1개월 1일 아침에 사채 400만을 종잣돈으로
                if (S.month == 1 && S.day == 1 && S.slot == 0 && room >= 4000000) { p.steps.Add(St("loan", 3000000.0)); p.steps.Add(St("loan", 1000000.0)); }
                p.steps.Add(St("trade"));
                double reserve = (unpaid ? due : 0) + 200000 + (S.day >= 6 ? due : 0);
                bool rich = S.cash + hv() >= S.debt + (unpaid ? due : 0);
                if (stockSlot && S.debt > 0 && rich && S.cash - (unpaid ? due : 0) >= 10000) { plan_repay = Math.Min(S.debt, Math.Floor((S.cash - (unpaid ? due : 0)) / 10000) * 10000); p.steps.Add(St("go", "bank", "l-repay")); }
                else if (stockSlot && S.cash + hv() - reserve - POT >= 1000000 && S.cash - reserve >= 1000000 && S.debt > 0) { plan_repay = Math.Floor(Math.Min(S.cash - reserve, S.cash + hv() - reserve - POT) / 10000) * 10000; p.steps.Add(St("go", "bank", "l-repay")); }
                else if (S.stress >= 62) p.steps.Add(S.cash > 30000 && br() < 0.4 ? St("go", "pc", "l-pcgame") : St("rest"));
                else if (S.hp < jobCost + 2) p.steps.Add(stockSlot && S.hp >= 12 && S.repT != Tnow() ? St("go", "broker", "l-tip") : St("rest"));
                else if (S.augs.Count == 0 || (S.slot == 1 && S.cash >= 2500000 + reserve && br() < 0.2 && S.augs.Count < 4)) p.steps.Add(St("go", "shop", "l-relic"));
                else p.steps.Add(St("go", "work", bpick(JOBS)));
            }
            else if (strat == "gamble")
            {
                if (S.cash < 3000000) { double r = room; foreach (var L in new[] { 300, 300, 300, 100, 50 }) if (r >= L * 10000) { p.steps.Add(St("loan", (double)(L * 10000))); r -= L * 10000; } }
                if (S.cash >= S.debt + (unpaid ? due : 0) && stockSlot) { plan_repay = Math.Min(S.debt, S.cash); p.steps.Add(St("go", "bank", "l-repay")); }
                else if (S.stress >= 80 || S.hp < 12) p.steps.Add(St("rest"));
                else if (S.cash < 100000 && S.hp >= 45) p.steps.Add(St("go", "work", bpick(JOBS)));
                else if (eve) p.steps.Add(St("go", "casino", bpick(new[] { "l-oddeven", "l-card", "l-slot", "l-ladder" })));
                else if (S.slot == 1) p.steps.Add(br() < 0.5 ? St("go", "casino", bpick(new[] { "l-oddeven", "l-card", "l-ladder" })) : St("go", "race", "l-race"));
                else p.steps.Add(St("go", "lotto", bpick(new[] { "l-lotto", "l-scratch" })));
            }
            else if (strat == "invest")
            {
                double E = S.cash + hv();
                if (S.month <= 2 && S.day == 1 && S.slot == 0 && room >= 3000000 && E > 0) { p.steps.Add(St("loan", 3000000.0)); p.steps.Add(St("loan", 3000000.0)); }
                p.steps.Add(St("trade"));
                bool rich = E >= S.debt + (unpaid ? due : 0);
                if (rich && stockSlot) p.steps.Add(St("go", "bank", "l-repay"));
                else if (S.stress >= 62 || S.hp < jobCost + 2) p.steps.Add(br() < 0.5 && S.cash > 20000 && S.hp >= 20 ? St("go", "pc", "l-pcgame") : St("rest"));
                else if (stockSlot && !S.augs.Contains("rumor") && br() < 0.5) p.steps.Add(St("go", "broker", "l-tip"));
                else p.steps.Add(St("go", "work", bpick(JOBS)));
            }
            else
            {
                if (br() < 0.08 && room >= 1000000) p.steps.Add(St("loan", bpick(new[] { 500000.0, 1000000.0, 3000000.0 })));
                if (br() < 0.3) p.steps.Add(St("trade"));
                if (br() < 0.15 || S.hp < 10) p.steps.Add(St("rest")); else p.steps.Add(St("go", "rand", null));
            }
            if (S.kq != null && br() < (strat == "random" ? 0.5 : 0.8)) p.steps.Insert(0, St("kq", strat == "random" ? (int)Math.Floor(br() * 3) : S.kq.opts.FindIndex(o => o.ok)));
            if (G.Query(() => G.wroteToday()) < 2 && br() < (strat == "work" || strat == "steady" ? 0.15 : 0.35))
            {
                double tp = G.Query(() => G.todayPnl());
                string t = tp <= -50000 ? "loss" : tp >= 50000 ? "gain" : bpick(new[] { "gf", "kim", "water" });
                if (strat == "random") t = bpick(new[] { "gain", "loss", "gf", "water", "kim" });
                p.steps.Insert(0, St("post", t));
            }
            return p;
        }

        Result Play(int maxMonth)
        {
            G = GameSim.Create(D, seed);
            go("start");
            int guard = 0;
            while (S.pending != null && S.pending.t != "ending" && S.month <= maxMonth && guard++ < 200000)
            {
                var P = S.pending;
                switch (P.t)
                {
                    case "relic":
                        {
                            int k = 0;
                            if (strat == "random") k = (int)Math.Floor(br() * P.offer.Count);
                            else { var pref = AUGPREF[strat]; int best = 99; for (int i = 0; i < P.offer.Count; i++) { int r = Array.IndexOf(pref, P.offer[i]), rr = r < 0 ? 50 : r; if (rr < best) { best = rr; k = i; } } }
                            go("pickRelic", "i", k); break;
                        }
                    case "home":
                        {
                            if (plan == null || plan.T != Tnow()) plan = decide();
                            object[] s = null; if (plan.steps.Count > 0) { s = plan.steps[0]; plan.steps.RemoveAt(0); }
                            string s0 = s?[0] as string;
                            if (s == null || s0 == "rest") { go("rest"); break; }
                            if (s0 == "loan") { double amt = (double)s[1]; go("loanOpen"); if (S.debt + amt <= G.Query(() => G.loanCap())) go("borrow", "amt", amt); go("loanDone"); break; }
                            if (s0 == "trade")
                            {
                                if (strat == "invest" || strat == "steady") go("report", "paid", false);
                                if (strat == "steady" && G.Query(() => G.stockOpen()) && S.cash >= 1500000) { go("report", "paid", true); go("report", "paid", true); }
                                trade(); break;
                            }
                            if (s0 == "kq") { go("kqReply", "i", (int)s[1]); break; }
                            if (s0 == "post") { go("post", "k", (string)s[1]); break; }
                            if (s0 == "go") { plan.go = s; plan.repayAmt = plan_repay; plan_repay = 0; go("map"); }
                            break;
                        }
                    case "map":
                        {
                            string loc = plan != null && plan.go != null ? (string)plan.go[1] : "home";
                            var openL = D.LOCList.Where(l => l.open.Contains(S.slot)).Select(l => l.id).ToList();
                            if (loc == "rand") loc = openL.Count > 0 ? bpick(openL) : "home";
                            if (!openL.Contains(loc)) loc = "home";
                            if (plan != null && plan.go != null) plan.go = new object[] { "went", loc, plan.go[2] };
                            if (loc == "home") { go("goTo", "loc", loc); go("rest"); break; }
                            go("goTo", "loc", loc); break;
                        }
                    case "encounter":
                        go("encounter", "ask", strat == "invest" ? !P.opts[0].dis : strat == "random" ? br() < 0.5 && !P.opts[0].dis : false); break;
                    case "loc":
                        {
                            string want = plan != null && plan.go != null ? plan.go[2] as string : null;
                            var opts = G.Query(() => G.locOpts(P.key)).Where(o => !o.dis).Select(o => o.k).ToList();
                            if (plan != null && plan.acted == Tnow() + ":" + P.key) { go("leave"); break; }
                            string k = !string.IsNullOrEmpty(want) && opts.Contains(want) ? want : strat == "random" && opts.Count > 0 ? bpick(opts) : null;
                            if (plan != null) plan.acted = Tnow() + ":" + P.key;
                            if (k != null) go("act", "k", k); else go("leave");
                            break;
                        }
                    case "work": if (P.setup == null) go("mgSetup"); else go("mgResult", "score", mgLo + br() * (mgHi - mgLo)); break;
                    case "relicShop":
                        {
                            if (strat == "steady" && P.bought == 0 && S.cash >= 1500000 + G.Query(() => G.interestDue()))
                            {
                                var ids = (S.relicOffer != null ? S.relicOffer.ids : new List<string>()).Where(id => !S.augs.Contains(id) && AUGPREF["steady"].Contains(id)).ToList();
                                var id0 = ids.FirstOrDefault(x => G.Query(() => G.relicPrice(x)) <= S.cash - 1000000 - G.Query(() => G.interestDue()));
                                if (id0 != null) { go("buyRelic", "id", id0); break; }
                            }
                            if ((strat == "random" || strat == "gamble") && P.pulls < 2 && S.cash >= 500000 && br() < 0.6) { go("gachaRelic"); break; }
                            go("relicDone"); break;
                        }
                    case "tempt":
                        {
                            var ok = P.opts.Where(o => !o.dis).Select(o => o.k).ToList();
                            go("tempt", "k", strat == "gamble" ? (ok.Contains("go") ? "go" : "no") : strat == "random" ? bpick(ok) : "no"); break;
                        }
                    case "impulse": go("reply", "i", strat == "random" || strat == "gamble" ? (int)Math.Floor(br() * 3) : P.opts.FindIndex(o => o.ok)); break;
                    case "casino":
                        {
                            double mx = Math.Floor(S.cash / 10000) * 10000;
                            if (mx < 10000 || (P.rounds > 0 && !(strat == "gamble" || (strat == "random" && br() < 0.5)))) { go("casinoLeave"); break; }
                            double q = strat == "gamble" ? 1 : bpick(new[] { 0.1, 0.5, 1 }); double stake = Math.Max(10000, Math.Floor(mx * q / 10000) * 10000);
                            int ch = P.kind == "card" ? (GameSim.hlMult(P.A, true) != 0 ? (GameSim.hlMult(P.A, false) != 0 ? (P.A <= 7 ? 1 : 0) : 1) : 0) : P.kind == "ladder" ? (int)Math.Floor(br() * 3) : P.kind == "oddeven" ? (int)Math.Floor(br() * 2) : 0;
                            go("bet", "stake", stake, "choice", ch); break;
                        }
                    case "race":
                        {
                            double mx = Math.Floor(S.cash / 10000) * 10000; if (mx < 10000) { go("raceLeave"); break; }
                            int i = 0;
                            if (strat == "work") { for (int j = 0; j < P.H.Count; j++) if (P.H[j].odds < P.H[i].odds) i = j; }
                            else i = (int)Math.Floor(br() * 5);
                            double q = strat == "gamble" ? 1 : bpick(new[] { 0.1, 0.5 }); go("raceBet", "i", i, "stake", Math.Max(10000, Math.Floor(mx * q / 10000) * 10000)); break;
                        }
                    case "scratch": if (P.card != null && !P.card.done) go("scratchReveal"); else if (P.n < (strat == "gamble" ? 5 : 2) && S.cash >= 5000) go("scratchBuy"); else go("scratchDone"); break;
                    case "lotto": if (P.n == 0 && S.cash >= 10000) go("lottoBuy", "k", strat == "gamble" ? 5 : 1); else go("lottoDone"); break;
                    case "repay": go("repay", "amt", plan != null && plan.repayAmt != 0 ? Math.Min(P.mx, plan.repayAmt) : P.mx); break;
                    case "shop": go("shopDone"); break;
                    case "brokerTrade": go("brokerClose"); break;
                    case "menhera": go("reply", "i", strat == "random" ? (int)Math.Floor(br() * 3) : 0); break;
                    case "loan": go("loanDone"); break;
                    case "payday":
                        {
                            var ok = P.opts.Where(o => !o.dis).Select(o => o.k).ToList();
                            string k;
                            if (P.stage == "side") k = bpick(ok);
                            else if (P.stage == "repay") k = strat == "work" ? "repayAll" : strat == "steady" ? (S.cash >= S.debt ? "repayAll" : "keep") : (strat == "invest" || strat == "gamble") ? (S.cash >= S.debt ? "repayAll" : "keep") : bpick(ok);
                            else
                            {
                                var pref = strat == "gamble" ? new[] { "bet", "pay", "sell", "loan" } : strat == "random" ? null : new[] { "pay", "sell", "loan", "bet" };
                                k = pref != null ? pref.FirstOrDefault(x => ok.Contains(x)) : bpick(ok);
                            }
                            go("payday", "k", k ?? ok.FirstOrDefault()); break;
                        }
                    default: throw new Exception("unknown pending " + P.t);
                }
            }
            return new Result
            {
                seed = seed, strat = strat, end = S.ending ?? "none", variant = S.endInfo?.variant ?? "", month = S.month, day = S.day, debt = S.debt, cash = S.cash,
                fame = S.galFame, addict = S.addict, steps = steps, errs = errs, cmds = cmds, game = G
            };
        }
    }
}
