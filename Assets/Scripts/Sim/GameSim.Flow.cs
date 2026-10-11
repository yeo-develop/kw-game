using System;
using System.Collections.Generic;
using System.Linq;

namespace KwGame.Sim
{
    // flow.js — 하루 흐름 단계. S.flow = 남은 단계 이름 큐, S.pending = 입력 대기. run(): pending 없으면 flow 앞에서 꺼내 실행.
    public partial class GameSim
    {
        static readonly string[] AFTER_SLOT = { "endCheck", "faintCheck", "menCheck", "endSlot", "endCheck", "menCheck", "loopTop" };
        void after(params string[] steps) => S.flow.InsertRange(0, steps);
        void slotUsed() { S.pending = null; after(AFTER_SLOT); }
        void toHome() { S.pending = null; after("home"); }
        bool fainted() => S.faint >= Tnow();

        void run()
        {
            int guard = 0;
            while (S.pending == null && S.flow.Count > 0)
            {
                if (++guard > 1000) throw new Exception("flow loop");
                string k = S.flow[0]; S.flow.RemoveAt(0);
                Step(k);
            }
        }
        void Step(string k)
        {
            switch (k)
            {
                case "loopTop": loopTop(); break;
                case "loopTop2": loopTop2(); break;
                case "home": homeStep(); break;
                case "endCheck": checkEnd(); break;
                case "faintCheck": faintCheck(); break;
                case "menCheck": menCheck(); break;
                case "endSlot": endSlot(); break;
                case "market": marketTick(); break;
                case "advance": advance(); break;
                case "paydayMsg": M(T("pd.next", "m", S.month + 1), "smug"); hideDlg(); break;
                case "tutInit": if (S.optTut) S.tg = "home"; break;
                default: throw new Exception("unknown step " + k);
            }
        }

        // ---------- 집 대사 ----------
        string homeLine()
        {
            if (S.hl != null && S.hl.T == Tnow()) return S.hl.t;
            string mt = mental();
            List<string> L;
            if (mt == "men") L = TA("home.men");
            else if (mt == "anx") L = TA("home.anx");
            else if (S.hp < R.HP_LOW) L = TA("home.tired");
            else if (S.addict >= R.ADD_NAG && rnd() < 0.5) L = TA("home.addict");
            else L = ((Newtonsoft.Json.Linq.JArray)D.STR["home.slot"][S.slot]).Select(x => (string)x).ToList();
            string text = (S.day == R.MONTH_DAYS && isEve() && S.paidMonth != S.month && S.debt > 0) ? T("home.payday", "d", man(interestDue())) : pick(L);
            S.hl = new HomeLine { T = Tnow(), t = text };
            return S.hl.t;
        }

        // ---------- 칸 시작 ----------
        void slotStart()
        {
            if (S.startT == Tnow()) return; S.startT = Tnow();
            var P = curPlan();
            if (isEve() && has("whale"))
            {
                string tk = rnd() < 0.5 ? "BTK" : "TOK"; int d = P.r[tk] >= 0 ? 1 : -1;
                S.whale = new Whale { tk = tk, dir = rnd() < 0.7 ? d : -d, T = Tnow() };
                pushF("🐋", T("whale.feed", "n", D.TK[tk].name, "d", T(S.whale.dir > 0 ? "whale.up" : "whale.dn")), "intel");
            }
            if (has("rumor")) { var t = rollTip(SUB); tipAnnounce(t, "sub"); }
            kqExpire(); kqMaybe(); hyMaybe(); gallTick();
            addictTick();
        }
        void addictTick()
        {
            if (fainted() || S.phase == "ending") return;
            if (S.addict >= R.ADD_SECRET && S.cash >= 50000 && rnd() < 0.12)
            {
                double amt = round1k(S.cash * (0.1 + rnd() * 0.2)); bool win = rnd() < 0.25; double d = win ? amt : -amt;
                S.st.secret++;
                money(d, "gamble", T("lbl.secret")); S.st.gnet += d; S.st.gN++; if (win) S.st.gW++;
                addict(R.Gain("secret"), true);
                pushK("m", T(win ? "add.secretWinK" : "add.secretK", "a", won(amt)));
                toast(T(win ? "add.secretWinT" : "add.secretT", "a", won(amt)), win ? "good" : "liq", "kakao", "m");
                Emit("addictEv", "k", "secret", "amt", d);
                scene("room", "night", isEve(), "face", win ? "flex" : "panic", "mode", "home");
                N(T(win ? "add.secretWinN" : "add.secretN", "a", won(amt), "c", conv(amt)));
                M(fpick(TA(win ? "add.secretWinM" : "add.secretM")), win ? "flex" : "cry");
                hideDlg();
                return;
            }
            if (S.addict >= R.ADD_NAG && rnd() < 0.25) pushK("m", fpick(TA("add.nag")));
        }
        double temptStake() => Math.Max(10000, Math.Floor(S.cash * 0.5 / 10000) * 10000);
        void temptStart()
        {
            S.temptT = Tnow();
            Emit("addictEv", "k", "tempt");
            scene("room", "night", isEve(), "face", "menhera", "mode", "home");
            M(fpick(TA("add.temptM")), "menhera");
            S.pending = new Pending("tempt")
            {
                opts = new List<Opt> {
                    new Opt { k = "go", l = T("add.temptGo"), sub = T("add.temptGoSub", "a", won(temptStake())), dis = S.cash < 10000 },
                    new Opt { k = "no", l = T("add.temptNo"), sub = T("add.temptNoSub") } }
            };
        }
        bool temptCmd(string k)
        {
            var P = S.pending; var o = P.opts.FirstOrDefault(x => x.k == k);
            if (o == null || o.dis) return false;
            S.pending = null;
            if (k == "no") { stress(12); addict(-3); M(fpick(TA("add.temptNoM")), "angry"); hideDlg(); after("home"); return true; }
            double stake = Math.Min(S.cash, temptStake()), before = S.cash; bool win = rnd() < 0.49; double net = win ? stake : -stake;
            S.cash += net; S.st.gamble++; S.st.tempt++; S.st.gN++; if (win) S.st.gW++; S.st.gnet += net; S.workStreak = 0;
            S.today.Add(new Ledger { kind = "gamble", amt = net, label = T("lbl.tempt") });
            Emit("cash", "d", net);
            double a = R.Gain("casino"); if (win && isBig(net, before)) a += R.Gain("bigwin");
            addict(a); hp(-R.HpCost("casino"));
            N(T(win ? "add.temptWinN" : "add.temptLoseN", "a", won(stake)));
            react(net, new ReactCtx { before = before, gamble = true });
            slotUsed();
            return true;
        }

