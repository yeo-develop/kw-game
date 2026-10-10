/* sim/flow.js — 하루 흐름 단계(step). S.flow = 남은 단계 이름 큐, S.pending = 플레이어 입력 대기.
   run(): pending 이 없으면 flow 앞에서 하나씩 꺼내 실행. 단계가 pending 을 세우면 멈춘다.
   하루 3칸(아침·점심·저녁): [아침] → 칸 시작 → [도박 유혹] → 집(입력) → 끝 판정 → 기절 판정 → 멘헤라/돌발 매수 → 칸 끝(빚또·이자일·시세) → 끝 판정 → … */
import { D, R, st, emit } from "./core.js";
import { rnd, pick, fpick } from "./rng.js";
import { clamp, roundHalfUp, round1k } from "./num.js";
import { T, fill, won, man, sgnWon, sgnMan, pct, conv } from "./fmt.js";
import { TKS, STK, has, mental, absDay, Tnow, interestDue, loanCap, tkOpen, stockOpen, isEve, stockVal, cEq, holdVal, liqPx, unreal, rankOf } from "./state.js";
import { curPlan, applyMarket, liqHit, genNews, addShock } from "./market.js";
import { rollTip, tipAnnounce, resolveTips, onTipsResolved, srcOf, resMark } from "./tips.js";
import { stress, money, addDebt, fame, augFx, pushK, pushKR, pushF, toast, hp, addict } from "./effects.js";
import { galReact, gallMarketPosts, gallTick, kqExpire, kqMaybe, hyMaybe, postById } from "./gall.js";
import { closeAll, buyStock, openCoin } from "./trade.js";
import { lottoDraw, isBig } from "./games.js";
import { repay } from "./places.js";
import { M, N, KIM, hideDlg, bubble, face, fx, scene, kim, react } from "./talk.js";
import { SUB } from "./ids.js";

export const after = (...steps) => { const S = st(); S.flow.unshift(...steps); };
/* 칸을 쓴 행동 뒤 */
export const AFTER_SLOT = ["endCheck", "faintCheck", "menCheck", "endSlot", "endCheck", "menCheck", "loopTop"];
export function slotUsed() { const S = st(); S.pending = null; after(...AFTER_SLOT); }
export function toHome() { const S = st(); S.pending = null; after("home"); }
const fainted = () => st().faint >= Tnow();

export function run() {
  const S = st();
  let guard = 0;
  while (!S.pending && S.flow.length) {
    if (++guard > 1000) throw new Error("flow loop");
    const k = S.flow.shift();
    STEPS[k]();
  }
}

/* ---------- 집 대사 (칸마다 1번 굴림, 게임 난수) ---------- */
function homeLine() {
  const S = st();
  if (S.hl && S.hl.T === Tnow()) return S.hl.t;
  const mt = mental();
  const L = mt === "men" ? D.STR["home.men"] : mt === "anx" ? D.STR["home.anx"] : S.hp < R().HP_LOW ? D.STR["home.tired"] : S.addict >= R().ADD_NAG && rnd() < 0.5 ? D.STR["home.addict"] : D.STR["home.slot"][S.slot];
  S.hl = { T: Tnow(), t: (S.day === R().MONTH_DAYS && isEve() && S.paidMonth !== S.month && S.debt > 0) ? T("home.payday", { d: man(interestDue()) }) : pick(L) };
  return S.hl.t;
}

