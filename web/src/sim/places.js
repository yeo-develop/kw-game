/* sim/places.js — 장소 메뉴(locOpts) + 한 번에 끝나는 행동: 게임방 · 은행 · 상점 · 증권사 리포트 · 사채 · 길거리 정보. */
import { D, R, st, emit } from "./core.js";
import { rnd, pick, fpick } from "./rng.js";
import { T, won, man, stars, conv } from "./fmt.js";
import { has, absDay, Tnow, interestDue, loanCap, hpCost, jobHp } from "./state.js";
import { roundHalfUp } from "./num.js";
import { stress, money, addDebt, fame, augFx, pushK, pushF, hp } from "./effects.js";
import { galReact } from "./gall.js";
import { rollTip, tipAnnounce, whenLabel, srcRec } from "./tips.js";
import { M, N, NPC, hideDlg, bubble, face, npc, scene, tut } from "./talk.js";
import { PARK } from "./ids.js";

/* 장소 메뉴: [{k, ic, l, sub, dis}] (문구는 STR) */
export function locOpts(key) {
  const S = st(), hc = k => T("lo.hp", { h: hpCost(k) });
  switch (key) {
    case "broker": return [{ k: "l-trade", ic: "📊", l: T("lo.trade"), sub: has("vip") ? T("lo.tradeVip") : T("lo.tradeFee") }, { k: "l-tip", ic: "📄", l: T("lo.tip"), sub: T("lo.tipSub", { s: stars(4), r: srcRec(PARK) }) + hc("tip"), dis: S.repT === Tnow() }];
    case "bank": { const paid = S.paidMonth === S.month, due = interestDue(); return [{ k: "l-payint", ic: "🧾", l: paid ? T("lo.paid") : T("lo.payint", { d: man(due) }), sub: paid ? T("lo.paidSub") : T("lo.cash", { c: man(S.cash) }), dis: paid || S.cash < due }, { k: "l-repay", ic: "💳", l: T("lo.repay"), sub: T("lo.debt", { d: man(S.debt) }), dis: S.cash < 10000 }]; }
    case "casino": return [["oddeven", "🎲"], ["card", "🃏"], ["slot", "🎰"], ["ladder", "🪜"]].map(([k, ic]) => ({ k: "l-" + k, ic, l: T("lo." + k), sub: T("lo.nolimit") + hc("casino"), dis: S.cash < 10000 }));
    case "work": return Object.entries(D.JOBS).map(([k, J]) => ({ k: "l-" + k, ic: J.ic, l: J.name, sub: T("lo.pay", { a: man(J.base * (has("grind") ? R().GRIND_PAY : 1)), b: man((J.base + J.var) * (has("grind") ? R().GRIND_PAY : 1)), h: jobHp(J) }) + (S.hp <= jobHp(J) ? T("lo.faintRisk") : S.hp < R().HP_LOW ? T("lo.tiredPen") : "") }));
    case "pc": return [{ k: "l-pcgame", ic: "🕹️", l: T("lo.pcgame"), sub: T("lo.pcgameSub"), dis: S.cash < 10000 }, { k: "l-pcramen", ic: "🍜", l: T("lo.pcramen"), sub: T("lo.pcramenSub"), dis: S.cash < 6000 }];
    case "shop": return [{ k: "l-shop", ic: "👗", l: T("lo.shop"), sub: T("lo.shopSub") }, { k: "l-relic", ic: "🎁", l: T("lo.relic"), sub: T("lo.relicSub", { g: man(R().GACHA_PRICE) }) }];
    case "lotto": return [{ k: "l-scratch", ic: "🪙", l: T("lo.scratch"), sub: T("lo.scratchSub"), dis: S.cash < 5000 }, { k: "l-lotto", ic: "🔮", l: T("lo.lotto"), sub: T("lo.lottoSub"), dis: S.cash < 10000 }];
    case "race": return [{ k: "l-race", ic: "🏇", l: T("lo.race", { d: absDay() }), sub: T("lo.raceSub") + hc("race"), dis: S.cash < 10000 }];
  }
  return [];
}

