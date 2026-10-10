/* sim/api.js — 공개 API: createGame(seed, opts) · apply(state, cmd) → {state, events}.
   apply 는 state 를 제자리에서 바꾸고 같은 객체를 돌려준다 (보존하려면 호출 전에 clone).
   명령 목록·이벤트 목록은 docs/ARCHITECTURE.md 참고. */
import { D, R, st, bind, unbind, emit } from "./core.js";
import { fpick } from "./rng.js";
import { T } from "./fmt.js";
import { newState, Tnow, tkOpen, isEve, hpCost } from "./state.js";
import { initMarket, genNews } from "./market.js";
import { stress, pushK, hp } from "./effects.js";
import { galReact, kqReply, submitPost, upvote } from "./gall.js";
import { getReport, tipAnnounce, encounterRoll } from "./tips.js";
import { buyStock, sellStock, openCoin, closeCoin, stockFee } from "./trade.js";
import { workStart, workSetup, workResult, casinoStart, casinoBet, casinoEnd, raceStart, raceBet, scratchStart, scratchBuy, scratchReveal, scratchDone, lottoStart, lottoBuy, lottoDone } from "./games.js";
import { locOpts, doPc, payEarly, repayStart, repayDo, shopBuy, shopDone, brokerTip, borrow, loanDone, encounterStart, encounterAnswer, relicShopStart, gachaRelic, buyRelic, relicDone } from "./places.js";
import { run, after, slotUsed, toHome, relicStart, relicReroll, relicPick, paydayCmd, menheraReply, impulseReply, temptCmd, continueGame } from "./flow.js";
import { M, hideDlg, face } from "./talk.js";

export function createGame(seed, opts = {}) {
  const S = newState(seed, opts.rngv === 1 ? 1 : 2);
  bind(S);
  S.optTut = !!opts.tut;
  S.mk = initMarket(); S.news = genNews();
  S.pending = { t: "start" };
  unbind();
  return S;
}

const PHONE_OK = ["home", "map", "loc", "brokerTrade"];
const err = msg => { emit("error", { msg }); return false; };

/* 장소 방문 */
function visit(key) { const S = st(); S.visit = { key, used: false }; S.pending = { t: "loc", key, first: true }; }
/* 장소 행동 끝: r = 칸을 썼는지 (증권사는 같은 방문에서 더 할 수 있음) */
function actDone(r) {
  const S = st(), V = S.visit;
  if (r) { V.used = true; if (V.key !== "broker") { S.visit = null; slotUsed(); return; } }
  S.pending = { t: "loc", key: V.key, first: false };
}
function restHome() {
  const S = st();
  S.workStreak = 0;
  stress(-22); hp(isEve() ? R().HP_REST_EVE : R().HP_REST, T("why.rest"));
  face("tired");
  M(fpick(D.STR["rest.m"]), "tired");
  galReact("rest", {}, 1);
  hideDlg();
}
function act(k) {
  const S = st(), key = S.visit.key, o = locOpts(key).find(x => x.k === k);
  if (!o || o.dis) return err("act " + k);
  switch (k) {
    case "l-trade": S.pending = { t: "brokerTrade", n0: S.st.invest }; return true;
    case "l-tip": return actDone(brokerTip()), true;
    case "l-payint": return actDone(payEarly()), true;
    case "l-repay": if (repayStart(key) === false) actDone(false); return true;
    case "l-oddeven": case "l-card": case "l-slot": case "l-ladder": casinoStart(k.slice(2), key); return true;
    case "l-cafe": case "l-store": case "l-ware": case "l-mart": workStart(k.slice(2), key); return true;
    case "l-pcgame": return actDone(doPc("game")), true;
    case "l-pcramen": return actDone(doPc("ramen")), true;
    case "l-shop": S.pending = { t: "shop", bought: 0 }; return true;
    case "l-relic": relicShopStart(); return true;
    case "l-scratch": scratchStart(key); return true;
    case "l-lotto": lottoStart(key); return true;
    case "l-race": raceStart(key); return true;
  }
  return err("act " + k);
}
const sub = r => { if (r && r.err) return err(r.err); if (r && "done" in r) actDone(r.done); return true; };

