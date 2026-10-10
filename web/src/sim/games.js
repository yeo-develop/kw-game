/* sim/games.js — 장소 행동 중 여러 단계짜리: 알바(미니게임) · 카지노 · 경마 · 즉석 복권 · 빚또.
   각 함수는 pending 을 갱신하거나 {done: r} 을 돌려준다 (r = 칸을 썼는지). 미니게임은 view 가 0~1 점수를 넘긴다. */
import { D, R, st, emit } from "./core.js";
import { rnd, sq, pick, fpick } from "./rng.js";
import { clamp, roundHalfUp, round1k } from "./num.js";
import { T, won, man, sgnMan, conv } from "./fmt.js";
import { has, absDay, interestDue, limitOf } from "./state.js";
import { aff, stress, money, coverNeg, augFx, pushK, pushF } from "./effects.js";
import { galReact } from "./gall.js";
import { M, N, hideDlg, bubble, scene, react, fx } from "./talk.js";

/* ---------- 알바 ---------- */
/* 알바 난이도: 개월차마다 +8%, 연속 알바 피로 +3%/일 (최대 4일) */
export const mgHard = () => { const S = st(); return 1 + (S.month - 1) * 0.08 + Math.min(4, Math.max(0, (S.workStreak || 0) - 1)) * 0.03; };
export function workStart(key, loc) {
  const S = st(), J = D.JOBS[key];
  S.lastJob = key;
  scene(J.bg, { face: "tired", mode: "loc" });
  M(pick(J.lines), "angry"); hideDlg();
  S.pending = { t: "work", key, loc, setup: null };
}
/* 미니게임 판 준비 (난수 소비). practice = 연습판 (돈 없음) */
export function workSetup(practice) {
  const S = st(), P = S.pending, H = mgHard();
  let su;
  if (P.key === "cafe") {
    const mk = () => { const c = [0, 0, 0, 0, 0]; const n = 3 + Math.floor(rnd() * 3); for (let i = 0; i < n; i++) c[Math.floor(rnd() * 5)]++; return c; };
    su = { H, orders: [mk(), mk(), mk()] };
  } else if (P.key === "store") su = { H, u: [rnd(), rnd(), rnd(), rnd(), rnd()] };
  else su = { H, w: rnd() };
  su.practice = !!practice;
  P.setup = su;
  return su;
}
export function workResult(score) {
  const S = st(), P = S.pending, J = D.JOBS[P.key], key = P.key;
  score = clamp(+score || 0, 0, 1);
  let pay = round1k(J.base + J.var * score);
  if (has("grind")) { pay = round1k(pay * 1.3); augFx("grind", T("aug.grind")); }
  S.st.work++; S.st.earned += pay; S.workStreak++;
  money(pay, "work", T("lbl.work", { n: J.name, p: roundHalfUp(score * 100) }));
  galReact("work", { amt: man(pay) + D.STR.U.won, int: man(interestDue()) + D.STR.U.won, pct: (pay / Math.max(1, interestDue()) * 100).toFixed(1), conv: conv(pay) }, 2);
  stress(5 + 2 * Math.min(S.workStreak - 1, 4));
  if (S.workStreak >= 5) bubble(T("work.slave", { n: S.workStreak }), 2500, "angry");
  if (score >= 0.7) { aff(S.workStreak >= 5 ? -2 : 1); M(T("work.good", { pay: won(pay), c: conv(pay), x50: man(pay * 50) }), "smug"); }
  else { aff(-3); M(T("work.bad", { pay: won(pay), c: conv(pay) }), "angry"); }
  pushK("m", T(key === "ware" ? "work.kWare" : "work.k"));
  hideDlg();
  return { done: true };
}