/* ---------- 칸 시작: 시세 계획 → 찌라시·고래·카톡·갤 → 도박 중독 사건 ---------- */
function slotStart() {
  const S = st();
  if (S.startT === Tnow()) return; S.startT = Tnow();
  const P = curPlan();
  if (isEve() && has("whale")) { const tk = rnd() < 0.5 ? "BTK" : "TOK", d = P.r[tk] >= 0 ? 1 : -1; S.whale = { tk, dir: rnd() < 0.7 ? d : -d, T: Tnow() }; pushF("🐋", T("whale.feed", { n: D.TK[tk].name, d: T(S.whale.dir > 0 ? "whale.up" : "whale.dn") }), "intel"); }
  if (has("rumor")) { const t = rollTip(SUB); tipAnnounce(t, "sub"); }
  kqExpire(); kqMaybe(); hyMaybe(); gallTick();
  addictTick();
}
/* 도박 중독도: 30↑ 조름 · 60↑ 몰래 카지노 (현금 일부 날림, 가끔 땀) */
function addictTick() {
  const S = st(), Rr = R();
  if (fainted() || S.phase === "ending") return;
  if (S.addict >= Rr.ADD_SECRET && S.cash >= 50000 && rnd() < 0.12) {
    const amt = round1k(S.cash * (0.1 + rnd() * 0.2)), win = rnd() < 0.25, d = win ? amt : -amt;
    S.st.secret++;
    money(d, "gamble", T("lbl.secret")); S.st.gnet += d; S.st.gN++; if (win) S.st.gW++;
    addict(Rr.ADD_GAIN.secret, true);
    pushK("m", T(win ? "add.secretWinK" : "add.secretK", { a: won(amt) }));
    toast(T(win ? "add.secretWinT" : "add.secretT", { a: won(amt) }), win ? "good" : "liq", "kakao", "m");
    emit("addictEv", { k: "secret", amt: d });
    scene("room", { night: isEve(), face: win ? "flex" : "panic", mode: "home" });
    N(T(win ? "add.secretWinN" : "add.secretN", { a: won(amt), c: conv(amt) }));
    M(fpick(D.STR[win ? "add.secretWinM" : "add.secretM"]), win ? "flex" : "cry");
    hideDlg();
    return;
  }
  if (S.addict >= Rr.ADD_NAG && rnd() < 0.25) pushK("m", fpick(D.STR["add.nag"]));
}
/* 80↑: 행동 고르기 전에 도박 유혹 선택지 */
function temptStart() {
  const S = st();
  S.temptT = Tnow();
  emit("addictEv", { k: "tempt" });
  scene("room", { night: isEve(), face: "menhera", mode: "home" });
  M(fpick(D.STR["add.temptM"]), "menhera");
  S.pending = { t: "tempt", opts: [
    { k: "go", l: T("add.temptGo"), sub: T("add.temptGoSub", { a: won(temptStake()) }), dis: S.cash < 10000 },
    { k: "no", l: T("add.temptNo"), sub: T("add.temptNoSub") }] };
}
const temptStake = () => { const S = st(); return Math.max(10000, Math.floor(S.cash * 0.5 / 10000) * 10000); };
export function temptCmd(k) {
  const S = st(), P = S.pending, o = P.opts.find(x => x.k === k);
  if (!o || o.dis) return false;
  S.pending = null;
  if (k === "no") { stress(12); addict(-3); M(fpick(D.STR["add.temptNoM"]), "angry"); hideDlg(); after("home"); return true; }
  /* 딱 한 판: 홀짝 올인 반 (49%) */
  const stake = Math.min(S.cash, temptStake()), before = S.cash, win = rnd() < 0.49, net = win ? stake : -stake;
  S.cash += net; S.st.gamble++; S.st.tempt++; S.st.gN++; if (win) S.st.gW++; S.st.gnet += net; S.workStreak = 0;
  S.today.push({ kind: "gamble", amt: net, label: T("lbl.tempt") });
  emit("cash", { d: net });
  let a = R().ADD_GAIN.casino; if (win && isBig(net, before)) a += R().ADD_GAIN.bigwin;
  addict(a); hp(-R().HP_COST.casino);
  N(T(win ? "add.temptWinN" : "add.temptLoseN", { a: won(stake) }));
  react(net, { before, gamble: 1 });
  slotUsed();
  return true;
}

/* ---------- 아침 ---------- */
const kimFill = x => { const S = st(); return x.replace("{dd}", R().MONTH_DAYS - S.day).replace("{due}", won(interestDue())).replace("{debt}", won(S.debt)); };
function morning() {
  const S = st(), MD = R().MONTH_DAYS;
  S.phase = "morning";
  if (has("divi")) { const v = stockVal(); if (v >= 10000) { const d = roundHalfUp(v * 0.01); S.cash += d; pushF("💌", T("divi.feed", { d: won(d) }), "money"); S.today.push({ kind: "div", amt: d, label: T("lbl.divi") }); augFx("divi", T("aug.divi", { d: man(d) })); } }
  let ev = null;
  if (fainted()) ev = { t: T("morning.faint") };
  else if (rnd() < 0.4) {
    ev = pick(D.MORNING_EV);
    if (ev.cash) { S.cash += ev.cash; S.today.push({ kind: "ev", amt: ev.cash, label: T("lbl.morningEv") }); }
    if (ev.st) S.stress = clamp(S.stress + ev.st, 0, 100);
    if (ev.fame) fame(ev.fame);
    if (ev.hp) S.hp = clamp(S.hp + ev.hp, 0, R().HP_MAX);
  }
  if (!ev && S.hp < 40) ev = { t: T("morning.lowHp") };
  else if (!ev && S.stress < 20) ev = { t: T("morning.fresh") };
  S.stress = clamp(S.stress - 6, 0, 100);
  if (S.galFame >= D.FAME.gift && rnd() < 0.4) { const g = Math.min(200000, roundHalfUp((10000 + S.galFame * 1500) / 1000) * 1000); S.cash += g; S.today.push({ kind: "ev", amt: g, label: T("lbl.gift") }); S.stress = clamp(S.stress - 4, 0, 100); pushKR("hy", "hy", T("gift.hy", { g: won(g) })); pushF("🎁", T("gift.feed", { g: won(g), f: S.galFame }), "fame"); }
  if (S.paidMonth !== S.month && S.debt > 0) { const dd0 = MD - S.day; if (dd0 === 0) pushKR("kim", "kim", kimFill(fpick(D.KIM_DM.today))); else if (dd0 <= 3) pushKR("kim", "kim", kimFill(fpick(D.KIM_DM.remind))); }
  if (S.debt >= 40000000 && S.kimBig !== S.month) { S.kimBig = S.month; pushKR("kim", "kim", kimFill(fpick(D.KIM_DM.big))); }
  const Y = Object.values(S.yday.reduce((o, x) => { const k = x.label || x.kind; (o[k] = o[k] || { label: k, kind: x.kind, amt: 0, n: 0 }).amt += x.amt; o[k].n++; return o; }, {})).map(x => Object.assign({}, x, { label: x.n > 1 ? `${x.label} ×${x.n}` : x.label }));
  const net = Y.reduce((a, x) => a + (["loan", "debt"].includes(x.kind) ? 0 : x.amt), 0);
  const mline = mental() === "men" ? T("mline.men") : mental() === "anx" ? T("mline.anx") : S.hp < R().HP_LOW ? T("mline.tired") : S.addict >= R().ADD_NAG ? T("mline.addict") : S.stress < 25 ? T("mline.happy") : T("mline.calm");
  pushK("m", mline);
  const tod = S.today.filter(x => ["div", "ev"].includes(x.kind));
  emit("morning", { month: S.month, day: S.day, dd: MD - S.day, paid: S.paidMonth === S.month || S.debt <= 0, due: interestDue(), cash: S.cash, hv: holdVal(), hp: S.hp, addict: S.addict, Y, net, netConv: net ? conv(net) : T("conv0"), ev: ev ? ev.t : "", tod, best: S.posts.filter(p => p.best).slice(-2).map(p => ({ au: p.au, title: p.title, up: p.up })), mline });
}

