/* sim/flow.js — 하루 흐름 단계(step). S.flow = 남은 단계 이름 큐, S.pending = 플레이어 입력 대기.
   run(): pending 이 없으면 flow 앞에서 하나씩 꺼내 실행. 단계가 pending 을 세우면 멈춘다.
   v3.2 runLoop 와 같은 순서: [아침] → 칸 시작 → 집(입력) → 끝 판정 → 멘헤라 → 칸 끝(빚또·이자일·시세) → 끝 판정 → 멘헤라 → … */
import { D, R, st, emit } from "./core.js";
import { rnd, pick, fpick } from "./rng.js";
import { clamp, roundHalfUp } from "./num.js";
import { T, won, man, sgnWon, sgnMan, pct, conv } from "./fmt.js";
import { TKS, STK, has, mental, absDay, Tnow, interestDue, loanCap, tkOpen, stockVal, cEq, holdVal, liqPx, unreal, rankOf } from "./state.js";
import { curPlan, applyMarket, liqHit, genNews } from "./market.js";
import { rollTip, tipAnnounce, resolveTips, onTipsResolved, srcOf, resMark } from "./tips.js";
import { aff, stress, money, addDebt, fame, augFx, pushK, pushKR, pushF, toast, beginTurn, endTurn } from "./effects.js";
import { galReact, gallMarketPosts, gallTick, kqExpire, kqMaybe, hyMaybe, postById } from "./gall.js";
import { closeAll } from "./trade.js";
import { lottoDraw } from "./games.js";
import { repay } from "./places.js";
import { M, N, KIM, hideDlg, bubble, face, fx, scene, kim, react } from "./talk.js";
import { SUB } from "./ids.js";

export const after = (...steps) => { const S = st(); S.flow.unshift(...steps); };
/* 칸을 쓴 행동 뒤 */
export const AFTER_SLOT = ["endCheck", "menCheck", "endSlot", "endCheck", "menCheck", "loopTop"];
export function slotUsed() { const S = st(); S.pending = null; after(...AFTER_SLOT); }
export function toHome() { const S = st(); S.pending = null; after("home"); }

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
  const L = mt === "men" ? D.STR["home.men"] : mt === "anx" ? D.STR["home.anx"] : D.STR["home.slot"][S.slot];
  S.hl = { T: Tnow(), t: (S.day === R().MONTH_DAYS && S.slot === 3 && S.paidMonth !== S.month) ? T("home.payday", { d: man(interestDue()) }) : pick(L) };
  return S.hl.t;
}

/* ---------- 칸 시작: 시세 계획 → 찌라시·고래·카톡·갤 ---------- */
function slotStart() {
  const S = st();
  if (S.startT === Tnow()) return; S.startT = Tnow();
  const P = curPlan();
  if (S.slot === 3 && has("whale")) { const tk = rnd() < 0.5 ? "BTK" : "TOK", d = P.r[tk] >= 0 ? 1 : -1; S.whale = { tk, dir: rnd() < 0.7 ? d : -d, T: Tnow() }; pushF("🐋", T("whale.feed", { n: D.TK[tk].name, d: T(S.whale.dir > 0 ? "whale.up" : "whale.dn") }), "intel"); }
  if (has("rumor")) { const t = rollTip(SUB); tipAnnounce(t, "sub"); }
  kqExpire(); kqMaybe(); hyMaybe(); gallTick();
}