        // ---------- 아침 ----------
        string kimFill(string x) => replace1(replace1(replace1(x, "{dd}", JsFmt.Num(R.MONTH_DAYS - S.day)), "{due}", won(interestDue())), "{debt}", won(S.debt));
        void morning()
        {
            int MD = R.MONTH_DAYS;
            S.phase = "morning";
            if (has("divi")) { double v = stockVal(); if (v >= 10000) { double d = rhu(v * 0.01); S.cash += d; pushF("💌", T("divi.feed", "d", won(d)), "money"); S.today.Add(new Ledger { kind = "div", amt = d, label = T("lbl.divi") }); augFx("divi", T("aug.divi", "d", man(d))); } }
            string evT = null; bool hasEv = false;
            if (fainted()) { evT = T("morning.faint"); hasEv = true; }
            else if (rnd() < 0.4)
            {
                var e = pick(D.MORNING_EV); evT = e.t; hasEv = true;
                if (e.cash != 0) { S.cash += e.cash; S.today.Add(new Ledger { kind = "ev", amt = e.cash, label = T("lbl.morningEv") }); }
                if (e.st != 0) S.stress = clamp(S.stress + e.st, 0, 100);
                if (e.fame != 0) fame(e.fame);
                if (e.hp != 0) S.hp = clamp(S.hp + e.hp, 0, R.HP_MAX);
            }
            if (!hasEv && S.hp < 40) { evT = T("morning.lowHp"); hasEv = true; }
            else if (!hasEv && S.stress < 20) { evT = T("morning.fresh"); hasEv = true; }
            S.stress = clamp(S.stress - 6, 0, 100);
            if (S.galFame >= D.FAME["gift"] && rnd() < 0.4)
            {
                double g = Math.Min(200000, rhu((10000 + S.galFame * 1500) / 1000) * 1000); S.cash += g; S.today.Add(new Ledger { kind = "ev", amt = g, label = T("lbl.gift") }); S.stress = clamp(S.stress - 4, 0, 100);
                pushKR("hy", "hy", T("gift.hy", "g", won(g))); pushF("🎁", T("gift.feed", "g", won(g), "f", S.galFame), "fame");
            }
            if (S.paidMonth != S.month && S.debt > 0) { int dd0 = MD - S.day; if (dd0 == 0) pushKR("kim", "kim", kimFill(fpick(D.KIM_DM["today"]))); else if (dd0 <= 3) pushKR("kim", "kim", kimFill(fpick(D.KIM_DM["remind"]))); }
            if (S.debt >= 40000000 && S.kimBig != S.month) { S.kimBig = S.month; pushKR("kim", "kim", kimFill(fpick(D.KIM_DM["big"]))); }
            // 어제 기록 묶기 (라벨별)
            var groups = new OMap<Dictionary<string, object>>();
            foreach (var x in S.yday)
            {
                string k = !string.IsNullOrEmpty(x.label) ? x.label : x.kind;
                var g = groups.Get(k);
                if (g == null) { g = new Dictionary<string, object> { ["label"] = k, ["kind"] = x.kind, ["amt"] = 0.0, ["n"] = 0 }; groups.Set(k, g); }
                g["amt"] = (double)g["amt"] + x.amt; g["n"] = (int)g["n"] + 1;
            }
            var Y = groups.Select(kv => { var o = new Dictionary<string, object>(kv.Value); if ((int)o["n"] > 1) o["label"] = o["label"] + " ×" + o["n"]; return o; }).ToList();
            double net = 0; foreach (var x in Y) net = net + ((string)x["kind"] == "loan" || (string)x["kind"] == "debt" ? 0 : (double)x["amt"]);
            string mline = mental() == "men" ? T("mline.men") : mental() == "anx" ? T("mline.anx") : S.hp < R.HP_LOW ? T("mline.tired") : S.addict >= R.ADD_NAG ? T("mline.addict") : S.stress < 25 ? T("mline.happy") : T("mline.calm");
            pushK("m", mline);
            var tod = S.today.Where(x => x.kind == "div" || x.kind == "ev").ToList();
            Emit("morning", "month", S.month, "day", S.day, "dd", MD - S.day, "paid", S.paidMonth == S.month || S.debt <= 0, "due", interestDue(), "cash", S.cash, "hv", holdVal(), "hp", S.hp, "addict", S.addict,
                "Y", Y, "net", net, "netConv", net != 0 ? conv(net) : T("conv0"), "ev", evT ?? "", "tod", tod,
                "best", S.posts.Where(p => p.best).Skip(Math.Max(0, S.posts.Count(p => p.best) - 2)).Select(p => V("au", p.au, "title", p.title, "up", p.up)).ToList(), "mline", mline);
        }

