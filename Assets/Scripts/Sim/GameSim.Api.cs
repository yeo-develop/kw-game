using System;
using System.Collections.Generic;
using System.Linq;

namespace KwGame.Sim
{
    // api.js — createGame · apply(명령) · query
    public partial class GameSim
    {
        public class Opts { public bool tut; }

        /// 새 게임 (createGame). rngv 2 만 지원 (rngv 1 은 웹 회귀 비교 전용).
        public static GameSim Create(GameData data, int seed, Opts opts = null)
        {
            var g = new GameSim(data);
            var r = data.RULES;
            var S = new GameState
            {
                seed = seed, rng = unchecked((uint)seed), fx = unchecked((uint)(seed ^ 0x2545F491)),
                debt = r.DEBT0, cash = r.CASH0, hp = r.HP_MAX,
            };
            S.owned.Set("hoodie", 1);
            S.st.maxDebt = r.DEBT0; S.st.maxAsset = r.CASH0; S.st.minDebt = r.DEBT0;
            g.S = S;
            S.optTut = opts != null && opts.tut;
            S.mk = g.initMarket(); S.news = g.genNews();
            S.pending = new Pending("start");
            g.ev.Clear();
            return g;
        }

        /// 명령 처리 → 이번 명령에서 나온 이벤트들
        public List<SimEvent> Apply(SimCommand c)
        {
            ev = new List<SimEvent>();
            handle(c ?? new SimCommand(new Newtonsoft.Json.Linq.JObject()));
            run();
            var e = ev; ev = new List<SimEvent>();
            return e;
        }

        /// 읽기 전용 계산 (난수 상태 되돌림) — query.js
        public T Query<T>(Func<T> f)
        {
            uint r0 = S.rng, f0 = S.fx; var e0 = ev; ev = new List<SimEvent>();
            try { return f(); } finally { S.rng = r0; S.fx = f0; ev = e0; }
        }

        static readonly string[] PHONE_OK = { "home", "map", "loc", "brokerTrade" };
        static readonly string[] PHONE_CMDS = { "buy", "sell", "open", "close", "closeCoins", "report", "kqReply", "post", "upvote" };
        bool err(string msg) { Emit("error", "msg", msg); return false; }

        void visit(string key) { S.visit = new Visit { key = key, used = false }; S.pending = new Pending("loc") { key = key, first = true }; }
        void actDone(bool r)
        {
            var Vv = S.visit;
            if (r) { Vv.used = true; if (Vv.key != "broker") { S.visit = null; slotUsed(); return; } }
            S.pending = new Pending("loc") { key = Vv.key, first = false };
        }
        void restHome()
        {
            S.workStreak = 0;
            stress(-22); hp(isEve() ? R.HP_REST_EVE : R.HP_REST, T("why.rest"));
            face("tired");
            M(fpick(TA("rest.m")), "tired");
            galReact("rest", null, 1);
            hideDlg();
        }
        bool act(string k)
        {
            string key = S.visit.key; var o = locOpts(key).FirstOrDefault(x => x.k == k);
            if (o == null || o.dis) return err("act " + k);
            switch (k)
            {
                case "l-trade": S.pending = new Pending("brokerTrade") { n0 = S.st.invest }; return true;
                case "l-tip": actDone(brokerTip()); return true;
                case "l-payint": actDone(payEarly()); return true;
                case "l-repay": if (!repayStart(key)) actDone(false); return true;
                case "l-oddeven": case "l-card": case "l-slot": case "l-ladder": casinoStart(k.Substring(2), key); return true;
                case "l-cafe": case "l-store": case "l-ware": case "l-mart": workStart(k.Substring(2), key); return true;
                case "l-pcgame": actDone(doPc("game")); return true;
                case "l-pcramen": actDone(doPc("ramen")); return true;
                case "l-shop": S.pending = new Pending("shop") { bought = 0 }; return true;
                case "l-relic": relicShopStart(); return true;
                case "l-scratch": scratchStart(key); return true;
                case "l-lotto": lottoStart(key); return true;
                case "l-race": raceStart(key); return true;
            }
            return err("act " + k);
        }
        bool sub(Sub r) { if (r != null && r.err != null) return err(r.err); if (r != null && r.done.HasValue) actDone(r.done.Value); return true; }