/* 폰 명령 (칸 소모 없음) */
function phone(c) {
  const S = st(), fee = stockFee(c.where);
  switch (c.t) {
    case "buy": { const r = buyStock(c.tk, c.amt, fee); if (r) galReact("trade", { tk: D.TK[c.tk].name, side: T("side.buy") }, 1); emit("trade", { op: "buy", ok: !!r, amt: r, tk: c.tk }); return true; }
    case "sell": { const r = sellStock(c.tk, c.frac || 1, fee); emit("trade", { op: "sell", ok: r != null, pnl: r, tk: c.tk, frac: c.frac || 1 }); return true; }
    case "open": { const cc = openCoin(c.tk, c.dir, c.lev, c.amt); if (cc) galReact("trade", { tk: D.TK[c.tk].name, side: T("side.coin", { lev: cc.lev, d: T(c.dir > 0 ? "long" : "short") }) }, 1); emit("trade", { op: "open", ok: !!cc, id: cc && cc.id, tk: c.tk, dir: c.dir, lev: cc && cc.lev, margin: cc && cc.margin }); return true; }
    case "close": { const x = S.cps.find(y => y.id === c.id); const r = x ? closeCoin(x) : null; emit("trade", { op: "close", ok: r != null, pnl: r, tk: x && x.tk }); return true; }
    case "closeCoins": { let s = 0; S.cps.filter(x => x.t0 !== Tnow()).forEach(x => s += closeCoin(x) || 0); emit("trade", { op: "closeCoins", ok: true, pnl: s }); return true; }
    case "report": { const t = getReport(!!c.paid); if (t) tipAnnounce(t, "app"); emit("report", { ok: !!t, id: t && t.id, paid: !!c.paid }); return true; }
    case "kqReply": kqReply(c.i); return true;
    case "post": { const p = submitPost(c.k); emit("posted", { id: p && p.id }); return true; }
    case "upvote": upvote(c.id); return true;
  }
  return false;
}