        // ---------- 칸 끝: 펀딩비 → 시세 → 청산 → 정보 결과 → 알림 ----------
        class Liq { public CoinPos c; public double back, lost; }
        class Row { public string l; public double d, r; public bool liq; }
        void marketTick()
        {
            bool evening = isEve(); var n = S.news;
            var before = new Dictionary<string, double>();
            foreach (var k in STK()) { var h = S.hold.Get(k); if (h != null) before["s" + k] = h.q * S.mk.tk[k].p; }
            foreach (var c in S.cps) before["c" + c.id] = cEq(c);
            double eq0 = S.cash + holdVal();
            double fund = 0;
            foreach (var c in S.cps) if (c.lev > 1)
                {
                    double f0 = Math.Min(c.margin, c.margin * c.lev * R.FUNDING), f = rhu(f0);
                    c.margin -= f; fund += f;
                }
            if (fund != 0) { S.today.Add(new Ledger { kind = "invest", amt = -fund, label = T("lbl.funding") }); S.realized -= fund; }
            var P = curPlan(); S.mplan = null;
            var mv = applyMarket(P);
            var liqs = new List<Liq>();
            foreach (var c in S.cps.ToList())
            {
                double w = c.dir > 0 ? mv[c.tk].l : mv[c.tk].h;
                if (c.margin <= 0 || c.lev * c.mult * c.dir * (w / c.entry - 1) <= -0.9 || liqHit(c, mv[c.tk], D.TK[c.tk].vol * (evening && has("whale") ? 2 : 1)))
                {
                    var hist = S.mk.tk[c.tk].hist; var hc = hist[hist.Count - 1]; double L = liqPx(c);
                    if (c.dir > 0) hc.l = Math.Min(hc.l, L * 0.998); else hc.h = Math.Max(hc.h, L * 1.002);
                    var LL = R.LIQ_LOSS; double loss = LL[0] + rnd() * (LL[1] - LL[0]);
                    double back = Math.Max(0, rhu(c.margin * (1 - loss)));
                    if (has("insure") && !S.insUsed) { S.insUsed = true; back = Math.Max(back, rhu(c.margin / 2)); }
                    S.cash += back;
                    S.cps.Remove(c); S.st.liq++; S.st.iN++; S.realized += back - c.margin;
                    S.today.Add(new Ledger { kind = "invest", amt = back - c.margin, label = T("lbl.liq", "n", D.TK[c.tk].name, "lev", c.lev, "b", T("lbl.liqBack", "p", rhu(loss * 100))) });
                    liqs.Add(new Liq { c = c, back = back, lost = before["c" + c.id] - back });
                }
            }
            Func<CoinPos, string> ld = c => T(c.dir > 0 ? "long" : "short");
            var rows = new List<Row>();
            foreach (var k in STK()) { var h = S.hold.Get(k); if (h != null) rows.Add(new Row { l = D.TK[k].ic + " " + D.TK[k].name, d = h.q * S.mk.tk[k].p - before["s" + k], r = mv[k].r }); }
            foreach (var c in S.cps) rows.Add(new Row { l = D.TK[c.tk].ic + " " + D.TK[c.tk].name + " " + JsFmt.Num(c.lev) + "x " + ld(c), d = cEq(c) - before["c" + c.id], r = mv[c.tk].r * c.dir * c.lev * c.mult });
            foreach (var x in liqs) rows.Add(new Row { l = T("row.liq", "n", D.TK[x.c.tk].name, "lev", x.c.lev, "d", ld(x.c), "b", T("row.liqBack", "m", man(x.back))), d = -x.lost, liq = true });
            double total = 0; foreach (var x in rows) total = total + x.d;
            int nextSlot = (S.slot + 1) % R.SLOTS, lastStock = R.STOCK_SLOTS[R.STOCK_SLOTS.Length - 1];
            string title = evening ? T("tick.night") : T("tick.slot", "ic", D.SLOT_IC[S.slot], "s", D.SLOT_NAME[S.slot], "x", S.slot == lastStock ? T("tick.close") : "");
            var rt = resolveTips(); onTipsResolved(rt);
            if (rt.Count > 0) pushF("🔎", T("tick.tips", "n", rt.Count) + string.Join(" · ", rt.Select(t => srcOf(t).name + " " + D.TK[t.tk].name + " " + resMark(t.res) + " (" + pct(t.rr) + ")")), "tip");
            if (n != null && !n.fake)
            {
                string nm = D.TK.ContainsKey(n.tk) ? D.TK[n.tk].name + " " + pct(mv[n.tk].r) : T("tick.all");
                pushF("📰", n.h + " → " + nm, "news"); toast("📰 " + n.h + " → " + nm, "news", "news");
                if (rnd() < 0.6) galReact("news", V("h", n.h), 1);
            }
            var shown = TKS().Where(tkOpen).ToList();
            string c0 = total != 0 ? conv(total) : T("conv0");
            if (rows.Count > 0)
            {
                pushF("🔔", T("tick.feed", "t", title, "a", sgnWon(total), "c", c0), "slot",
                    rows.Select(x => x.l + " " + (x.liq ? "" : pct(x.r)) + " " + sgnWon(x.d)).Concat(new[] { string.Join(" ", shown.Select(k => D.TK[k].ic + pct(mv[k].r))) }).ToList());
                if (liqs.Count == 0) toast(T("tick.toast", "t", title, "a", sgnWon(total), "c", c0, "i", rt.Count > 0 ? T("tick.toastTips", "m", string.Join("", rt.Select(t => resMark(t.res).Split(' ')[0]))) : ""), total >= 0 ? "good" : "", "stock");
            }
            else if (rt.Count > 0) toast(T("tick.tipsToast", "l", string.Join(" · ", rt.Select(t => srcOf(t).name + " " + resMark(t.res)))), "news", "news");
            else Emit("tickFloat", "text", T("tick.float", "ic", D.SLOT_IC[nextSlot], "s", D.SLOT_NAME[nextSlot]));
            gallMarketPosts(mv);
            S.eqh.Add(new EqPoint { T = Tnow(), v = S.realized + unreal() }); if (S.eqh.Count > 100) S.eqh.RemoveAt(0);
            S.st.maxAsset = Math.Max(S.st.maxAsset, rhu(S.cash + holdVal()));
            Emit("tick");
            if (liqs.Count > 0)
            {
                scene("room", "night", evening, "face", "panic", "mode", "home");
                var L = liqs[0].c;
                double lostSum = 0; foreach (var x in liqs) lostSum = lostSum + x.lost;
                react(-lostSum, new ReactCtx { liq = true, lev = L.lev });
            }
            else if (rows.Count > 0 && Math.Abs(total) >= Math.Max(800000, eq0 * 0.25))
            {
                scene("room", "night", evening, "face", "neutral", "mode", "home");
                if (total > 0) { fx("flex", "amt", total); galReact("bigwin", V("amt", sgnMan(total), "conv", conv(total)), 2); stress(-10); M(T("tick.bigUp", "s", D.SLOT_NAME[S.slot], "a", sgnWon(total), "c", conv(total)), "flex"); }
                else { fx("crack", "amt", total); galReact("bigloss", V("amt", sgnMan(total), "conv", conv(total)), 2); stress(16); M(T("tick.bigDn", "a", sgnWon(total), "c", conv(total)), "cry"); }
                hideDlg();
            }
            S.news = genNews();
        }