        bool phone(SimCommand c)
        {
            double fee = stockFee(c.Str("where"));
            switch (c.t)
            {
                case "buy":
                    {
                        string tk = c.Str("tk"); var r = buyStock(tk, c.Num("amt"), fee);
                        if (r.HasValue && r.Value != 0) galReact("trade", V("tk", D.TK[tk].name, "side", T("side.buy")), 1);
                        Emit("trade", "op", "buy", "ok", r.HasValue && r.Value != 0, "amt", r, "tk", tk); return true;
                    }
                case "sell":
                    {
                        double frac = c.Truthy("frac") ? c.Num("frac") : 1;
                        var r = sellStock(c.Str("tk"), frac, fee);
                        Emit("trade", "op", "sell", "ok", r.HasValue, "pnl", r, "tk", c.Str("tk"), "frac", frac); return true;
                    }
                case "open":
                    {
                        string tk = c.Str("tk"); int dir = c.Int("dir", 0);
                        var cc = openCoin(tk, dir, c.Num("lev"), c.Num("amt"));
                        if (cc != null) galReact("trade", V("tk", D.TK[tk].name, "side", T("side.coin", "lev", cc.lev, "d", T(dir > 0 ? "long" : "short"))), 1);
                        Emit("trade", "op", "open", "ok", cc != null, "id", cc?.id, "tk", tk, "dir", dir, "lev", cc?.lev, "margin", cc?.margin); return true;
                    }
                case "close":
                    {
                        int id = c.Int("id", int.MinValue); var x = S.cps.FirstOrDefault(y => y.id == id);
                        double? r = x != null ? closeCoin(x) : null;
                        Emit("trade", "op", "close", "ok", r.HasValue, "pnl", r, "tk", x?.tk); return true;
                    }
                case "closeCoins":
                    {
                        double s = 0; foreach (var x in S.cps.Where(y => y.t0 != Tnow()).ToList()) s += closeCoin(x) ?? 0;
                        Emit("trade", "op", "closeCoins", "ok", true, "pnl", s); return true;
                    }
                case "report":
                    {
                        bool paid = c.Truthy("paid"); var t = getReport(paid);
                        if (t != null) tipAnnounce(t, "app");
                        Emit("report", "ok", t != null, "id", t?.id, "paid", paid); return true;
                    }
                case "kqReply": kqReply(c.Int("i")); return true;
                case "post": { var p = submitPost(c.Str("k")); Emit("posted", "id", p?.id); return true; }
                case "upvote": upvote(c.Int("id", int.MinValue)); return true;
            }
            return false;
        }