/* ---------- 카지노: 홀짝 · 카드 · 슬롯 · 사다리 (테이블 리밋, 한 테이블 3판) ---------- */
export const hlMult = (a, hi) => { const n = hi ? 13 - a : a - 1; return n <= 0 ? 0 : Math.min(11, Math.floor(0.95 * 12 / n * 100) / 100); };
export function ladderEnd(rungs, choice) { let lane = choice; rungs.forEach(r => { if (r === lane) lane = r + 1; else if (r >= 0 && r + 1 === lane) lane = r; }); return lane; }
export function casinoStart(kind, loc) {
  const S = st();
  emit("face", { f: "smug" }); bubble(fpick(D.ML.preG), 2200, "smug");
  const A = 1 + Math.floor(rnd() * 13), As = Math.floor(rnd() * 4);
  S.pending = { t: "casino", kind, loc, A, As, rounds: 0, total: 0, before: S.cash, jackpot: false, lim: limitOf(kind) };
}
export function casinoBet(stake, choice) {
  const S = st(), P = S.pending, kind = P.kind;
  stake = Math.floor(+stake || 0);
  if (stake < 10000 || stake > Math.min(S.cash, P.lim)) return { err: "stake" };
  S.cash -= stake; emit("stake", { stake });
  let mult = 0, extra = 0, txt = "", show = {};
  if (kind === "oddeven") {
    const win = rnd() < 0.49, odd = win ? choice === 1 : choice !== 1;
    let n = 1 + Math.floor(rnd() * 10) * 2; if (!odd) n += 1;
    mult = win ? 2 : 0; txt = T("cas.oddeven", { n, s: T(odd ? "cas.odd" : "cas.even") }); show = { n };
  }
  if (kind === "card") {
    const A = P.A, B = 1 + Math.floor(rnd() * 13), Bs = Math.floor(rnd() * 4), m = hlMult(A, choice === 1);
    if (B === A) { mult = 1; txt = T("cas.cardSame", { a: D.RK[A], b: D.RK[B] }); }
    else { const w = choice === 1 ? B > A : B < A; mult = w ? m : 0; txt = T(w ? "cas.cardHit" : "cas.cardMiss", { a: D.RK[A], b: D.RK[B] }); }
    show = { A, As: P.As, B, Bs };
    P.A = B; P.As = Bs;
  }
  if (kind === "slot") {
    const SY = D.SLOT_SYM, r = rnd(); let res;
    const three = s => [s, s, s];
    if (r < 0.01) { res = three(SY[3]); mult = 40; P.jackpot = true; }
    else if (r < 0.035) { res = three(SY[2]); mult = 8; }
    else if (r < 0.085) { res = three(pick([SY[0], SY[1]])); mult = 4; }
    else if (r < 0.105) { res = three(SY[4]); mult = 0; extra = stake; }
    else if (r < 0.305) { const a = pick(SY), b = pick(SY.filter(x => x !== a)); res = [a, a, b]; const k = Math.floor(rnd() * 3); [res[k], res[2]] = [res[2], res[k]]; mult = 0.5; }
    else { const pool = SY.slice(); res = [0, 1, 2].map(() => pool.splice(Math.floor(rnd() * pool.length), 1)[0]); mult = 0; }
    txt = res.join(" ") + (mult >= 40 ? T("cas.jackpot") : extra ? T("cas.crash") : ""); show = { res };
  }
  if (kind === "ladder") {
    const prize = Math.floor(rnd() * 3), rungs = [];
    for (let lv = 0; lv < 5; lv++) { const r = rnd(); rungs.push(r < 0.42 ? 0 : r < 0.84 ? 1 : -1); }
    const endLane = ladderEnd(rungs, choice);
    mult = endLane === prize ? 2.8 : 0; txt = T(mult ? "cas.ladHit" : "cas.ladMiss", { c: "ABC"[choice], e: endLane + 1 }); show = { prize, rungs, endLane };
  }
  if (mult > 1 && has("addict")) { mult = 1 + (mult - 1) * 1.1; augFx("addict", T("aug.addictWin")); }
  const payout = roundHalfUp(stake * mult) - extra, net = payout - stake;
  S.cash += payout; coverNeg(); P.total += net; P.rounds++;
  const gs = S.st.g || (S.st.g = {}); const gk = gs[kind] || (gs[kind] = [0, 0, 0]); gk[0] += stake; gk[1] += net; gk[2]++;
  emit("casino", { kind, stake, choice, mult, net, txt, show, total: P.total, rounds: P.rounds });
  if (P.rounds >= 3 || S.cash < 10000) return casinoEnd();
  return {};
}
export function casinoEnd() {
  const S = st(), P = S.pending;
  emit("panelEnd", { k: "casino" });
  if (!P.rounds) return { done: false };
  S.st.gamble++; S.workStreak = 0; aff(1);
  S.today.push({ kind: "gamble", amt: P.total, label: T("lbl.casino", { n: D.CAS_TITLE[P.kind].slice(2).trim(), r: P.rounds }) });
  react(P.total, { before: P.before, gamble: 1, jackpot: P.jackpot });
  return { done: true };
}