        // ---------- 이자일 ----------
        List<Opt> paydayOpts()
        {
            var P = S.pending; double due = P.due;
            double hv = holdVal(), shortA = Math.Max(0, due - S.cash); bool canLoan = shortA > 0 && S.debt + shortA <= loanCap();
            return new List<Opt> {
                new Opt { k = "pay", l = T("pd.pay", "d", won(due)), sub = T("pd.cash", "c", won(S.cash)), dis = S.cash < due },
                new Opt { k = "sell", l = T("pd.sell"), sub = hv > 0 ? T("pd.sellSub", "v", won(hv)) : T("pd.sellNone"), dis = hv <= 0 || S.cash >= due },
                new Opt { k = "loan", l = shortA > 0 ? T("pd.loan", "s", won(shortA)) : T("pd.loanNo"), sub = shortA > 0 ? (canLoan ? T("pd.loanSub", "a", won(S.debt), "b", won(S.debt + shortA)) : T("pd.loanCap", "m", S.month, "c", man(loanCap()))) : T("pd.loanEnough"), dis = !canLoan },
                new Opt { k = "bet", l = T("pd.bet"), sub = P.betUsed ? T("pd.betUsed") : T("pd.betSub"), dis = P.betUsed },
            };
        }
        string badKind() => S.addict >= R.ADD_SECRET ? "bad2" : "bad1";
        void paydayChoose()
        {
            var P = S.pending;
            P.stage = "choose"; P.opts = paydayOpts();
            if (P.opts.All(o => o.dis)) { KIM(T("pd.stuck1")); KIM(T("pd.stuck2")); S.pending = null; ending(badKind()); }
        }
        void paydayStart()
        {
            S.phase = "payday";
            scene("room", "night", true, "face", "panic", "mode", "home"); kim(true);
            if (S.paidMonth == S.month) { KIM(T("pd.early")); paydayPaid(true); return; }
            double due = interestDue();
            KIM(T("pd.hello", "m", S.month, "d", won(due)));
            S.pending = new Pending("payday") { stage = "choose", due = due, betUsed = false, opts = new List<Opt>() };
            paydayChoose();
        }
        bool paydayCmd(string ck)
        {
            var P = S.pending;
            if (P.stage == "choose")
            {
                var o = P.opts.FirstOrDefault(x => x.k == ck); if (o == null || o.dis) return false;
                double due = P.due;
                if (o.k == "pay") { money(-due, "interest", T("lbl.interest")); S.st.interest += due; pushF("🧾", T("pd.feed", "m", S.month, "d", won(due)), "money"); KIM(T("pd.paid")); return paydayPaid(); }
                if (o.k == "sell") { double t = closeAll(); N(T("pd.sold", "t", sgnWon(t), "c", won(S.cash))); paydayChoose(); return true; }
                if (o.k == "loan") { double shortA = Math.Max(0, due - S.cash), have = S.cash; if (have != 0) money(-have, "interest", T("lbl.interestAll")); addDebt(shortA, T("lbl.interestLoan")); S.st.interest += due; KIM(T("pd.loaned", "s", won(shortA))); return paydayPaid(); }
                if (o.k == "bet") { P.betUsed = true; KIM(T("pd.betAsk")); P.stage = "side"; P.opts = new List<Opt> { new Opt { k = "odd", l = T("cas.odd") }, new Opt { k = "even", l = T("cas.even") } }; return true; }
            }
            if (P.stage == "side")
            {
                var o = P.opts.FirstOrDefault(x => x.k == ck); if (o == null) return false;
                face("panic"); N(T("pd.reveal"));
                bool kimWin = rnd() >= 0.5;
                addict(R.Gain("kim") + (kimWin ? R.Gain("bigloss") : 0)); S.st.gN++; if (!kimWin) S.st.gW++;
                if (!kimWin) { KIM(T("pd.betWin", "s", o.l)); stress(-20); fx("big", "text", T("pd.freeFx"), "kind", "up", "small", T("pd.freeFxSub")); return paydayPaid(); }
                P.due *= 2; KIM(T("pd.betLose", "d", won(P.due))); fx("crack", "amt", -P.due / 2); stress(10);
                paydayChoose(); return true;
            }
            if (P.stage == "repay")
            {
                var o = P.opts.FirstOrDefault(x => x.k == ck); if (o == null || o.dis) return false;
                if (o.k == "repayAll") repay(Math.Min(S.cash, S.debt));
                else if (o.k == "repayHalf") repay(Math.Min(P.half, S.debt));
                else bubble(T("pd.keepBubble"), 2000, "smug");
                S.pending = null; paydayEnd(); return true;
            }
            return false;
        }
        bool paydayPaid(bool early = false)
        {
            if (!early) S.paidMonth = S.month;
            galReact("payday", V("debt", man(S.debt) + D.U("won")), 2);
            pushK("m", T("pd.k"));
            if (S.cash >= 10000 && S.debt > 0)
            {
                double half = Math.Floor(S.cash / 20000) * 10000;
                S.pending = new Pending("payday")
                {
                    stage = "repay", half = half, opts = new List<Opt> {
                        new Opt { k = "repayAll", l = T("pd.rAll", "c", won(S.cash)), sub = T("pd.rAllSub", "a", won(S.debt), "b", won(Math.Max(0, S.debt - S.cash))) },
                        new Opt { k = "repayHalf", l = T("pd.rHalf", "h", won(half)), sub = T("pd.rHalfSub"), dis = half < 10000 },
                        new Opt { k = "keep", l = T("pd.rKeep"), sub = T("pd.rKeepSub") } }
                };
                return true;
            }
            S.pending = null; paydayEnd(); return true;
        }
        void paydayEnd()
        {
            if (S.debt <= 0 && S.cleared == 0) { ending("clear"); return; }
            kim(false); face("tired");
            N(T("pd.monthEnd", "m", S.month, "d", won(S.debt), "i", won(interestDue())));
            hideDlg();
            after("paydayMsg");
        }