        void handle(SimCommand c)
        {
            var P = S.pending; string pt = P?.t; string t = c.t;
            if (t == "read")
            {
                string what = c.Str("what");
                if (what == "kakao") { string room = c.Str("room"); if (room != null) S.kun[room] = 0; }
                if (what == "gall") { S.gNew = 0; if (c.Truthy("mine")) S.gReact = 0; }
                if (what == "news") S.fUnread = 0;
                return;
            }
            if (t == "guide") { S.tg = c.Str("seg") ?? ""; if (c.Str("seg") == "home2") S.tgT = Tnow(); if (c.Truthy("reset")) S.tutSeen = new Dictionary<string, int>(); return; }
            if (t == "tutSeen") { S.tutSeen[c.Str("k") ?? "undefined"] = 1; return; }
            if (t == "debug") { debug(c.Str("k")); return; }
            if (PHONE_CMDS.Contains(t))
            {
                if (!PHONE_OK.Contains(pt)) { err("phone@" + (pt ?? "undefined")); return; }
                if (t == "open" && !tkOpen(c.Str("tk"))) { err("locked"); return; }
                phone(c); return;
            }
            switch (pt)
            {
                case "start":
                    if (t != "start") break;
                    S.pending = null;
                    pushK("sys", T("open.k1")); pushK("m", T("open.k2"));
                    Emit("opening");
                    pushK("m", T("open.k3"));
                    galReact("start", null, 4);
                    after("tutInit", "loopTop");
                    relicStart(T("aug.reasonStart"));
                    return;
                case "relic":
                    if (t == "pickRelic") { if (!relicPick(c.Int("i"))) err("relic"); return; }
                    if (t == "relicReroll") { if (!relicReroll()) err("reroll"); return; }
                    break;
                case "relicShop":
                    if (t == "gachaRelic") { if (!gachaRelic()) err("gacha"); return; }
                    if (t == "buyRelic") { if (!buyRelic(c.Str("id"))) err("buyRelic"); return; }
                    if (t == "relicDone") { actDone(relicDone()); return; }
                    break;
                case "tempt":
                    if (t == "tempt") { if (!temptCmd(c.Str("k"))) err("tempt"); return; }
                    break;
                case "impulse":
                    if (t == "reply") { if (!impulseReply(c.Int("i"))) err("reply"); return; }
                    break;
                case "ending":
                    if (t == "continue") { if (!continueGame()) err("continue"); return; }
                    break;
                case "home":
                    if (t == "rest") { S.pending = null; restHome(); slotUsed(); return; }
                    if (t == "map") { S.pending = new Pending("map"); return; }
                    if (t == "loanOpen") { S.pending = new Pending("loan") { took = 0 }; return; }
                    break;
                case "loan":
                    if (t == "borrow") { if (!borrow(c.Num("amt"))) err("borrow"); return; }
                    if (t == "loanDone") { loanDone(); toHome(); return; }
                    break;
                case "map":
                    if (t == "goTo")
                    {
                        string locK = c.Str("loc");
                        if (locK == "home") { toHome(); return; }
                        if (locK == null || !D.LOCS.TryGetValue(locK, out var L) || !L.open.Contains(S.slot)) { err("closed"); return; }
                        string w = !string.IsNullOrEmpty(S.tg) ? null : encounterRoll();
                        if (w != null) encounterStart(w, locK); else visit(locK);
                        return;
                    }
                    break;
                case "encounter":
                    if (t == "encounter") { if (!encounterAnswer(c.Truthy("ask"))) { err("enc"); return; } visit(P.loc); return; }
                    break;
                case "loc":
                    if (t == "act") { act(c.Str("k")); return; }
                    if (t == "leave") { bool used = S.visit.used; S.visit = null; if (used) slotUsed(); else toHome(); return; }
                    break;
                case "brokerTrade":
                    if (t == "brokerClose") { bool used = S.st.invest > P.n0; if (used) hp(-hpCost("trade")); actDone(used); return; }
                    break;
                case "work":
                    if (t == "mgSetup") { workSetup(c.Truthy("practice")); return; }
                    if (t == "mgResult") { if (P.setup == null || P.setup.practice) { err("mg"); return; } sub(workResult(c.Num("score"))); return; }
                    break;
                case "casino":
                    if (t == "bet") { sub(casinoBet(c.Num("stake"), c.Int("choice", int.MinValue))); return; }
                    if (t == "casinoLeave") { sub(casinoEnd()); return; }
                    break;
                case "race":
                    if (t == "raceBet") { sub(raceBet(c.Num("i"), c.Num("stake"))); return; }
                    if (t == "raceLeave") { Emit("panelEnd", "k", "race"); actDone(false); return; }
                    break;
                case "scratch":
                    if (t == "scratchBuy") { sub(scratchBuy()); return; }
                    if (t == "scratchReveal") { sub(scratchReveal()); return; }
                    if (t == "scratchDone") { sub(scratchDone()); return; }
                    break;
                case "lotto":
                    if (t == "lottoBuy") { sub(lottoBuy(c.Truthy("k") ? c.Int("k", 1) : 1)); return; }
                    if (t == "lottoDone") { sub(lottoDone()); return; }
                    break;
                case "repay":
                    if (t == "repay") { Emit("panelEnd", "k", "repay"); actDone(repayDo(c.Num("amt"))); return; }
                    break;
                case "shop":
                    if (t == "shopBuy") { shopBuy(c.Str("id")); return; }
                    if (t == "shopDone") { actDone(shopDone()); return; }
                    break;
                case "menhera":
                    if (t == "reply") { if (!menheraReply(c.Int("i"))) err("reply"); return; }
                    break;
                case "payday":
                    if (t == "payday") { if (!paydayCmd(c.Str("k"))) err("payday"); return; }
                    break;
            }
            err("cmd " + (t ?? "undefined") + " @ " + (pt ?? "undefined"));
        }
        void debug(string k)
        {
            if (k == "cash") S.cash += 10000000;
            if (k == "pay") { S.day = R.MONTH_DAYS; S.slot = R.SLOTS - 1; }
            if (k == "hp") S.hp = 5;
            if (k == "addict") S.addict = 85;
            if (k == "men") S.stress = 95;
            if (k == "zero") S.debt = 1000000;
            if (k == "aug") S.dbgAug = 1;
            Emit("debug", "k", k);
        }
    }
}