/* ---------- 게임방 ---------- */
export function doPc(kind) {
  const S = st(), cost = R().PC_COST[kind];
  if (S.cash < cost) { M(T("pc.broke"), "cry"); hideDlg(); return false; }
  S.cash -= cost; S.st.pc++; S.workStreak = 0;
  S.today.push({ kind: "pc", amt: -cost, label: T(kind === "game" ? "lbl.pcgame" : "lbl.pcramen") });
  hp(-hpCost(kind === "game" ? "pcgame" : "pcramen"));
  if (kind === "ramen") {
    stress(-12);
    M(T("pc.ramen"), "happy");
  } else {
    stress(-20);
    const ev = pick(D.PC_EV);
    if (ev.st) stress(ev.st); if (ev.hp) hp(ev.hp); if (ev.fame) fame(ev.fame); if (ev.cash) S.cash += ev.cash;
    N("🎮 " + ev.t);
    M(fpick(D.STR["pc.after"]), "happy");
  }
  galReact("pc", {}, 1);
  hideDlg();
  return true;
}

/* ---------- 은행 ---------- */
const BANK = () => D.NPCS.bank.name;
export function payEarly() {
  const S = st(), due = interestDue();
  if (S.paidMonth === S.month) { NPC(BANK(), T("bank.already")); hideDlg(); return false; }
  if (S.cash < due) { NPC(BANK(), T("bank.short", { d: won(due), c: won(S.cash) })); hideDlg(); return false; }
  money(-due, "interest", T("lbl.payEarly", { m: S.month })); pushF("🧾", T("bank.feed", { m: S.month, d: won(due) }), "money"); S.st.interest += due; S.paidMonth = S.month;
  pushK("kim", T("bank.kim", { m: S.month, d: won(due) }));
  stress(-10); hp(-hpCost("bank"));
  NPC(BANK(), T("bank.done", { d: won(due) }));
  M(T("bank.m"), "happy"); hideDlg();
  return true;
}
export function repayStart(loc) {
  const S = st(), mx = Math.floor(Math.min(S.cash, S.debt) / 10000) * 10000, due = S.paidMonth === S.month ? 0 : interestDue();
  if (mx < 10000) { NPC(BANK(), T("bank.noCash")); hideDlg(); return false; }
  S.pending = { t: "repay", loc, mx, due };
  return null;
}
export function repay(a) {
  const S = st();
  a = Math.min(a, S.debt, S.cash);
  S.cash -= a; S.debt -= a; S.st.repaid += a; S.st.minDebt = Math.min(S.st.minDebt, S.debt);
  S.today.push({ kind: "repay", amt: -a, label: T("lbl.repay") });
  emit("repaid", { a });
  galReact("repay", { debt: man(S.debt) + D.STR.U.won }, 2);
  pushK("kim", T("repay.kim", { a: won(a) }));
}
export function repayDo(a) {
  a = Math.floor(+a || 0);
  if (a <= 0) return false;
  repay(a);
  stress(-8); hp(-hpCost("bank"));
  M(T("repay.m", { a: won(a) }), "happy"); hideDlg();
  return true;
}

/* ---------- 상점: 꾸미기 ---------- */
export function shopBuy(id) {
  const S = st(), P = S.pending;
  if (id === "hoodie") { if (S.owned.hoodie) S.outfit = "hoodie"; emit("outfit", {}); return; }
  const it = D.ITEMS.find(x => x.id === id); if (!it) return;
  const own = it.type === "outfit" ? S.owned[id] : S.props[id];
  if (own) { if (it.type === "outfit") { S.outfit = id; emit("outfit", {}); } return; }
  if (S.cash < it.p) return;
  S.cash -= it.p; S.st.decor += it.p; P.bought++;
  S.today.push({ kind: "shop", amt: -it.p, label: it.name });
  if (it.type === "outfit") { S.owned[id] = 1; S.outfit = id; } else { S.props[id] = 1; }
  emit("bought", { id });
  bubble(it.line, 2600, "happy");
  stress(it.st || -8);
  galReact("shop", { item: it.name, conv: conv(it.p) }, 2);
  pushK("m", T("shop.k", { ic: it.ic }));
}
export function shopDone() {
  const S = st(), P = S.pending;
  emit("panelEnd", { k: "shop" });
  if (P.bought) { S.workStreak = 0; hp(-hpCost("shop")); face("happy"); M(fpick(D.STR["shop.after"]), "happy"); hideDlg(); }
  return P.bought > 0;
}

