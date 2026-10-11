using System;
using System.Collections.Generic;
using System.Linq;

namespace KwGame.Sim
{
    // places.js — 장소 메뉴(locOpts) + 한 번에 끝나는 행동: 게임방 · 은행 · 상점 · 증권사 리포트 · 사채 · 길거리 정보 · 유품 상점
    public partial class GameSim
    {
        public class LocOpt { public string k, ic, l, sub; public bool dis; }

        public List<LocOpt> locOpts(string key)
        {
            Func<string, string> hc = k => T("lo.hp", "h", hpCost(k));
            switch (key)
            {
                case "broker":
                    return new List<LocOpt> {
                        new LocOpt { k = "l-trade", ic = "📊", l = T("lo.trade"), sub = has("vip") ? T("lo.tradeVip") : T("lo.tradeFee") },
                        new LocOpt { k = "l-tip", ic = "📄", l = T("lo.tip"), sub = T("lo.tipSub", "s", stars(4), "r", srcRec(PARK)) + hc("tip"), dis = S.repT == Tnow() } };
                case "bank":
                    {
                        bool paid = S.paidMonth == S.month; double due = interestDue();
                        return new List<LocOpt> {
                            new LocOpt { k = "l-payint", ic = "🧾", l = paid ? T("lo.paid") : T("lo.payint", "d", man(due)), sub = paid ? T("lo.paidSub") : T("lo.cash", "c", man(S.cash)), dis = paid || S.cash < due },
                            new LocOpt { k = "l-repay", ic = "💳", l = T("lo.repay"), sub = T("lo.debt", "d", man(S.debt)), dis = S.cash < 10000 } };
                    }
                case "casino":
                    return new[] { ("oddeven", "🎲"), ("card", "🃏"), ("slot", "🎰"), ("ladder", "🪜") }
                        .Select(x => new LocOpt { k = "l-" + x.Item1, ic = x.Item2, l = T("lo." + x.Item1), sub = T("lo.nolimit") + hc("casino"), dis = S.cash < 10000 }).ToList();
                case "work":
                    return D.JOBList.Select(J => new LocOpt
                    {
                        k = "l-" + J.id, ic = J.ic, l = J.name,
                        sub = T("lo.pay", "a", man(J.@base * (has("grind") ? R.GRIND_PAY : 1)), "b", man((J.@base + J.var) * (has("grind") ? R.GRIND_PAY : 1)), "h", jobHp(J)) + (S.hp <= jobHp(J) ? T("lo.faintRisk") : S.hp < R.HP_LOW ? T("lo.tiredPen") : "")
                    }).ToList();
                case "pc":
                    return new List<LocOpt> {
                        new LocOpt { k = "l-pcgame", ic = "🕹️", l = T("lo.pcgame"), sub = T("lo.pcgameSub"), dis = S.cash < 10000 },
                        new LocOpt { k = "l-pcramen", ic = "🍜", l = T("lo.pcramen"), sub = T("lo.pcramenSub"), dis = S.cash < 6000 } };
                case "shop":
                    return new List<LocOpt> {
                        new LocOpt { k = "l-shop", ic = "👗", l = T("lo.shop"), sub = T("lo.shopSub") },
                        new LocOpt { k = "l-relic", ic = "🎁", l = T("lo.relic"), sub = T("lo.relicSub", "g", man(R.GACHA_PRICE)) } };
                case "lotto":
                    return new List<LocOpt> {
                        new LocOpt { k = "l-scratch", ic = "🪙", l = T("lo.scratch"), sub = T("lo.scratchSub"), dis = S.cash < 5000 },
                        new LocOpt { k = "l-lotto", ic = "🔮", l = T("lo.lotto"), sub = T("lo.lottoSub"), dis = S.cash < 10000 } };
                case "race":
                    return new List<LocOpt> { new LocOpt { k = "l-race", ic = "🏇", l = T("lo.race", "d", absDay()), sub = T("lo.raceSub") + hc("race"), dis = S.cash < 10000 } };
            }
            return new List<LocOpt>();
        }