        // ---------- 유품 고르기 ----------
        List<string> relicOfferStart()
        {
            double r = rnd(); bool first = S.augs.Count == 0;
            int tier = r < (first ? 0.1 : 0.2) ? 3 : r < (first ? 0.45 : 0.6) ? 2 : 1;
            var pool = D.AUGS.Where(a => a.tier == tier && !has(a.id)).ToList(); var rest = D.AUGS.Where(a => a.tier != tier && !has(a.id)).ToList();
            var outp = new List<Aug>();
            while (outp.Count < 3 && pool.Count > 0) { int j = (int)Math.Floor(rnd() * pool.Count); outp.Add(pool[j]); pool.RemoveAt(j); }
            while (outp.Count < 3 && rest.Count > 0) { int j = (int)Math.Floor(rnd() * rest.Count); outp.Add(rest[j]); rest.RemoveAt(j); }
            return outp.Select(a => a.id).ToList();
        }
        void relicStart(string reason) => S.pending = new Pending("relic") { reason = reason, offer = relicOfferStart(), rerolled = false };
        bool relicReroll() { var P = S.pending; if (P.rerolled) return false; P.rerolled = true; P.offer = relicOfferStart(); return true; }
        bool relicPick(int i)
        {
            var P = S.pending; string id = i >= 0 && i < P.offer.Count ? P.offer[i] : null;
            if (id == null) return false;
            S.pending = null;
            if (S.phase == "opening") S.phase = "home";
            S.augs.Add(id);
            var a = D.AUGS.First(x => x.id == id);
            augFx(id, T("aug.got"));
            galReact("aug", V("aug", a.name), 2);
            pushK("m", T("aug.k", "n", a.name));
            Emit("relic", "id", id, "how", "pick");
            if (a.tier == 3) fx("big", "text", a.ic + " " + a.name, "kind", "up", "small", T("aug.prism"));
            M(id == "meme" ? T("aug.mMeme") : id == "grind" ? T("aug.mGrind") : id == "loanbro" ? T("aug.mLoanbro") : T("aug.mAny", "n", a.name, "f", a.fl), a.tier == 3 ? "flex" : "smug");
            hideDlg();
            return true;
        }