/* ---------- 증권사: 박대리 리포트 (방문 1칸) ---------- */
export function brokerTip() {
  const S = st();
  S.repT = Tnow();
  hp(-hpCost("tip"));
  const n = 1 + (rnd() < 0.5 ? 1 : 0), got = [];
  for (let i = 0; i < n; i++) { const t = rollTip(PARK); tipAnnounce(t, "broker"); got.push(t); }
  npc("broker", "smile");
  NPC(D.NPCS.broker.name, T("broker.say", { l: got.map(t => T("broker.item", { n: D.TK[t.tk].name, o: T(t.dir > 0 ? "broker.buy" : "broker.cut"), w: whenLabel(t.Tr) })).join(", ") }));
  tut("tip1");
  M(fpick(D.STR["broker.m"]) + T("broker.note"), "tired");
  hideDlg();
  return true;
}

/* ---------- 돈 땡기기 (김사장 사채, 한도 단계적) ---------- */
export const loanFee = () => has("loanbro") ? R().LOAN_FEE_BRO : R().LOAN_FEE;
export function borrow(L) {
  const S = st(), P = S.pending, fr = loanFee();
  if (!R().LOAN_AMTS.includes(L) || S.debt + L > loanCap()) return false;
  const net = roundHalfUp(L * (1 - fr));
  addDebt(L, T("lbl.loanDebt")); S.cash += net; S.st.borrowed += L; P.took += L; fame(1);
  S.today.push({ kind: "loan", amt: net, label: T("lbl.loan", { f: roundHalfUp(fr * 100) }) });
  if (has("loanbro")) augFx("loanbro", T("aug.loanbro"));
  bubble(T(L >= 3e6 ? "loan.big" : "loan.small"), 2200, "smug");
  return true;
}
export function loanDone() {
  const S = st(), P = S.pending, took = P.took, f = has("loanbro") ? 5 : 10;
  if (took) { pushF("💸", T("loan.feed", { a: won(took), f }), "money"); galReact("loan", { fee: f }, 2); pushK("kim", T("loan.kim", { a: won(took) })); }
  return took;
}

/* ---------- 길에서 만난 사람 ---------- */
export function encounterStart(id, loc) {
  const S = st(), d = D.SRC[id];
  scene("map", { face: "neutral", mode: "loc" }); npc(d.npc);
  NPC(d.name, d.line);
  tut("walk");
  S.pending = { t: "encounter", id, loc, opts: [
    { k: "enc-ask", l: d.cost ? T("enc.askPaid", { c: man(d.cost) }) : T("enc.askFree"), sub: T("enc.askSub", { ic: d.ic, t: stars(d.trust), r: stars(d.ret), rec: srcRec(id) }), dis: S.cash < d.cost },
    { k: "enc-ignore", l: T("enc.ignore"), sub: T("enc.ignoreSub") }] };
}
export function encounterAnswer(ask) {
  const S = st(), P = S.pending, id = P.id, d = D.SRC[id];
  if (ask) {
    if (S.cash < d.cost) return false;
    if (d.cost) money(-d.cost, "ev", T("lbl.encFee", { n: d.name }));
    const t = rollTip(id); tipAnnounce(t, "walk");
    NPC(d.name, T("enc.tell", { n: D.TK[t.tk].name, w: whenLabel(t.Tr), d: T(t.dir > 0 ? "enc.up" : "enc.dn") }));
    M(fpick(D.TIP_REACT.walk) + T("enc.note"), "smug");
  } else M(fpick(D.STR["enc.ignored"]), "tired");
  hideDlg(); npc(null);
  return true;
}