/* ---------- 칸 끝: 펀딩비 → 시세 적용 → 청산 → 정보 결과 → 알림 ---------- */
function marketTick() {
  const S = st(), evening = isEve(), n = S.news, Rr = R();
  const before = {};
  STK().forEach(k => { if (S.hold[k]) before["s" + k] = S.hold[k].q * S.mk[k].p; });
  S.cps.forEach(c => before["c" + c.id] = cEq(c));
  const eq0 = S.cash + holdVal();
  let fund = 0;
  for (const c of S.cps) if (c.lev > 1) {
    const f0 = Math.min(c.margin, c.margin * c.lev * Rr.FUNDING), f = S.rngv >= 2 ? roundHalfUp(f0) : f0;   /* v2: 원 단위 정수 · v1(v3.2 호환): 실수 그대로 */
    c.margin -= f; fund += f;
  }
  if (fund) { S.today.push({ kind: "invest", amt: -fund, label: T("lbl.funding") }); S.realized -= fund; }
  const P = curPlan(); S.mplan = null;
  const mv = applyMarket(P);
  const liqs = [];
  for (const c of S.cps.slice()) {
    const w = c.dir > 0 ? mv[c.tk].l : mv[c.tk].h;
    if (c.margin <= 0 || c.lev * c.mult * c.dir * (w / c.entry - 1) <= -0.9 || liqHit(c, mv[c.tk], D.TK[c.tk].vol * (evening && has("whale") ? 2 : 1))) {
      // 꼬리로 청산가 찍은 걸 차트에 남김 (청산빔)
      const hc = S.mk[c.tk].hist[S.mk[c.tk].hist.length - 1], L = liqPx(c);
      if (c.dir > 0) hc.l = Math.min(hc.l, L * 0.998); else hc.h = Math.max(hc.h, L * 1.002);
      /* v3.3: 청산 = 증거금의 70~90% 손실 (랜덤) — 나머지는 돌려받음. 청산 보험은 최소 절반 보장 */
      const LL = Rr.LIQ_LOSS, loss = LL[0] + rnd() * (LL[1] - LL[0]);
      let back = Math.max(0, roundHalfUp(c.margin * (1 - loss)));
      if (has("insure") && !S.insUsed) { S.insUsed = true; back = Math.max(back, roundHalfUp(c.margin / 2)); }
      S.cash += back;
      S.cps = S.cps.filter(x => x !== c); S.st.liq++; S.st.iN++; S.realized += back - c.margin;
      S.today.push({ kind: "invest", amt: back - c.margin, label: T("lbl.liq", { n: D.TK[c.tk].name, lev: c.lev, b: T("lbl.liqBack", { p: roundHalfUp(loss * 100) }) }) });
      liqs.push({ c, back, lost: before["c" + c.id] - back });
    }
  }
  const ld = c => T(c.dir > 0 ? "long" : "short");
  const rows = [];
  STK().forEach(k => { if (S.hold[k]) rows.push({ l: `${D.TK[k].ic} ${D.TK[k].name}`, d: S.hold[k].q * S.mk[k].p - before["s" + k], r: mv[k].r }); });
  S.cps.forEach(c => rows.push({ l: `${D.TK[c.tk].ic} ${D.TK[c.tk].name} ${c.lev}x ${ld(c)}`, d: cEq(c) - before["c" + c.id], r: mv[c.tk].r * c.dir * c.lev * c.mult }));
  liqs.forEach(x => rows.push({ l: T("row.liq", { n: D.TK[x.c.tk].name, lev: x.c.lev, d: ld(x.c), b: T("row.liqBack", { m: man(x.back) }) }), d: -x.lost, liq: 1 }));
  const total = rows.reduce((a, x) => a + x.d, 0);
  const nextSlot = (S.slot + 1) % Rr.SLOTS, lastStock = Rr.STOCK_SLOTS[Rr.STOCK_SLOTS.length - 1];
  const title = evening ? T("tick.night") : T("tick.slot", { ic: D.SLOT_IC[S.slot], s: D.SLOT_NAME[S.slot], x: S.slot === lastStock ? T("tick.close") : "" });
  const rt = resolveTips(); onTipsResolved(rt, postById);
  if (rt.length) pushF("🔎", T("tick.tips", { n: rt.length }) + rt.map(t => `${srcOf(t).name} ${D.TK[t.tk].name} ${resMark(t.res)} (${pct(t.rr)})`).join(" · "), "tip");
  if (n && !n.fake) { const nm = D.TK[n.tk] ? D.TK[n.tk].name + " " + pct(mv[n.tk].r) : T("tick.all"); pushF("📰", `${n.h} → ${nm}`, "news"); toast(`📰 ${n.h} → ${nm}`, "news", "news"); if (rnd() < 0.6) galReact("news", { h: n.h }, 1); }
  const shown = TKS().filter(tkOpen);
  const c0 = total ? conv(total) : T("conv0");
  if (rows.length) {
    pushF("🔔", T("tick.feed", { t: title, a: sgnWon(total), c: c0 }), "slot", rows.map(x => `${x.l} ${x.liq ? "" : pct(x.r)} ${sgnWon(x.d)}`).concat([shown.map(k => `${D.TK[k].ic}${pct(mv[k].r)}`).join(" ")]));
    if (!liqs.length) toast(T("tick.toast", { t: title, a: sgnWon(total), c: c0, i: rt.length ? T("tick.toastTips", { m: rt.map(t => resMark(t.res).split(" ")[0]).join("") }) : "" }), total >= 0 ? "good" : "", "stock");
  } else if (rt.length) { toast(T("tick.tipsToast", { l: rt.map(t => `${srcOf(t).name} ${resMark(t.res)}`).join(" · ") }), "news", "news");
  } else emit("tickFloat", { text: T("tick.float", { ic: D.SLOT_IC[nextSlot], s: D.SLOT_NAME[nextSlot] }) });
  gallMarketPosts(mv);
  S.eqh.push({ T: Tnow(), v: S.realized + unreal() }); if (S.eqh.length > 100) S.eqh.shift();
  S.st.maxAsset = Math.max(S.st.maxAsset, roundHalfUp(S.cash + holdVal()));
  emit("tick", {});
  if (liqs.length) {
    scene("room", { night: evening, face: "panic", mode: "home" });
    const L = liqs[0].c;
    react(-liqs.reduce((a, x) => a + x.lost, 0), { liq: 1, lev: L.lev });
  } else if (rows.length && Math.abs(total) >= Math.max(800000, eq0 * 0.25)) {
    scene("room", { night: evening, face: "neutral", mode: "home" });
    if (total > 0) { fx("flex", { amt: total }); galReact("bigwin", { amt: sgnMan(total), conv: conv(total) }, 2); stress(-10); M(T("tick.bigUp", { s: D.SLOT_NAME[S.slot], a: sgnWon(total), c: conv(total) }), "flex"); }
    else { fx("crack", { amt: total }); galReact("bigloss", { amt: sgnMan(total), conv: conv(total) }, 2); stress(16); M(T("tick.bigDn", { a: sgnWon(total), c: conv(total) }), "cry"); }
    hideDlg();
  }
  S.news = genNews();
}