        // ---------- 게임방 ----------
        bool doPc(string kind)
        {
            double cost = R.PC_COST[kind];
            if (S.cash < cost) { M(T("pc.broke"), "cry"); hideDlg(); return false; }
            S.cash -= cost; S.st.pc++; S.workStreak = 0;
            S.today.Add(new Ledger { kind = "pc", amt = -cost, label = T(kind == "game" ? "lbl.pcgame" : "lbl.pcramen") });
            hp(-hpCost(kind == "game" ? "pcgame" : "pcramen"));
            if (kind == "ramen") { stress(-12); M(T("pc.ramen"), "happy"); }
            else
            {
                stress(-20);
                var e = pick(D.PC_EV);
                if (e.st != 0) stress(e.st); if (e.hp != 0) hp(e.hp); if (e.fame != 0) fame(e.fame); if (e.cash != 0) S.cash += e.cash;
                N("🎮 " + e.t);
                M(fpick(TA("pc.after")), "happy");
            }
            galReact("pc", null, 1);
            hideDlg();
            return true;
        }

        // ---------- 은행 ----------
        string BANK => D.NPC_NAME["bank"];
        bool payEarly()
        {
            double due = interestDue();
            if (S.paidMonth == S.month) { NPC(BANK, T("bank.already")); hideDlg(); return false; }
            if (S.cash < due) { NPC(BANK, T("bank.short", "d", won(due), "c", won(S.cash))); hideDlg(); return false; }
            money(-due, "interest", T("lbl.payEarly", "m", S.month)); pushF("🧾", T("bank.feed", "m", S.month, "d", won(due)), "money"); S.st.interest += due; S.paidMonth = S.month;
            pushK("kim", T("bank.kim", "m", S.month, "d", won(due)));
            stress(-10); hp(-hpCost("bank"));
            NPC(BANK, T("bank.done", "d", won(due)));
            M(T("bank.m"), "happy"); hideDlg();
            return true;
        }
        /// false = 못 함 (칸 안 씀), true = repay pending 세움
        bool repayStart(string loc)
        {
            double mx = Math.Floor(Math.Min(S.cash, S.debt) / 10000) * 10000, due = S.paidMonth == S.month ? 0 : interestDue();
            if (mx < 10000) { NPC(BANK, T("bank.noCash")); hideDlg(); return false; }
            S.pending = new Pending("repay") { loc = loc, mx = mx, due = due };
            return true;
        }
        void repay(double a)
        {
            a = Math.Min(a, Math.Min(S.debt, S.cash));
            S.cash -= a; S.debt -= a; S.st.repaid += a; S.st.minDebt = Math.Min(S.st.minDebt, S.debt);
            S.today.Add(new Ledger { kind = "repay", amt = -a, label = T("lbl.repay") });
            Emit("repaid", "a", a);
            galReact("repay", V("debt", man(S.debt) + D.U("won")), 2);
            pushK("kim", T("repay.kim", "a", won(a)));
        }
        bool repayDo(double a)
        {
            a = Math.Floor(double.IsNaN(a) ? 0 : a);
            if (a <= 0) return false;
            repay(a);
            stress(-8); hp(-hpCost("bank"));
            M(T("repay.m", "a", won(a)), "happy"); hideDlg();
            return true;
        }