        // ---------- 멘헤라 ----------
        void menheraStart()
        {
            S.menKey = Tnow().ToString(); S.menCool = Tnow() + 3;
            int si = (int)Math.Floor(rnd() * D.MEN_SETS.Count); var set = D.MEN_SETS[si];
            Emit("menhera", "msgs", set.msgs);
            foreach (var m in set.msgs) pushK("m", m);
            galReact("menhera", null, 2);
            N(T("men.n", "n", set.msgs.Length));
            M(set.last, "menhera");
            var opts = new List<Opt> { new Opt { l = set.ok, ok = true }, new Opt { l = set.no[0] }, new Opt { l = set.no[1] } };
            for (int i = opts.Count - 1; i > 0; i--) { int j = (int)Math.Floor(rnd() * (i + 1)); var tmp = opts[i]; opts[i] = opts[j]; opts[j] = tmp; }
            for (int i = 0; i < opts.Count; i++) opts[i].k = "rep" + i;
            S.pending = new Pending("menhera") { si = si, opts = opts };
        }
        bool menheraReply(int i)
        {
            var P = S.pending; var c = i >= 0 && i < P.opts.Count ? P.opts[i] : null; var set = D.MEN_SETS[P.si];
            if (c == null) return false;
            S.pending = null;
            pushK("me", c.l);
            if (c.ok) { S.st.menOk++; stress(-45); M(set.good, "happy"); }
            else { S.st.menBad++; stress(-20); M(set.bad, "angry"); }
            hideDlg();
            return true;
        }
        void impulseStart()
        {
            S.menKey = Tnow().ToString(); S.menCool = Tnow() + 3;
            var cands = TKS().Where(k => tkOpen(k) && !D.TK[k].inv && (D.TK[k].type == "coin" || stockOpen())).ToList();
            string tk = cands[(int)Math.Floor(rnd() * cands.Count)];
            int si = (int)Math.Floor(rnd() * D.IMPULSE.Count); var set = D.IMPULSE[si];
            Emit("impulse", "tk", tk, "amt", round1k(S.cash * R.IMPULSE_CASH));
            scene("room", "night", isEve(), "face", "menhera", "mode", "home");
            N(T("imp.n", "n", D.TK[tk].name, "a", won(round1k(S.cash * R.IMPULSE_CASH))));
            var nv = V("n", D.TK[tk].name);
            M(fill(set.line, nv), "menhera");
            var opts = new List<Opt> { new Opt { l = fill(set.ok, nv), ok = true }, new Opt { l = fill(set.no[0], nv) }, new Opt { l = fill(set.no[1], nv) } };
            for (int i = opts.Count - 1; i > 0; i--) { int j = (int)Math.Floor(rnd() * (i + 1)); var tmp = opts[i]; opts[i] = opts[j]; opts[j] = tmp; }
            for (int i = 0; i < opts.Count; i++) opts[i].k = "imp" + i;
            S.pending = new Pending("impulse") { si = si, tk = tk, opts = opts };
        }
        bool impulseReply(int i)
        {
            var P = S.pending; var c = i >= 0 && i < P.opts.Count ? P.opts[i] : null; var set = D.IMPULSE[P.si]; string tk = P.tk;
            if (c == null) return false;
            S.pending = null;
            pushK("me", c.l);
            if (c.ok) { S.st.menOk++; stress(-35); M(fill(set.good, V("n", D.TK[tk].name)), "happy"); hideDlg(); return true; }
            S.st.menBad++; S.st.impulse++;
            double amt = round1k(S.cash * R.IMPULSE_CASH); bool stock = D.TK[tk].type == "stock";
            bool up = rnd() < 0.5; double mag = stock ? 0.12 + rnd() * 0.18 : 0.2 + rnd() * 0.25;
            bool ok = false;
            if (amt >= 10000)
            {
                if (stock) ok = buyStock(tk, amt, R.FEE_APP) is double b && b != 0;
                else ok = openCoin(tk, 1, 1, Math.Floor(amt / (1 + R.COIN_FEE) / 1000) * 1000) != null;
            }
            if (ok) addShock(Tnow(), tk, (up ? 1 : -1) * mag);
            stress(-15);
            fx("big", "text", T("imp.fx", "n", D.TK[tk].name), "kind", up ? "up" : "dn", "small", T("imp.fxSub", "a", won(amt)));
            M(fill(set.bad, V("n", D.TK[tk].name)), "flex");
            pushF("🛒", T("imp.feed", "n", D.TK[tk].name, "a", won(amt)), "money");
            hideDlg();
            return true;
        }