/* ---------- 이자일 (7일째 저녁) ---------- */
function paydayOpts() {
  const S = st(), P = S.pending, due = P.due;
  const hv = holdVal(), short = Math.max(0, due - S.cash), canLoan = short > 0 && S.debt + short <= loanCap();
  return [
    { k: "pay", l: T("pd.pay", { d: won(due) }), sub: T("pd.cash", { c: won(S.cash) }), dis: S.cash < due },
    { k: "sell", l: T("pd.sell"), sub: hv > 0 ? T("pd.sellSub", { v: won(hv) }) : T("pd.sellNone"), dis: hv <= 0 || S.cash >= due },
    { k: "loan", l: short > 0 ? T("pd.loan", { s: won(short) }) : T("pd.loanNo"), sub: short > 0 ? (canLoan ? T("pd.loanSub", { a: won(S.debt), b: won(S.debt + short) }) : T("pd.loanCap", { m: S.month, c: man(loanCap()) })) : T("pd.loanEnough"), dis: !canLoan },
    { k: "bet", l: T("pd.bet"), sub: P.betUsed ? T("pd.betUsed") : T("pd.betSub"), dis: P.betUsed },
  ];
}
/* 배드 엔딩 종류: 도박 중독도 60↑ 이면 배드2, 아니면 배드1 */
const badKind = () => st().addict >= R().ADD_SECRET ? "bad2" : "bad1";
function paydayChoose() {
  const S = st(), P = S.pending;
  P.stage = "choose"; P.opts = paydayOpts();
  if (P.opts.every(o => o.dis)) {
    KIM(T("pd.stuck1")); KIM(T("pd.stuck2"));
    S.pending = null; ending(badKind());
  }
}
function paydayStart() {
  const S = st();
  S.phase = "payday";
  scene("room", { night: true, face: "panic", mode: "home" }); kim(true);
  if (S.paidMonth === S.month) { KIM(T("pd.early")); paydayPaid(true); return; }
  const due = interestDue();
  KIM(T("pd.hello", { m: S.month, d: won(due) }));
  S.pending = { t: "payday", stage: "choose", due, betUsed: false, opts: [] };
  paydayChoose();
}
export function paydayCmd(cmd) {
  const S = st(), P = S.pending;
  if (P.stage === "choose") {
    const o = P.opts.find(x => x.k === cmd.k); if (!o || o.dis) return false;
    const due = P.due;
    if (o.k === "pay") { money(-due, "interest", T("lbl.interest")); S.st.interest += due; pushF("🧾", T("pd.feed", { m: S.month, d: won(due) }), "money"); KIM(T("pd.paid")); return paydayPaid(); }
    if (o.k === "sell") { const t = closeAll(); N(T("pd.sold", { t: sgnWon(t), c: won(S.cash) })); paydayChoose(); return true; }
    if (o.k === "loan") { const short = Math.max(0, due - S.cash), have = S.cash; if (have) money(-have, "interest", T("lbl.interestAll")); addDebt(short, T("lbl.interestLoan")); S.st.interest += due; KIM(T("pd.loaned", { s: won(short) })); return paydayPaid(); }
    if (o.k === "bet") { P.betUsed = true; KIM(T("pd.betAsk")); P.stage = "side"; P.opts = [{ k: "odd", l: T("cas.odd") }, { k: "even", l: T("cas.even") }]; return true; }
  }
  if (P.stage === "side") {
    const o = P.opts.find(x => x.k === cmd.k); if (!o) return false;
    face("panic"); N(T("pd.reveal"));
    const kimWin = rnd() >= 0.5;
    addict(R().ADD_GAIN.kim + (kimWin ? R().ADD_GAIN.bigloss : 0)); S.st.gN++; if (!kimWin) S.st.gW++;
    if (!kimWin) { KIM(T("pd.betWin", { s: o.l })); stress(-20); fx("big", { text: T("pd.freeFx"), kind: "up", small: T("pd.freeFxSub") }); return paydayPaid(); }
    P.due *= 2; KIM(T("pd.betLose", { d: won(P.due) })); fx("crack", { amt: -P.due / 2 }); stress(10);
    paydayChoose(); return true;
  }
  if (P.stage === "repay") {
    const o = P.opts.find(x => x.k === cmd.k); if (!o || o.dis) return false;
    if (o.k === "repayAll") repay(Math.min(S.cash, S.debt));
    else if (o.k === "repayHalf") repay(Math.min(P.half, S.debt));
    else bubble(T("pd.keepBubble"), 2000, "smug");
    S.pending = null; paydayEnd(); return true;
  }
  return false;
}
function paydayPaid(early) {
  const S = st();
  if (!early) S.paidMonth = S.month;
  galReact("payday", { debt: man(S.debt) + D.STR.U.won }, 2);
  pushK("m", T("pd.k"));
  if (S.cash >= 10000 && S.debt > 0) {
    const half = Math.floor(S.cash / 20000) * 10000;
    S.pending = { t: "payday", stage: "repay", half, opts: [
      { k: "repayAll", l: T("pd.rAll", { c: won(S.cash) }), sub: T("pd.rAllSub", { a: won(S.debt), b: won(Math.max(0, S.debt - S.cash)) }) },
      { k: "repayHalf", l: T("pd.rHalf", { h: won(half) }), sub: T("pd.rHalfSub"), dis: half < 10000 },
      { k: "keep", l: T("pd.rKeep"), sub: T("pd.rKeepSub") }] };
    return true;
  }
  S.pending = null; paydayEnd(); return true;
}
function paydayEnd() {
  const S = st();
  if (S.debt <= 0 && !S.cleared) { ending("clear"); return; }
  kim(false); face("tired");
  N(T("pd.monthEnd", { m: S.month, d: won(S.debt), i: won(interestDue()) }));
  hideDlg();
  after("paydayMsg");
}