/* ---------- 아침 ---------- */
const kimFill = x => { const S = st(); return x.replace("{dd}", R().MONTH_DAYS - S.day).replace("{due}", won(interestDue())).replace("{debt}", won(S.debt)); };
function morning() {
  const S = st(), MD = R().MONTH_DAYS;
  S.phase = "morning";
  if (has("divi")) { const v = stockVal(); if (v >= 10000) { const d = roundHalfUp(v * 0.01); S.cash += d; pushF("💌", T("divi.feed", { d: won(d) }), "money"); S.today.push({ kind: "div", amt: d, label: T("lbl.divi") }); augFx("divi", T("aug.divi", { d: man(d) })); } }
  let ev = null;
  if (rnd() < 0.4) {
    ev = pick(D.MORNING_EV);
    if (ev.cash) { S.cash += ev.cash; S.today.push({ kind: "ev", amt: ev.cash, label: T("lbl.morningEv") }); }
    if (ev.st) S.stress = clamp(S.stress + ev.st, 0, 100);
    if (ev.fame) fame(ev.fame);
    if (ev.aff) S.aff = clamp(S.aff + ev.aff, 0, 100);
  }
  if (S.aff > 70) { S.aff -= S.aff > 85 ? 6 : 3; ev = ev || { t: T("morning.high") }; }
  else if (S.aff < 35) { S.aff += 3; ev = ev || { t: T("morning.low") }; }
  S.stress = clamp(S.stress - 6, 0, 100);
  if (S.galFame >= D.FAME.gift && rnd() < 0.4) { const g = Math.min(200000, roundHalfUp((10000 + S.galFame * 1500) / 1000) * 1000); S.cash += g; S.today.push({ kind: "ev", amt: g, label: T("lbl.gift") }); S.stress = clamp(S.stress - 4, 0, 100); pushKR("hy", "hy", T("gift.hy", { g: won(g) })); pushF("🎁", T("gift.feed", { g: won(g), f: S.galFame }), "fame"); }
  if (S.paidMonth !== S.month) { const dd0 = MD - S.day; if (dd0 === 0) pushKR("kim", "kim", kimFill(fpick(D.KIM_DM.today))); else if (dd0 <= 3) pushKR("kim", "kim", kimFill(fpick(D.KIM_DM.remind))); }
  if (S.debt >= 40000000 && S.kimBig !== S.month) { S.kimBig = S.month; pushKR("kim", "kim", kimFill(fpick(D.KIM_DM.big))); }
  const Y = Object.values(S.yday.reduce((o, x) => { const k = x.label || x.kind; (o[k] = o[k] || { label: k, kind: x.kind, amt: 0, n: 0 }).amt += x.amt; o[k].n++; return o; }, {})).map(x => Object.assign({}, x, { label: x.n > 1 ? `${x.label} ×${x.n}` : x.label }));
  const net = Y.reduce((a, x) => a + (["loan", "debt"].includes(x.kind) ? 0 : x.amt), 0);
  const mline = mental() === "men" ? T("mline.men") : mental() === "anx" ? T("mline.anx") : S.aff >= 70 ? T("mline.happy") : T("mline.calm");
  pushK("m", mline);
  const tod = S.today.filter(x => ["div", "ev"].includes(x.kind));
  emit("morning", { month: S.month, day: S.day, dd: MD - S.day, paid: S.paidMonth === S.month, due: interestDue(), cash: S.cash, hv: holdVal(), Y, net, netConv: net ? conv(net) : T("conv0"), ev: ev ? ev.t : "", tod, best: S.posts.filter(p => p.best).slice(-2).map(p => ({ au: p.au, title: p.title, up: p.up })), mline });
}