        // ---------- 끝 ----------
        bool broke() => S.cash + holdVal() < 10000 && loanCap() - S.debt < R.LOAN_AMTS[0];
        void checkEnd()
        {
            if (S.debt <= 0 && S.cleared == 0) { ending("clear"); return; }
            if (S.debt > R.DEBT_CAP) { Emit("hideUi"); N(T("end.cap", "d", won(S.debt))); ending(badKind()); return; }
        }
        bool addictEnd() { if (S.addict >= 100 && broke()) { Emit("hideUi"); N(T("end.addictMax")); ending("bad2"); return true; } return false; }
        public Scoreboard scoreboard(string kind) => new Scoreboard
        {
            kind = kind, profit = rhu(S.realized + unreal()), gnet = S.st.gnet, earned = S.st.earned, maxAsset = S.st.maxAsset, repaid = S.st.repaid, debt = S.debt,
            days = absDay(), month = S.month, day = S.day, gW = S.st.gW, gN = S.st.gN, iW = S.st.iW, iN = S.st.iN, liq = S.st.liq, fame = S.galFame, rank = rankOf(S.galFame).name,
            addict = S.addict, interest = S.st.interest, faint = S.st.faint, impulse = S.st.impulse
        };
        void ending(string kind)
        {
            var E = D.ENDINGS[kind];
            if (kind == "clear") S.resume = S.flow.ToList();
            S.phase = "ending"; S.ending = kind; S.flow = new List<string>(); S.pending = new Pending("ending") { kind = kind, cont = kind == "clear" };
            S.endSeen[kind] = (S.endSeen.TryGetValue(kind, out var es) ? es : 0) + 1;
            var decor = S.props.Keys.Concat(S.owned.Keys.Where(k => k != "hoodie")).ToList();
            var v = V("debt", won(S.debt), "interest", won(S.st.interest), "m", S.month, "minDebt", won(S.st.minDebt), "g", sgnWon(S.st.gnet));
            string lead, variant = "";
            if (kind == "clear")
            {
                variant = S.st.gnet > 0 && S.st.gnet >= S.st.earned ? "gamble" : "";
                lead = T(variant != "" ? "end.clearGamble" : S.stress < 60 ? "end.clearHappy" : "end.clearMeh", v) + "\n\n" +
                    (decor.Count > 0 ? string.Join("\n", decor.Select(k => D.DECOR_END.TryGetValue(k, out var s) ? s : null).Where(s => !string.IsNullOrEmpty(s))) : T("end.noDecor"));
            }
            else if (kind == "bad1")
            {
                variant = S.galFame >= D.FAME["gall"] ? "gall" : "sea";
                lead = (S.debt > R.DEBT_CAP ? T("end.capPre") : "") + T(variant == "gall" ? "end.bad1Gall" : "end.bad1", v);
            }
            else
            {
                variant = S.st.work >= 20 ? "loop" : "casino";
                lead = (S.st.minDebt <= R.DEBT0 * 0.7 && S.debt > S.st.minDebt ? T("end.bad2Flash", v) : "") + T(variant == "loop" ? "end.bad2Loop" : "end.bad2", v);
            }
            if (S.galFame >= D.FAME["legend"]) lead += T("end.legend", "n", JsFmt.Loc(3000 + S.galFame * 37));
            else if (variant == "gall") lead += T("end.gallFame", "f", S.galFame);
            var sb = scoreboard(kind);
            string pickV(Dictionary<string, string> m, string def) => variant != "" && m != null && m.TryGetValue(variant, out var x) ? x : def;
            S.endInfo = new EndInfo
            {
                kind = kind, variant = variant, tag = E.tag, ok = E.ok, h = pickV(E.hv, E.h), bg = pickV(E.bgv, E.bg),
                face = kind == "clear" ? (S.stress < 60 ? "happy" : "tired") : E.face, lead = lead, days = absDay(), rank = rankOf(S.galFame).name,
                noChar = E.noCharV != null && E.noCharV.TryGetValue(variant, out var nc) && nc != 0, night = kind == "clear", sb = sb, cont = kind == "clear"
            };
            pushK("sys", T("end.k", "h", S.endInfo.h));
            Emit("ending", "kind", kind, "variant", variant, "sb", sb);
        }
        bool continueGame()
        {
            if (S.pending == null || S.pending.t != "ending" || !S.pending.cont) return false;
            S.cleared = 1; S.ending = null; S.pending = null; S.phase = "home";
            S.flow = S.resume != null && S.resume.Count > 0 ? S.resume : new List<string> { "loopTop" }; S.resume = null;
            Emit("continued");
            return true;
        }