/* ---------- 경마 ---------- */
export function raceStart(loc) {
  const S = st(), names = D.HORSES.slice(), H = [];
  for (let i = 0; i < 5; i++) H.push({ name: names.splice(Math.floor(rnd() * names.length), 1)[0], w: 0.08 + sq(rnd()) * 3 });
  const sw = H.reduce((a, h) => a + h.w, 0);
  H.forEach(h => { h.p = h.w / sw; h.odds = clamp(roundHalfUp(0.85 / h.p * 10) / 10, 1.2, 50); });
  S.pending = { t: "race", loc, H, lim: limitOf("race"), race: absDay() };
}
export function raceBet(choice, stake) {
  const S = st(), P = S.pending, H = P.H;
  stake = Math.floor(+stake || 0);
  if (!(choice >= 0 && choice < 5) || stake < 10000 || stake > Math.min(S.cash, P.lim)) return { err: "stake" };
  const before = S.cash;
  S.cash -= stake; emit("stake", { stake });
  let r = rnd(), win = 0; for (let i = 0; i < 5; i++) { r -= H[i].p; if (r <= 0) { win = i; break; } win = i; }
  let mult = choice === win ? H[choice].odds : 0;
  if (mult > 1 && has("addict")) { mult = 1 + (mult - 1) * 1.1; augFx("addict", T("aug.addictWin")); }
  const payout = roundHalfUp(stake * mult), net = payout - stake;
  S.cash += payout;
  { const gs = S.st.g || (S.st.g = {}); const gk = gs.race || (gs.race = [0, 0, 0]); gk[0] += stake; gk[1] += net; gk[2]++; }
  emit("race", { choice, win, net, stake });
  S.st.gamble++; S.st.race++; S.workStreak = 0;
  S.today.push({ kind: "gamble", amt: net, label: T("lbl.race", { n: H[choice].name, o: H[choice].odds }) });
  galReact("race", { horse: H[choice].name }, 1);
  react(net, { before, gamble: 1 });
  return { done: true };
}