/* ---------- 칸 끝: 펀딩비 → 시세 적용 → 청산 → 정보 결과 → 알림 ---------- */
function marketTick() {
  const S = st(), evening = S.slot === 3, n = S.news, Rr = R();
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
      let back = 0;
      if (has("insure") && !S.insUsed) { S.insUsed = true; back = roundHalfUp(c.margin / 2); S.cash += back; }
      S.cps = S.cps.filter(x => x !== c); S.st.liq++; S.realized += back - c.margin;
      S.today.push({ kind: "invest", amt: back - c.margin, label: T("lbl.liq", { n: D.TK[c.tk].name, lev: c.lev, b: back ? T("lbl.liqIns") : "" }) });
      liqs.push({ c, back, lost: before["c" + c.id] - back });
    }
  }
  const ld = c => T(c.dir > 0 ? "long" : "short");
  const rows = [];
  STK().forEach(k => { if (S.hold[k]) rows.push({ l: `${D.TK[k].ic} ${D.TK[k].name}`, d: S.hold[k].q * S.mk[k].p - before["s" + k], r: mv[k].r }); });
  S.cps.forEach(c => rows.push({ l: `${D.TK[c.tk].ic} ${D.TK[c.tk].name} ${c.lev}x ${ld(c)}`, d: cEq(c) - before["c" + c.id], r: mv[c.tk].r * c.dir * c.lev * c.mult }));
  liqs.forEach(x => rows.push({ l: T("row.liq", { n: D.TK[x.c.tk].name, lev: x.c.lev, d: ld(x.c), b: x.back ? T("row.liqIns", { m: man(x.back) }) : "" }), d: -x.lost, liq: 1 }));
  const total = rows.reduce((a, x) => a + x.d, 0);
  const nextSlot = (S.slot + 1) % Rr.SLOTS;
  const title = evening ? T("tick.night") : T("tick.slot", { ic: D.SLOT_IC[S.slot], s: D.SLOT_NAME[S.slot], x: S.slot === 2 ? T("tick.close") : S.slot === 0 ? T("tick.open") : "" });
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
  emit("tick", {});
  if (liqs.length) {
    scene("room", { night: S.slot === 3, face: "panic", mode: "home" });
    const L = liqs[0].c;
    react(-liqs.reduce((a, x) => a + x.lost, 0), { liq: 1, lev: L.lev });
  } else if (rows.length && Math.abs(total) >= Math.max(800000, eq0 * 0.25)) {
    scene("room", { night: S.slot === 3, face: "neutral", mode: "home" });
    if (total > 0) { fx("flex", { amt: total }); galReact("bigwin", { amt: sgnMan(total), conv: conv(total) }, 2); aff(6, T("why.paperWin")); stress(-10); M(T("tick.bigUp", { s: D.SLOT_NAME[S.slot], a: sgnWon(total), c: conv(total) }), "flex"); }
    else { fx("crack", { amt: total }); galReact("bigloss", { amt: sgnMan(total), conv: conv(total) }, 2); aff(-4); stress(16); M(T("tick.bigDn", { a: sgnWon(total), c: conv(total) }), "cry"); }
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
function paydayChoose() {
  const S = st(), P = S.pending;
  P.stage = "choose"; P.opts = paydayOpts();
  if (P.opts.every(o => o.dis)) {
    KIM(T("pd.stuck1")); KIM(T("pd.stuck2"));
    S.pending = null; ending(S.galFame >= D.FAME.gall ? "gall" : "sea");
  }
}
function paydayStart() {
  const S = st();
  S.phase = "payday"; beginTurn();
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
    if (rnd() < 0.5) { KIM(T("pd.betWin", { s: o.l })); aff(8, T("why.kimLose")); fx("big", { text: T("pd.freeFx"), kind: "up", small: T("pd.freeFxSub") }); return paydayPaid(); }
    P.due *= 2; KIM(T("pd.betLose", { d: won(P.due) })); fx("crack", { amt: -P.due / 2 }); aff(-6);
    paydayChoose(); return true;
  }
  if (P.stage === "repay") {
    const o = P.opts.find(x => x.k === cmd.k); if (!o || o.dis) return false;
    if (o.k === "repayAll") repay(Math.min(S.cash, S.debt));
    else if (o.k === "repayHalf") repay(Math.min(P.half, S.debt));
    else { aff(4); bubble(T("pd.keepBubble"), 2000, "smug"); }
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
  endTurn();
  if (S.debt <= 0) { ending("clear"); return; }
  kim(false); face("tired");
  N(T("pd.monthEnd", { m: S.month, d: won(S.debt), i: won(interestDue()) }));
  if (S.month >= R().MAX_MONTH) {
    if (S.debt > 40000000) { kim(true); KIM(T("pd.final", { d: man(S.debt) })); S.final = 1; ending(S.galFame >= D.FAME.gall ? "gall" : "sea"); return; }
    ending("loop"); return;
  }
  hideDlg();
  after("paydayMsg");
  augStart(T("aug.reasonPay", { m: S.month }));
}

/* ---------- 증강 고르기 ---------- */
function augOffer() {
  const S = st(), r = rnd(), first = !S.augs.length;
  const tier = r < (first ? 0.1 : 0.2) ? 3 : r < (first ? 0.45 : 0.6) ? 2 : 1;
  const pool = D.AUGS.filter(a => a.tier === tier && !has(a.id)), rest = D.AUGS.filter(a => a.tier !== tier && !has(a.id));
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  while (out.length < 3 && rest.length) out.push(rest.splice(Math.floor(rnd() * rest.length), 1)[0]);
  return out.map(a => a.id);
}
export function augStart(reason) { const S = st(); S.pending = { t: "aug", reason, offer: augOffer(), rerolled: false }; }
export function augReroll() { const P = st().pending; if (P.rerolled) return false; P.rerolled = true; P.offer = augOffer(); return true; }
export function augPick(i) {
  const S = st(), P = S.pending, id = P.offer[i];
  if (!id) return false;
  S.pending = null;
  if (S.phase === "opening") S.phase = "home";
  S.augs.push(id);
  const a = D.AUGS.find(x => x.id === id);
  augFx(id, T("aug.got"));
  galReact("aug", { aug: a.name }, 2);
  pushK("m", T("aug.k", { n: a.name }));
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
  if (c.ok) { S.st.menOk++; aff(18, T("why.menOk")); stress(-45); M(set.good, "happy"); }
  else { S.st.menBad++; aff(-11, T("why.menBad")); stress(-20); M(set.bad, "angry"); }
  hideDlg();
  endTurn();
  if (S.aff <= 0) ending("block");
  return true;
}

/* ---------- 끝 ---------- */
function checkEnd() {
  const S = st();
  if (S.debt <= 0) { ending("clear"); return; }
  if (S.aff <= 0) { ending("block"); return; }
  if (S.debt > R().DEBT_CAP) { emit("hideUi"); N(T("end.cap", { d: won(S.debt) })); ending(S.galFame >= D.FAME.gall ? "gall" : "sea"); }
}
export function ending(kind) {
  const S = st();
  S.phase = "ending"; S.ending = kind; S.flow = []; S.pending = { t: "ending", kind };
  const E = D.ENDINGS[kind];
  const decor = Object.keys(S.props).concat(Object.keys(S.owned).filter(k => k !== "hoodie"));
  const perMonth = S.st.repaid / Math.max(1, S.month);
  const years = perMonth > 0 ? Math.ceil(S.debt / perMonth / 12) : "∞";
  const v = { debt: won(S.debt), interest: won(S.st.interest), m: S.month, years };
  let lead;
  if (kind === "clear") lead = T(S.aff >= 60 ? "end.clearHappy" : "end.clearMeh") + "\n\n" + (decor.length ? decor.map(k => D.DECOR_END[k]).filter(Boolean).join("\n") : T("end.noDecor"));
  else lead = (kind === "sea" ? (S.final ? T("end.seaFinal", v) : S.debt >= R().DEBT_CAP - 1000000 ? T("end.seaCap") : "") : "") + T(E.lead, v);
  if (S.galFame >= D.FAME.legend) lead += T("end.legend", { n: (3000 + S.galFame * 37).toLocaleString("ko-KR") });
  else if (kind === "gall" && S.galFame >= D.FAME.gall) lead += T("end.gallFame", { f: S.galFame });
  S.endInfo = { kind, tag: E.tag, ok: !!E.ok, h: E.h, bg: E.bg, face: kind === "clear" ? (S.aff >= 60 ? "happy" : "tired") : E.face, lead, days: absDay(), rank: rankOf(S.galFame)[1], noChar: !!E.noChar, night: kind === "clear" };
  pushK("sys", T("end.k", { h: E.h }));
  emit("ending", { kind });
}

/* ---------- 단계 표 ---------- */
export const STEPS = {
  loopTop() {
    const S = st();
    if (S.needMorning) { morning(); S.needMorning = false; }
    if (S.dbgAug) { S.dbgAug = 0; after("loopTop2"); augStart(T("aug.reasonDebug")); return; }
    STEPS.loopTop2();
  },
  loopTop2() { const S = st(); S.phase = "home"; beginTurn(); slotStart(); emit("save"); after("home"); },
  home() { const S = st(); S.phase = "home"; homeLine(); S.pending = { t: "home" }; },
  endCheck: checkEnd,
  menCheck() {
    const S = st();
    if (mental() === "men" && S.menKey !== String(Tnow()) && !(S.menCool > Tnow())) { beginTurn(); menheraStart(); }
  },
  endSlot() {
    const S = st();
    endTurn();
    after("market", "advance");
    if (S.slot === 3) { lottoDraw(); if (S.day === R().MONTH_DAYS) paydayStart(); }
  },
  market: marketTick,
  advance() {
    const S = st();
    S.slot++;
    if (S.slot >= R().SLOTS) {
      S.slot = 0; S.day++; S.yday = S.today; S.today = [];
      if (S.day > R().MONTH_DAYS) { S.day = 1; S.month++; }
      S.needMorning = true;
    }
  },
  paydayMsg() { const S = st(); M(T("pd.next", { m: S.month + 1 }), "smug"); hideDlg(); },
  tutInit() { const S = st(); if (S.optTut) S.tg = "home"; },
};