        // ---------- 상점: 꾸미기 ----------
        void shopBuy(string id)
        {
            var P = S.pending;
            if (id == "hoodie") { if (S.owned.Has("hoodie")) S.outfit = "hoodie"; Emit("outfit"); return; }
            var it = D.ITEMS.FirstOrDefault(x => x.id == id); if (it == null) return;
            bool own = it.type == "outfit" ? S.owned.Has(id) : S.props.Has(id);
            if (own) { if (it.type == "outfit") { S.outfit = id; Emit("outfit"); } return; }
            if (S.cash < it.p) return;
            S.cash -= it.p; S.st.decor += it.p; P.bought++;
            S.today.Add(new Ledger { kind = "shop", amt = -it.p, label = it.name });
            if (it.type == "outfit") { S.owned.Set(id, 1); S.outfit = id; } else S.props.Set(id, 1);
            Emit("bought", "id", id);
            bubble(it.line, 2600, "happy");
            stress(it.st.HasValue && it.st.Value != 0 ? it.st.Value : -8);
            galReact("shop", V("item", it.name, "conv", conv(it.p)), 2);
            pushK("m", T("shop.k", "ic", it.ic));
        }
        bool shopDone()
        {
            var P = S.pending;
            Emit("panelEnd", "k", "shop");
            if (P.bought != 0) { S.workStreak = 0; hp(-hpCost("shop")); face("happy"); M(fpick(TA("shop.after")), "happy"); hideDlg(); }
            return P.bought > 0;
        }

        // ---------- 증권사 리포트 ----------
        bool brokerTip()
        {
            S.repT = Tnow();
            hp(-hpCost("tip"));
            int n = 1 + (rnd() < 0.5 ? 1 : 0); var got = new List<Tip>();
            for (int i = 0; i < n; i++) { var t = rollTip(PARK); tipAnnounce(t, "broker"); got.Add(t); }
            npc("broker", "smile");
            NPC(D.NPC_NAME["broker"], T("broker.say", "l", string.Join(", ", got.Select(t => T("broker.item", "n", D.TK[t.tk].name, "o", T(t.dir > 0 ? "broker.buy" : "broker.cut"), "w", whenLabel(t.Tr))))));
            tut("tip1");
            M(fpick(TA("broker.m")) + T("broker.note"), "tired");
            hideDlg();
            return true;
        }

        // ---------- 사채 ----------
        public double loanFee() => has("loanbro") ? R.LOAN_FEE_BRO : R.LOAN_FEE;
        bool borrow(double L)
        {
            var P = S.pending; double fr = loanFee();
            if (!R.LOAN_AMTS.Contains(L) || S.debt + L > loanCap()) return false;
            double net = rhu(L * (1 - fr));
            addDebt(L, T("lbl.loanDebt")); S.cash += net; S.st.borrowed += L; P.took += L; fame(1);
            S.today.Add(new Ledger { kind = "loan", amt = net, label = T("lbl.loan", "f", rhu(fr * 100)) });
            if (has("loanbro")) augFx("loanbro", T("aug.loanbro"));
            bubble(T(L >= 3e6 ? "loan.big" : "loan.small"), 2200, "smug");
            return true;
        }
        double loanDone()
        {
            var P = S.pending; double took = P.took; int f = has("loanbro") ? 5 : 10;
            if (took != 0) { pushF("💸", T("loan.feed", "a", won(took), "f", f), "money"); galReact("loan", V("fee", f), 2); pushK("kim", T("loan.kim", "a", won(took))); }
            return took;
        }

        // ---------- 길에서 만난 사람 ----------
        void encounterStart(string id, string loc)
        {
            var d = D.SRC[id];
            scene("map", "face", "neutral", "mode", "loc"); npc(d.npc);
            NPC(d.name, d.line);
            tut("walk");
            S.pending = new Pending("encounter")
            {
                id = id, loc = loc, opts = new List<Opt> {
                    new Opt { k = "enc-ask", l = d.cost != 0 ? T("enc.askPaid", "c", man(d.cost)) : T("enc.askFree"), sub = T("enc.askSub", "ic", d.ic, "t", stars(d.trust), "r", stars(d.ret), "rec", srcRec(id)), dis = S.cash < d.cost },
                    new Opt { k = "enc-ignore", l = T("enc.ignore"), sub = T("enc.ignoreSub") } }
            };
        }
        bool encounterAnswer(bool ask)
        {
            var P = S.pending; string id = P.id; var d = D.SRC[id];
            if (ask)
            {
                if (S.cash < d.cost) return false;
                if (d.cost != 0) money(-d.cost, "ev", T("lbl.encFee", "n", d.name));
                var t = rollTip(id); tipAnnounce(t, "walk");
                NPC(d.name, T("enc.tell", "n", D.TK[t.tk].name, "w", whenLabel(t.Tr), "d", T(t.dir > 0 ? "enc.up" : "enc.dn")));
                M(fpick(D.TIP_REACT["walk"]) + T("enc.note"), "smug");
            }
            else M(fpick(TA("enc.ignored")), "tired");
            hideDlg(); npc(null);
            return true;
        }