        // ---------- 기절 ----------
        void faintCheck()
        {
            if (S.hp > 0 || fainted()) return;
            S.faint = absDay() * R.SLOTS + R.SLOTS - 1;
            S.st.faint++;
            double cost = R.HP_FAINT_COST;
            S.cash -= cost; S.today.Add(new Ledger { kind = "ev", amt = -cost, label = T("lbl.hospital") }); Emit("cash", "d", -cost);
            if (S.cash < 0) { double d = -S.cash; S.cash = 0; addDebt(d, T("lbl.cover")); }
            Emit("faint");
            scene("room", "night", true, "face", "panic", "mode", "home");
            N(T("faint.n", "c", won(cost)));
            M(fpick(TA("faint.m")), "cry");
            pushK("m", T("faint.k"));
            galReact("faint", null, 2);
            hideDlg();
        }

        // ---------- 단계 ----------
        void loopTop()
        {
            if (S.needMorning) { if (addictEnd()) return; morning(); S.needMorning = false; }
            if (S.dbgAug != 0) { S.dbgAug = 0; after("loopTop2"); relicStart(T("aug.reasonDebug")); return; }
            loopTop2();
        }
        void loopTop2() { S.phase = "home"; slotStart(); Emit("save"); after("home"); }
        void homeStep()
        {
            S.phase = "home";
            if (fainted())
            {
                Emit("faintSlot");
                if (S.faint == Tnow()) S.hp = Math.Max(S.hp, R.HP_FAINT_BACK);
                after(AFTER_SLOT); return;
            }
            if (S.addict >= R.ADD_TEMPT && S.temptT != Tnow() && rnd() < 0.3) { temptStart(); return; }
            homeLine(); S.pending = new Pending("home");
        }
        void menCheck()
        {
            if (fainted()) return;
            if (mental() == "men" && S.menKey != Tnow().ToString() && !(S.menCool.HasValue && S.menCool.Value > Tnow()))
            {
                if (S.cash >= 50000 && rnd() < R.IMPULSE_P) impulseStart(); else menheraStart();
            }
        }
        void endSlot()
        {
            if (S.gT != Tnow() && S.addict > 0 && S.addict < R.ADD_STICKY) S.addict = Math.Max(0, S.addict - R.ADD_SLOT_DECAY);
            after("market", "advance");
            if (isEve()) { lottoDraw(); if (S.day == R.MONTH_DAYS && S.debt > 0) paydayStart(); }
        }
        void advance()
        {
            S.slot++;
            if (S.slot >= R.SLOTS)
            {
                int d0 = absDay();
                S.slot = 0; S.day++; S.yday = S.today; S.today = new List<Ledger>();
                if (S.day > R.MONTH_DAYS) { S.day = 1; S.month++; }
                S.needMorning = true;
                S.hp = clamp(S.hp + R.HP_SLEEP, 0, R.HP_MAX);
                if (S.gday != d0)
                {
                    if (S.addict >= R.ADD_SECRET) { S.stress = clamp(S.stress + R.ADD_WITHDRAW, 0, 100); pushK("m", fpick(TA("add.withdraw"))); }
                    S.addict = Math.Max(0, S.addict - R.ADD_DECAY);
                }
            }
        }
    }
}