/* ---------- 즉석 복권 ---------- */
export function scratchStart(loc) { st().pending = { t: "scratch", loc, n: 0, spent: 0, got: 0, card: null }; }
export function scratchBuy() {
  const S = st(), P = S.pending, price = R().SCRATCH_PRICE;
  if (P.n >= R().SCRATCH_MAX || S.cash < price || (P.card && !P.card.done)) return { err: "buy" };
  S.cash -= price; P.spent += price; P.n++; S.st.lotto++;
  let r = rnd(), prize = null; for (const pz of D.SC_PRIZE) { if (r < pz[2]) { prize = pz; break; } r -= pz[2]; }
  const all = D.SCRATCH_SYM;
  let sym;
  if (prize) { const fill = all.filter(s => s !== prize[0]); sym = [prize[0], prize[0], prize[0], pick(fill), pick(fill), pick(fill)]; }
  else { const pool = all.flatMap(s => [s, s]); sym = []; for (let k = 0; k < 6; k++) sym.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]); }
  if (prize) { const f = sym.slice(3); const cnt = {}; f.forEach(s => cnt[s] = (cnt[s] || 0) + 1); if (Object.values(cnt).some(v => v >= 3)) sym[5] = all.find(s => s !== prize[0] && s !== sym[3]); }
  for (let k = 5; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [sym[k], sym[j]] = [sym[j], sym[k]]; }
  P.card = { sym, prize, done: false };
  return {};
}
/* 카드 6칸이 다 열림 → 당첨 정산 */
export function scratchReveal() {
  const S = st(), P = S.pending, c = P.card;
  if (!c || c.done) return { err: "card" };
  c.done = true;
  if (c.prize) { S.cash += c.prize[1]; P.got += c.prize[1]; if (c.prize[1] >= 500000) bubble(T("sc.big"), 2000, "flex"); }
  else bubble(fpick(D.STR["sc.miss"]), 1600, "tired");
  emit("scratch", { prize: c.prize, got: P.got });
  return {};
}
export function scratchDone() {
  const S = st(), P = S.pending;
  if (P.card && !P.card.done) scratchReveal();
  emit("panelEnd", { k: "scratch" });
  if (!P.n) return { done: false };
  S.today.push({ kind: "gamble", amt: P.got - P.spent, label: T("lbl.scratch", { n: P.n }) });
  S.workStreak = 0;
  if (P.got >= 500000) react(P.got - P.spent, { before: P.spent, jackpot: P.got >= 1e7 });
  else { galReact("lotto", {}, 1); M(P.got > P.spent ? T("sc.win", { a: won(P.got - P.spent) }) : T("sc.lose", { a: won(P.spent - P.got), c: conv(P.spent - P.got) }), P.got > P.spent ? "smug" : "tired"); hideDlg(); }
  return { done: true };
}

/* ---------- 빚또 4/20 (그날 저녁 추첨) ---------- */
export function lottoNums() { const pool = Array.from({ length: 20 }, (_, i) => i + 1), o = []; for (let i = 0; i < 4; i++) o.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]); return o.sort((a, b) => a - b); }
export const lottoToday = () => st().lotto.filter(t => t.d === absDay()).length;
export function lottoStart(loc) { st().pending = { t: "lotto", loc, n: 0 }; }
export function lottoBuy(k) {
  const S = st(), P = S.pending, price = R().LOTTO_PRICE;
  for (let i = 0; i < k; i++) { if (lottoToday() >= R().LOTTO_MAX || S.cash < price) break; S.cash -= price; P.n++; S.st.lotto++; S.lotto.push({ d: absDay(), n: lottoNums() }); }
  return {};
}
export function lottoDone() {
  const S = st(), P = S.pending;
  emit("panelEnd", { k: "lotto" });
  if (!P.n) return { done: false };
  S.today.push({ kind: "gamble", amt: -P.n * R().LOTTO_PRICE, label: T("lbl.lotto", { n: P.n }) });
  galReact("lotto", {}, 1);
  M(T("lotto.bought", { n: P.n }), "smug"); hideDlg();
  return { done: true };
}
export function lottoDraw() {
  const S = st();
  const mine = S.lotto.filter(t => t.d === absDay()); S.lotto = S.lotto.filter(t => t.d > absDay());
  if (!mine.length) return;
  const win = lottoNums(); let tot = 0;
  const rows = mine.map(t => { const m = t.n.filter(x => win.includes(x)).length, pz = D.LOTTO_PRIZE[m] || 0; tot += pz; return { n: t.n, m, pz }; });
  if (tot) { S.cash += tot; S.today.push({ kind: "gamble", amt: tot, label: T("lbl.lottoWin") }); }
  pushF("🔮", T("lotto.feed", { w: win.join("·"), r: tot ? T("lotto.feedWin", { a: won(tot) }) : T("lotto.feedNone") }), "money");
  emit("lottoDraw", { win, rows, tot, conv: tot ? conv(tot) : "" });
  if (tot >= 1e7) { fx("flex", { amt: tot }); galReact("bigwin", { amt: sgnMan(tot), conv: conv(tot) }, 3); aff(15, T("why.lotto1")); M(T("lotto.first"), "flex"); hideDlg(); }
}