/* ---------- 유품 고르기 (시작: 부모님 유품 상자 3개 중 1개) ---------- */
function relicOfferStart() {
  const S = st(), r = rnd(), first = !S.augs.length;
  const tier = r < (first ? 0.1 : 0.2) ? 3 : r < (first ? 0.45 : 0.6) ? 2 : 1;
  const pool = D.AUGS.filter(a => a.tier === tier && !has(a.id)), rest = D.AUGS.filter(a => a.tier !== tier && !has(a.id));
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  while (out.length < 3 && rest.length) out.push(rest.splice(Math.floor(rnd() * rest.length), 1)[0]);
  return out.map(a => a.id);
}
export function relicStart(reason) { const S = st(); S.pending = { t: "relic", reason, offer: relicOfferStart(), rerolled: false }; }
export function relicReroll() { const P = st().pending; if (P.rerolled) return false; P.rerolled = true; P.offer = relicOfferStart(); return true; }
export function relicPick(i) {
  const S = st(), P = S.pending, id = P.offer[i];
  if (!id) return false;
  S.pending = null;
  if (S.phase === "opening") S.phase = "home";
  S.augs.push(id);
  const a = D.AUGS.find(x => x.id === id);
  augFx(id, T("aug.got"));
  galReact("aug", { aug: a.name }, 2);
  pushK("m", T("aug.k", { n: a.name }));
  emit("relic", { id, how: "pick" });
  if (a.tier === 3) fx("big", { text: `${a.ic} ${a.name}`, kind: "up", small: T("aug.prism") });
  M(id === "meme" ? T("aug.mMeme") : id === "grind" ? T("aug.mGrind") : id === "loanbro" ? T("aug.mLoanbro") : T("aug.mAny", { n: a.name, f: a.fl }), a.tier === 3 ? "flex" : "smug");
  hideDlg();
  return true;
}