/* ---------- 상점: 부모님 유품 · 수상한 물건 (구 증강) ----------
   싸게 랜덤 뽑기(GACHA_PRICE, GACHA_JUNK 확률로 꽝 = 잡동사니) 또는 비싸게 골라 사기(RELIC_PRICE[등급]).
   진열 3개는 하루에 한 번 굴림 (S.relicOffer). 뭐라도 샀으면 칸 소모. */
const notOwned = () => D.AUGS.filter(a => !has(a.id));
function tierPick(list) {
  const W = R().RELIC_TIER_W, r = rnd();
  const tier = r < W[0] ? 1 : r < W[0] + W[1] ? 2 : 3;
  const pool = list.filter(a => a.tier === tier);
  const L = pool.length ? pool : list;
  return L[Math.floor(rnd() * L.length)];
}
export function relicOffer() {
  const S = st();
  if (!S.relicOffer || S.relicOffer.d !== absDay()) {
    const pool = notOwned(), ids = [];
    while (ids.length < 3 && pool.length) { const a = tierPick(pool); ids.push(a.id); pool.splice(pool.indexOf(a), 1); }
    S.relicOffer = { d: absDay(), ids };
  }
  return S.relicOffer.ids.filter(id => !has(id));
}
export const relicPrice = id => R().RELIC_PRICE[String(D.AUGS.find(a => a.id === id).tier)];
export function relicShopStart() { const S = st(); relicOffer(); S.pending = { t: "relicShop", bought: 0, pulls: 0, last: null }; }
export function gainRelic(id, how) {
  const S = st(), a = D.AUGS.find(x => x.id === id);
  S.augs.push(id);
  augFx(id, T("aug.got"));
  galReact("aug", { aug: a.name }, 2);
  pushK("m", T("aug.k", { n: a.name }));
  emit("relic", { id, how });
}
export function gachaRelic() {
  const S = st(), P = S.pending, price = R().GACHA_PRICE;
  if (S.cash < price) return false;
  S.cash -= price; P.pulls++; P.bought++; S.st.gacha++;
  S.today.push({ kind: "shop", amt: -price, label: T("lbl.gacha") });
  const pool = notOwned();
  if (!pool.length || rnd() < R().GACHA_JUNK) {
    const j = Math.floor(rnd() * D.RELIC_JUNK.length);
    P.last = { junk: j };
    emit("gacha", { junk: j, text: D.RELIC_JUNK[j] });
    bubble(fpick(D.STR["gacha.junkM"]), 2200, "tired");
    return true;
  }
  const a = tierPick(pool);
  P.last = { id: a.id };
  emit("gacha", { id: a.id });
  gainRelic(a.id, "gacha");
  bubble(a.tier === 3 ? T("gacha.prism") : fpick(D.STR["gacha.hitM"]), 2200, a.tier === 3 ? "flex" : "smug");
  return true;
}
export function buyRelic(id) {
  const S = st(), P = S.pending;
  if (!relicOffer().includes(id)) return false;
  const price = relicPrice(id);
  if (S.cash < price) return false;
  S.cash -= price; P.bought++;
  S.today.push({ kind: "shop", amt: -price, label: T("lbl.relic", { n: D.AUGS.find(a => a.id === id).name }) });
  gainRelic(id, "buy");
  bubble(fpick(D.STR["relic.buyM"]), 2200, "smug");
  return true;
}
export function relicDone() {
  const S = st(), P = S.pending;
  emit("panelEnd", { k: "relicShop" });
  if (P.bought) { S.workStreak = 0; hp(-hpCost("relic")); M(fpick(D.STR["relic.after"]), "smug"); hideDlg(); }
  return P.bought > 0;
}