        // ---------- 유품 상점 ----------
        List<Aug> notOwned() => D.AUGS.Where(a => !has(a.id)).ToList();
        Aug tierPick(List<Aug> list)
        {
            var W = R.RELIC_TIER_W; double r = rnd();
            int tier = r < W[0] ? 1 : r < W[0] + W[1] ? 2 : 3;
            var pool = list.Where(a => a.tier == tier).ToList();
            var L = pool.Count > 0 ? pool : list;
            return L[(int)Math.Floor(rnd() * L.Count)];
        }
        public List<string> relicOffer()
        {
            if (S.relicOffer == null || S.relicOffer.d != absDay())
            {
                var pool = notOwned(); var ids = new List<string>();
                while (ids.Count < 3 && pool.Count > 0) { var a = tierPick(pool); ids.Add(a.id); pool.Remove(a); }
                S.relicOffer = new RelicOffer { d = absDay(), ids = ids };
            }
            return S.relicOffer.ids.Where(id => !has(id)).ToList();
        }
        public double relicPrice(string id) => R.RELIC_PRICE[D.AUGS.First(a => a.id == id).tier.ToString()];
        void relicShopStart() { relicOffer(); S.pending = new Pending("relicShop") { bought = 0, pulls = 0, last = null }; }
        void gainRelic(string id, string how)
        {
            var a = D.AUGS.First(x => x.id == id);
            S.augs.Add(id);
            augFx(id, T("aug.got"));
            galReact("aug", V("aug", a.name), 2);
            pushK("m", T("aug.k", "n", a.name));
            Emit("relic", "id", id, "how", how);
        }
        bool gachaRelic()
        {
            var P = S.pending; double price = R.GACHA_PRICE;
            if (S.cash < price) return false;
            S.cash -= price; P.pulls++; P.bought++; S.st.gacha++;
            S.today.Add(new Ledger { kind = "shop", amt = -price, label = T("lbl.gacha") });
            var pool = notOwned();
            if (pool.Count == 0 || rnd() < R.GACHA_JUNK)
            {
                int j = (int)Math.Floor(rnd() * D.RELIC_JUNK.Count);
                P.last = new GachaLast { junk = j };
                Emit("gacha", "junk", j, "text", D.RELIC_JUNK[j]);
                bubble(fpick(TA("gacha.junkM")), 2200, "tired");
                return true;
            }
            var a = tierPick(pool);
            P.last = new GachaLast { id = a.id };
            Emit("gacha", "id", a.id);
            gainRelic(a.id, "gacha");
            bubble(a.tier == 3 ? T("gacha.prism") : fpick(TA("gacha.hitM")), 2200, a.tier == 3 ? "flex" : "smug");
            return true;
        }
        bool buyRelic(string id)
        {
            var P = S.pending;
            if (!relicOffer().Contains(id)) return false;
            double price = relicPrice(id);
            if (S.cash < price) return false;
            S.cash -= price; P.bought++;
            S.today.Add(new Ledger { kind = "shop", amt = -price, label = T("lbl.relic", "n", D.AUGS.First(a => a.id == id).name) });
            gainRelic(id, "buy");
            bubble(fpick(TA("relic.buyM")), 2200, "smug");
            return true;
        }
        bool relicDone()
        {
            var P = S.pending;
            Emit("panelEnd", "k", "relicShop");
            if (P.bought != 0) { S.workStreak = 0; hp(-hpCost("relic")); M(fpick(TA("relic.after")), "smug"); hideDlg(); }
            return P.bought > 0;
        }
    }
}