/* ---------- 멘헤라: 카톡 탄막 ---------- */
function menheraStart() {
  const S = st();
  S.menKey = String(Tnow()); S.menCool = Tnow() + 3;
  const si = Math.floor(rnd() * D.MEN_SETS.length), set = D.MEN_SETS[si];
  emit("menhera", { msgs: set.msgs });
  for (const m of set.msgs) pushK("m", m);
  galReact("menhera", {}, 2);
  N(T("men.n", { n: set.msgs.length }));
  M(set.last, "menhera");
  const opts = [{ l: set.ok, ok: true }, { l: set.no[0] }, { l: set.no[1] }];
  for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  opts.forEach((o, i) => o.k = "rep" + i);
  S.pending = { t: "menhera", si, opts };
}
export function menheraReply(i) {
  const S = st(), P = S.pending, c = P.opts[i], set = D.MEN_SETS[P.si];
  if (!c) return false;
  S.pending = null;
  pushK("me", c.l);
  if (c.ok) { S.st.menOk++; stress(-45); M(set.good, "happy"); }
  else { S.st.menBad++; stress(-20); M(set.bad, "angry"); }
  hideDlg();
  return true;
}
/* ---------- 멘탈 관리 실패 돌발행동: 미래가 랜덤 종목 무지성 풀매수 (따상/따락 랜덤) ---------- */
function impulseStart() {
  const S = st();
  S.menKey = String(Tnow()); S.menCool = Tnow() + 3;
  const cands = TKS().filter(k => tkOpen(k) && !D.TK[k].inv && (D.TK[k].type === "coin" || stockOpen()));
  const tk = cands[Math.floor(rnd() * cands.length)];
  const si = Math.floor(rnd() * D.IMPULSE.length), set = D.IMPULSE[si];
  emit("impulse", { tk, amt: round1k(S.cash * R().IMPULSE_CASH) });
  scene("room", { night: isEve(), face: "menhera", mode: "home" });
  N(T("imp.n", { n: D.TK[tk].name, a: won(round1k(S.cash * R().IMPULSE_CASH)) }));
  const nv = { n: D.TK[tk].name };
  M(fill(set.line, nv), "menhera");
  const opts = [{ l: fill(set.ok, nv), ok: true }, { l: fill(set.no[0], nv) }, { l: fill(set.no[1], nv) }];
  for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  opts.forEach((o, i) => o.k = "imp" + i);
  S.pending = { t: "impulse", si, tk, opts };
}
export function impulseReply(i) {
  const S = st(), P = S.pending, c = P.opts[i], set = D.IMPULSE[P.si], tk = P.tk;
  if (!c) return false;
  S.pending = null;
  pushK("me", c.l);
  if (c.ok) { S.st.menOk++; stress(-35); M(fill(set.good, { n: D.TK[tk].name }), "happy"); hideDlg(); return true; }
  S.st.menBad++; S.st.impulse++;
  const amt = round1k(S.cash * R().IMPULSE_CASH), stock = D.TK[tk].type === "stock";
  const up = rnd() < 0.5, mag = stock ? 0.12 + rnd() * 0.18 : 0.2 + rnd() * 0.25;
  let ok = false;
  if (amt >= 10000) {
    if (stock) ok = !!buyStock(tk, amt, R().FEE_APP);
    else ok = !!openCoin(tk, 1, 1, Math.floor(amt / (1 + R().COIN_FEE) / 1000) * 1000);
  }
  if (ok) addShock(Tnow(), tk, (up ? 1 : -1) * mag);   /* 이번 칸 끝에 따상/따락 */
  stress(-15);
  fx("big", { text: T("imp.fx", { n: D.TK[tk].name }), kind: up ? "up" : "dn", small: T("imp.fxSub", { a: won(amt) }) });
  M(fill(set.bad, { n: D.TK[tk].name }), "flex");
  pushF("🛒", T("imp.feed", { n: D.TK[tk].name, a: won(amt) }), "money");
  hideDlg();
  return true;
}