export function apply(S, cmd) {
  bind(S);
  try { handle(cmd || {}); run(); }
  catch (e) { unbind(); throw e; }
  return { state: S, events: unbind() };
}
function handle(c) {
  const S = st(), P = S.pending || {}, pt = P.t;
  /* 어디서나 */
  if (c.t === "read") { if (c.what === "kakao") S.kun[c.room] = 0; if (c.what === "gall") { S.gNew = 0; if (c.mine) S.gReact = 0; } if (c.what === "news") S.fUnread = 0; return; }
  if (c.t === "guide") { S.tg = c.seg || ""; if (c.seg === "home2") S.tgT = Tnow(); if (c.reset) S.tutSeen = {}; return; }
  if (c.t === "tutSeen") { S.tutSeen[c.k] = 1; return; }
  if (c.t === "debug") return debug(c.k);
  if (["buy", "sell", "open", "close", "closeCoins", "report", "kqReply", "post", "upvote"].includes(c.t)) {
    if (!PHONE_OK.includes(pt)) return err("phone@" + pt);
    if ((c.t === "open") && !tkOpen(c.tk)) return err("locked");
    return phone(c);
  }
  switch (pt) {
    case "start":
      if (c.t !== "start") break;
      S.pending = null;
      pushK("sys", T("open.k1")); pushK("m", T("open.k2"));
      emit("opening");
      pushK("m", T("open.k3"));
      galReact("start", {}, 4);
      /* phase 는 유품 고를 때까지 opening (HUD 꺼짐), 고르면 home */
      after("tutInit", "loopTop");
      relicStart(T("aug.reasonStart"));
      return;
    case "relic":
      if (c.t === "pickRelic") return relicPick(c.i) || err("relic");
      if (c.t === "relicReroll") return relicReroll() || err("reroll");
      break;
    case "relicShop":
      if (c.t === "gachaRelic") return gachaRelic() || err("gacha");
      if (c.t === "buyRelic") return buyRelic(c.id) || err("buyRelic");
      if (c.t === "relicDone") { actDone(relicDone()); return; }
      break;
    case "tempt":
      if (c.t === "tempt") return temptCmd(c.k) || err("tempt");
      break;
    case "impulse":
      if (c.t === "reply") return impulseReply(c.i) || err("reply");
      break;
    case "ending":
      if (c.t === "continue") return continueGame() || err("continue");
      break;
    case "home":
      if (c.t === "rest") { S.pending = null; restHome(); slotUsed(); return; }
      if (c.t === "map") { S.pending = { t: "map" }; return; }
      if (c.t === "loanOpen") { S.pending = { t: "loan", took: 0 }; return; }
      break;
    case "loan":
      if (c.t === "borrow") return borrow(c.amt) || err("borrow");
      if (c.t === "loanDone") { loanDone(); toHome(); return; }
      break;
    case "map":
      if (c.t === "goTo") {
        if (c.loc === "home") { toHome(); return; }
        const L = D.LOCS[c.loc]; if (!L || !L.open.includes(S.slot)) return err("closed");
        const w = S.tg ? null : encounterRoll();   /* 첫날 가이드 중엔 길거리 이벤트 없음 */
        if (w) encounterStart(w, c.loc); else visit(c.loc);
        return;
      }
      break;
    case "encounter":
      if (c.t === "encounter") { if (!encounterAnswer(!!c.ask)) return err("enc"); visit(P.loc); return; }
      break;
    case "loc":
      if (c.t === "act") return act(c.k);
      if (c.t === "leave") { const used = S.visit.used; S.visit = null; if (used) slotUsed(); else toHome(); return; }
      break;
    case "brokerTrade":
      if (c.t === "brokerClose") { const used = S.st.invest > P.n0; if (used) hp(-hpCost("trade")); actDone(used); return; }
      break;
    case "work":
      if (c.t === "mgSetup") { workSetup(!!c.practice); return; }
      if (c.t === "mgResult") { if (!P.setup || P.setup.practice) return err("mg"); return sub(workResult(c.score)); }
      break;
    case "casino":
      if (c.t === "bet") return sub(casinoBet(c.stake, c.choice));
      if (c.t === "casinoLeave") return sub(casinoEnd());
      break;
    case "race":
      if (c.t === "raceBet") return sub(raceBet(c.i, c.stake));
      if (c.t === "raceLeave") { emit("panelEnd", { k: "race" }); actDone(false); return; }
      break;
    case "scratch":
      if (c.t === "scratchBuy") return sub(scratchBuy());
      if (c.t === "scratchReveal") return sub(scratchReveal());
      if (c.t === "scratchDone") return sub(scratchDone());
      break;
    case "lotto":
      if (c.t === "lottoBuy") return sub(lottoBuy(c.k || 1));
      if (c.t === "lottoDone") return sub(lottoDone());
      break;
    case "repay":
      if (c.t === "repay") { emit("panelEnd", { k: "repay" }); actDone(repayDo(c.amt)); return; }
      break;
    case "shop":
      if (c.t === "shopBuy") { shopBuy(c.id); return; }
      if (c.t === "shopDone") { actDone(shopDone()); return; }
      break;
    case "menhera":
      if (c.t === "reply") return menheraReply(c.i) || err("reply");
      break;
    case "payday":
      if (c.t === "payday") return paydayCmd(c) || err("payday");
      break;
  }
  err(`cmd ${c.t} @ ${pt}`);
}
function debug(k) {
  const S = st();
  if (k === "cash") S.cash += 10000000;
  if (k === "pay") { S.day = R().MONTH_DAYS; S.slot = R().SLOTS - 1; }
  if (k === "hp") S.hp = 5;
  if (k === "addict") S.addict = 85;
  if (k === "men") S.stress = 95;
  if (k === "zero") S.debt = 1000000;
  if (k === "aug") S.dbgAug = 1;
  emit("debug", { k });
}