/* ---------- 끝 ---------- */
const broke = () => { const S = st(); return S.cash + holdVal() < 10000 && loanCap() - S.debt < R().LOAN_AMTS[0]; };
function checkEnd() {
  const S = st();
  if (S.debt <= 0 && !S.cleared) { ending("clear"); return; }
  if (S.debt > R().DEBT_CAP) { emit("hideUi"); N(T("end.cap", { d: won(S.debt) })); ending(badKind()); return; }
}
/* 중독도 100 + 빈털터리(현금·평가·대출 한도 다 바닥)로 아침을 맞으면 배드2 */
function addictEnd() { const S = st(); if (S.addict >= 100 && broke()) { emit("hideUi"); N(T("end.addictMax")); ending("bad2"); return true; } return false; }
/* 스코어보드 (모든 엔딩 공통) */
export function scoreboard(kind) {
  const S = st();
  return { kind, profit: roundHalfUp(S.realized + unreal()), gnet: S.st.gnet, earned: S.st.earned, maxAsset: S.st.maxAsset, repaid: S.st.repaid, debt: S.debt,
    days: absDay(), month: S.month, day: S.day, gW: S.st.gW, gN: S.st.gN, iW: S.st.iW, iN: S.st.iN, liq: S.st.liq, fame: S.galFame, rank: rankOf(S.galFame)[1],
    addict: S.addict, interest: S.st.interest, faint: S.st.faint, impulse: S.st.impulse };
}
export function ending(kind) {
  const S = st();
  const E = D.ENDINGS[kind];
  if (kind === "clear") S.resume = S.flow.slice();
  S.phase = "ending"; S.ending = kind; S.flow = []; S.pending = { t: "ending", kind, cont: kind === "clear" };
  S.endSeen[kind] = (S.endSeen[kind] || 0) + 1;
  const decor = Object.keys(S.props).concat(Object.keys(S.owned).filter(k => k !== "hoodie"));
  const v = { debt: won(S.debt), interest: won(S.st.interest), m: S.month, minDebt: won(S.st.minDebt), g: sgnWon(S.st.gnet) };
  let lead, variant = "";
  if (kind === "clear") {
    variant = S.st.gnet > 0 && S.st.gnet >= S.st.earned ? "gamble" : "";
    lead = T(variant ? "end.clearGamble" : S.stress < 60 ? "end.clearHappy" : "end.clearMeh", v) + "\n\n" + (decor.length ? decor.map(k => D.DECOR_END[k]).filter(Boolean).join("\n") : T("end.noDecor"));
  } else if (kind === "bad1") {
    variant = S.galFame >= D.FAME.gall ? "gall" : "sea";
    lead = (S.debt > R().DEBT_CAP ? T("end.capPre") : "") + T(variant === "gall" ? "end.bad1Gall" : "end.bad1", v);
  } else {
    variant = S.st.work >= 20 ? "loop" : "casino";
    lead = (S.st.minDebt <= R().DEBT0 * 0.7 && S.debt > S.st.minDebt ? T("end.bad2Flash", v) : "") + T(variant === "loop" ? "end.bad2Loop" : "end.bad2", v);
  }
  if (S.galFame >= D.FAME.legend) lead += T("end.legend", { n: (3000 + S.galFame * 37).toLocaleString("ko-KR") });
  else if (variant === "gall") lead += T("end.gallFame", { f: S.galFame });
  const sb = scoreboard(kind);
  S.endInfo = { kind, variant, tag: E.tag, ok: !!E.ok, h: variant && E.hv && E.hv[variant] ? E.hv[variant] : E.h, bg: variant && E.bgv && E.bgv[variant] ? E.bgv[variant] : E.bg,
    face: kind === "clear" ? (S.stress < 60 ? "happy" : "tired") : E.face, lead, days: absDay(), rank: rankOf(S.galFame)[1], noChar: !!(E.noCharV && E.noCharV[variant]), night: kind === "clear", sb, cont: kind === "clear" };
  pushK("sys", T("end.k", { h: S.endInfo.h }));
  emit("ending", { kind, variant, sb });
}
/* 정식 엔딩 뒤 '계속하기': 빚 없는 자유 모드로 하던 흐름을 이어 감 */
export function continueGame() {
  const S = st();
  if (!S.pending || S.pending.t !== "ending" || !S.pending.cont) return false;
  S.cleared = 1; S.ending = null; S.pending = null; S.phase = "home";
  S.flow = S.resume && S.resume.length ? S.resume : ["loopTop"]; S.resume = null;
  emit("continued", {});
  return true;
}

/* ---------- 기절: 체력 0 → 오늘 남은 칸 + 다음 하루 통째로 날림 (시세·이자일은 그대로 흘러감) ---------- */
function faintCheck() {
  const S = st();
  if (S.hp > 0 || fainted()) return;
  S.faint = absDay() * R().SLOTS + R().SLOTS - 1;
  S.st.faint++;
  const cost = R().HP_FAINT_COST;
  S.cash -= cost; S.today.push({ kind: "ev", amt: -cost, label: T("lbl.hospital") }); emit("cash", { d: -cost });
  if (S.cash < 0) { const d = -S.cash; S.cash = 0; addDebt(d, T("lbl.cover")); }
  emit("faint", {});
  scene("room", { night: true, face: "panic", mode: "home" });
  N(T("faint.n", { c: won(cost) }));
  M(fpick(D.STR["faint.m"]), "cry");
  pushK("m", T("faint.k"));
  galReact("faint", {}, 2);
  hideDlg();
}

/* ---------- 단계 표 ---------- */
export const STEPS = {
  loopTop() {
    const S = st();
    if (S.needMorning) { if (addictEnd()) return; morning(); S.needMorning = false; }
    if (S.dbgAug) { S.dbgAug = 0; after("loopTop2"); relicStart(T("aug.reasonDebug")); return; }
    STEPS.loopTop2();
  },
  loopTop2() { const S = st(); S.phase = "home"; slotStart(); emit("save"); after("home"); },
  home() {
    const S = st(); S.phase = "home";
    if (fainted()) {
      /* 기절 중: 입력 없이 칸이 지나감 */
      emit("faintSlot", {});
      if (S.faint === Tnow()) S.hp = Math.max(S.hp, R().HP_FAINT_BACK);
      after(...AFTER_SLOT); return;
    }
    if (S.addict >= R().ADD_TEMPT && S.temptT !== Tnow() && rnd() < 0.3) { temptStart(); return; }
    homeLine(); S.pending = { t: "home" };
  },
  endCheck: checkEnd,
  faintCheck,
  menCheck() {
    const S = st();
    if (fainted()) return;
    if (mental() === "men" && S.menKey !== String(Tnow()) && !(S.menCool > Tnow())) {
      if (S.cash >= 50000 && rnd() < R().IMPULSE_P) impulseStart(); else menheraStart();
    }
  },
  endSlot() {
    const S = st();
    /* 도박 안 한 칸마다 중독도 조금씩 감소 (밤에 하루 단위로 한 번 더) */
    if (S.gT !== Tnow() && S.addict > 0 && S.addict < R().ADD_STICKY) S.addict = Math.max(0, S.addict - R().ADD_SLOT_DECAY);
    after("market", "advance");
    if (isEve()) { lottoDraw(); if (S.day === R().MONTH_DAYS && S.debt > 0) paydayStart(); }
  },
  market: marketTick,
  advance() {
    const S = st();
    S.slot++;
    if (S.slot >= R().SLOTS) {
      const d0 = absDay();
      S.slot = 0; S.day++; S.yday = S.today; S.today = [];
      if (S.day > R().MONTH_DAYS) { S.day = 1; S.month++; }
      S.needMorning = true;
      /* 밤잠: 체력 회복 · 도박 안 한 날이면 중독도 감소 (60↑ 이면 금단 = 멘탈 하락) */
      S.hp = clamp(S.hp + R().HP_SLEEP, 0, R().HP_MAX);
      if (S.gday !== d0) {
        if (S.addict >= R().ADD_SECRET) { S.stress = clamp(S.stress + R().ADD_WITHDRAW, 0, 100); pushK("m", fpick(D.STR["add.withdraw"])); }
        S.addict = Math.max(0, S.addict - R().ADD_DECAY);
      }
    }
  },
  paydayMsg() { const S = st(); M(T("pd.next", { m: S.month + 1 }), "smug"); hideDlg(); },
  tutInit() { const S = st(); if (S.optTut) S.tg = "home"; },
};
