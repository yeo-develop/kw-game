/* web/tools/bots.mjs — 헤드리스 봇 전략 (sim API 만 사용). Playwright 봇(play32/33)의 결정 규칙을 단순화해 옮김.
   전략: work(알바 위주) · invest(정보 따라 주식·코인) · gamble(카지노·경마·복권) · random.
   미니게임 점수 = 평균 사람 가정 0.6~0.8 균등 (봇 난수). 봇 난수는 게임 난수와 별개(LCG). */
import * as SIM from "../src/sim/index.js";

const AUGPREF = {
  work: ["grind", "posi", "loanbro", "divi", "insure"],
  gamble: ["addict", "loanbro", "posi", "insure", "allin"],
  invest: ["rumor", "meme", "whale", "kimp", "vip", "insure", "divi", "diverse", "scalp", "hodl", "inverse", "loanbro", "posi", "grind", "allin", "addict"],
};
const STOCKS = ["GSE", "BAT", "GUK", "INV"];

export function runGame(seed, strat, opt = {}) {
  let bs = (seed * 7919 + 13) >>> 0;
  const br = () => ((bs = (bs * 1103515245 + 12345) % 2147483648) / 2147483648);
  const bpick = a => a[Math.floor(br() * a.length)];
  let S = SIM.createGame(seed, { rngv: opt.rngv });
  const Q = (n, ...a) => SIM.query(S, SIM.Q[n], ...a);
  let steps = 0, errs = 0;
  const cmds = opt.record ? [] : null;
  const go = c => { if (cmds) cmds.push(c); const r = SIM.apply(S, c); S = r.state; steps++; for (const e of r.events) if (e.t === "error") errs++; return r.events; };
  let plan = null;
  const tradeDone = {};
  /* 투자 매매 한 단계 (play32 tradeAct 단순판) */
  function trade() {
    const T = Q("Tnow"), d = tradeDone[T] || (tradeDone[T] = new Set());
    const E = S.cash + Q("holdVal"), due = Q("interestDue");
    const needCash = (S.paidMonth !== S.month && S.day === 7 && S.slot >= 2) ? due * 1.05 : 0;
    const rich = E >= S.debt + (S.paidMonth !== S.month ? due : 0);
    const open = Q("stockOpen");
    for (let guard = 0; guard < 12; guard++) {
      const locked = c => c.t0 === Q("Tnow");
      if (rich || (needCash && S.cash < needCash)) {
        const c = S.cps.find(c => !locked(c)); if (c) { go({ t: "close", id: c.id }); continue; }
        if (open) { const k = Object.keys(S.hold)[0]; if (k) { go({ t: "sell", tk: k, frac: 1, where: "app" }); continue; } }
        return;
      }
      if (strat === "random") {
        if (d.size >= 2) return;
        const tk = bpick(["GSE", "BAT", "GUK", "INV", "BTK", "TOK"]); d.add("r" + d.size);
        if (["BTK", "TOK"].includes(tk) && S.cash > 50000) { go({ t: "open", tk, dir: bpick([1, -1]), lev: bpick([1, 5, 10, 25, 50]), amt: Math.floor(S.cash * bpick([0.1, 0.3, 0.6]) / 10000) * 10000 }); continue; }
        if (open && S.cash > 50000) { go({ t: "buy", tk, amt: Math.floor(S.cash * 0.2 / 10000) * 10000, where: "app" }); continue; }
        const c = S.cps.find(c => !locked(c)); if (c) { go({ t: "close", id: c.id }); continue; }
        return;
      }
      /* invest: 증권사 리포트·수학자·기록 좋은 출처만 따라감 */
      const good = t => t.tier === "rep" || t.who === "수학자" || (S.srcStat[t.who] && S.srcStat[t.who][1] >= 4 && S.srcStat[t.who][0] / S.srcStat[t.who][1] >= 0.62);
      const tips = Q("activeTips").filter(good), free = S.cash - needCash;
      const c0 = S.cps.find(c => !locked(c) && !tips.some(t => t.tk === c.tk && t.dir === c.dir)); if (c0) { go({ t: "close", id: c0.id }); continue; }
      let did = false;
      if (open) {
        for (const k of Object.keys(S.hold)) if (!tips.some(t => t.tk === k && t.dir > 0) && !d.has("s" + k)) { d.add("s" + k); go({ t: "sell", tk: k, frac: 1, where: "app" }); did = true; break; }
        if (did) continue;
        for (const t of tips) if (STOCKS.includes(t.tk) && t.dir > 0 && !S.hold[t.tk] && !d.has("b" + t.tk)) { d.add("b" + t.tk); const amt = Math.floor(Math.min(E * 0.3, free * 0.6) / 10000) * 10000; if (amt >= 50000) { go({ t: "buy", tk: t.tk, amt, where: "app" }); did = true; break; } }
        if (did) continue;
      }
      for (const t of tips) if (!STOCKS.includes(t.tk) && !S.cps.some(c => c.tk === t.tk) && !d.has("o" + t.tk)) { d.add("o" + t.tk); const amt = Math.floor(Math.min(E * 0.1, free * 0.5) / 10000) * 10000; if (amt >= 50000) { go({ t: "open", tk: t.tk, dir: t.dir, lev: 2, amt }); did = true; break; } }
      if (!did) return;
    }
  }
  function decide() {
    const p = { T: Q("Tnow"), steps: [] }, room = Q("loanCap") - S.debt, st = S;
    if (strat === "work") { if (st.stress >= 56) p.steps.push(["rest"]); else p.steps.push(["go", "work", bpick(["l-cafe", "l-store", "l-ware"])]); }
    else if (strat === "gamble") {
      if (st.cash < 3000000) { let r = room; for (const L of [300, 300, 300, 100, 50]) if (r >= L * 10000) { p.steps.push(["loan", L * 10000]); r -= L * 10000; } }
      if (st.stress >= 80) p.steps.push(["rest"]);
      else if (st.slot === 3) p.steps.push(["go", "casino", bpick(["l-oddeven", "l-card", "l-slot", "l-ladder"])]);
      else if (st.slot === 2) p.steps.push(br() < 0.5 ? ["go", "casino", bpick(["l-oddeven", "l-card", "l-ladder"])] : ["go", "race", "l-race"]);
      else if (st.slot === 1) p.steps.push(["go", "race", "l-race"]);
      else p.steps.push(["go", "lotto", bpick(["l-lotto", "l-scratch"])]);
    } else if (strat === "invest") {
      const E = st.cash + Q("holdVal");
      if (st.month <= 2 && st.day === 1 && st.slot === 0 && room >= 3000000 && E > 0) p.steps.push(["loan", 3000000], ["loan", 3000000]);
      p.steps.push(["trade"]);
      const rich = E >= st.debt + (st.paidMonth !== st.month ? Q("interestDue") : 0);
      if (rich && (st.slot === 1 || st.slot === 2)) p.steps.push(["go", "bank", "l-repay"]);
      else if (st.stress >= 62) p.steps.push(br() < 0.5 && st.cash > 20000 ? ["go", "pc", "l-pcgame"] : ["rest"]);
      else if ((st.slot === 1 || st.slot === 2) && !st.augs.includes("rumor") && br() < 0.5) p.steps.push(["go", "broker", "l-tip"]);
      else p.steps.push(["go", "work", bpick(["l-cafe", "l-store", "l-ware"])]);
    } else {
      if (br() < 0.08 && room >= 1000000) p.steps.push(["loan", bpick([500000, 1000000, 3000000])]);
      if (br() < 0.3) p.steps.push(["trade"]);
      if (br() < 0.15) p.steps.push(["rest"]); else p.steps.push(["go", "rand", null]);
    }
    /* 폰: 카톡 답장 · 갤 글 */
    if (st.kq && br() < (strat === "random" ? 0.5 : 0.8)) p.steps.unshift(["kq", strat === "random" ? Math.floor(br() * 3) : st.kq.opts.findIndex(o => o.ok)]);
    if (Q("wroteToday") < 2 && br() < (strat === "work" ? 0.15 : 0.35)) { const tp = Q("todayPnl"); let t = tp <= -50000 ? "loss" : tp >= 50000 ? "gain" : bpick(["gf", "kim", "water"]); if (strat === "random") t = bpick(["gain", "loss", "gf", "water", "kim"]); p.steps.unshift(["post", t]); }
    return p;
  }
  go({ t: "start" });
  let guard = 0;
  while (S.pending && S.pending.t !== "ending" && guard++ < 20000) {
    const P = S.pending;
    switch (P.t) {
      case "aug": {
        let k = 0;
        if (strat === "random") k = Math.floor(br() * P.offer.length);
        else { const pref = AUGPREF[strat]; let best = 99; P.offer.forEach((id, i) => { const r = pref.indexOf(id), rr = r < 0 ? 50 : r; if (rr < best) { best = rr; k = i; } }); }
        go({ t: "aug", i: k }); break;
      }
      case "home": {
        if (!plan || plan.T !== Q("Tnow")) plan = decide();
        const s = plan.steps.shift();
        if (!s || s[0] === "rest") { go({ t: "rest" }); break; }
        if (s[0] === "loan") { go({ t: "loanOpen" }); if (S.debt + s[1] <= Q("loanCap")) go({ t: "borrow", amt: s[1] }); go({ t: "loanDone" }); break; }
        if (s[0] === "trade") { if (strat === "invest") go({ t: "report", paid: false }); trade(); break; }
        if (s[0] === "kq") { go({ t: "kqReply", i: s[1] }); break; }
        if (s[0] === "post") { go({ t: "post", k: s[1] }); break; }
        if (s[0] === "go") { plan.go = s; go({ t: "map" }); }
        break;
      }
      case "map": {
        let loc = plan && plan.go ? plan.go[1] : "home";
        const openL = Object.keys(SIM.D.LOCS).filter(k => SIM.D.LOCS[k].open.includes(S.slot));
        if (loc === "rand") loc = openL.length ? bpick(openL) : "home";
        if (!openL.includes(loc)) loc = "home";
        if (plan && plan.go) plan.go = ["went", loc, plan.go[2]];
        if (loc === "home") { go({ t: "goTo", loc }); go({ t: "rest" }); break; }
        go({ t: "goTo", loc }); break;
      }
      case "encounter": go({ t: "encounter", ask: strat === "invest" ? !P.opts[0].dis : strat === "random" ? br() < 0.5 && !P.opts[0].dis : false }); break;
      case "loc": {
        const want = plan && plan.go && plan.go[2], opts = Q("locOpts", P.key).filter(o => !o.dis).map(o => o.k);
        if (plan && plan.acted === Q("Tnow") + ":" + P.key) { go({ t: "leave" }); break; }
        const k = want && opts.includes(want) ? want : strat === "random" && opts.length ? bpick(opts) : null;
        if (plan) plan.acted = Q("Tnow") + ":" + P.key;
        go(k ? { t: "act", k } : { t: "leave" }); break;
      }
      case "work": if (!P.setup) go({ t: "mgSetup" }); else go({ t: "mgResult", score: 0.6 + br() * 0.2 }); break;
      case "casino": {
        const mx = Math.floor(Math.min(S.cash, P.lim) / 10000) * 10000;
        if (mx < 10000 || (P.rounds > 0 && !(strat === "gamble" || (strat === "random" && br() < 0.5)))) { go({ t: "casinoLeave" }); break; }
        const q = strat === "gamble" ? 1 : bpick([0.1, 0.5, 1]); const stake = Math.max(10000, Math.floor(mx * q / 10000) * 10000);
        const ch = P.kind === "card" ? (SIM.query(S, SIM.Q.hlMult, P.A, 1) ? (SIM.query(S, SIM.Q.hlMult, P.A, 0) ? (P.A <= 7 ? 1 : 0) : 1) : 0) : P.kind === "ladder" ? Math.floor(br() * 3) : P.kind === "oddeven" ? Math.floor(br() * 2) : 0;
        go({ t: "bet", stake, choice: ch }); break;
      }
      case "race": {
        const mx = Math.floor(Math.min(S.cash, P.lim) / 10000) * 10000; if (mx < 10000) { go({ t: "raceLeave" }); break; }
        const i = strat === "work" ? P.H.reduce((b, h, j) => h.odds < P.H[b].odds ? j : b, 0) : Math.floor(br() * 5);
        const q = strat === "gamble" ? 1 : bpick([0.1, 0.5]); go({ t: "raceBet", i, stake: Math.max(10000, Math.floor(mx * q / 10000) * 10000) }); break;
      }
      case "scratch": { if (P.card && !P.card.done) go({ t: "scratchReveal" }); else if (P.n < (strat === "gamble" ? 5 : 2) && S.cash >= 5000) go({ t: "scratchBuy" }); else go({ t: "scratchDone" }); break; }
      case "lotto": if (!P.n && S.cash >= 10000) go({ t: "lottoBuy", k: strat === "gamble" ? 5 : 1 }); else go({ t: "lottoDone" }); break;
      case "repay": go({ t: "repay", amt: P.mx }); break;
      case "shop": go({ t: "shopDone" }); break;
      case "brokerTrade": go({ t: "brokerClose" }); break;
      case "menhera": go({ t: "reply", i: strat === "random" ? Math.floor(br() * 3) : 0 }); break;
      case "loan": go({ t: "loanDone" }); break;
      case "payday": {
        const ok = P.opts.filter(o => !o.dis).map(o => o.k);
        let k;
        if (P.stage === "side") k = bpick(ok);
        else if (P.stage === "repay") k = strat === "work" ? "repayAll" : strat === "invest" ? (S.cash >= S.debt ? "repayAll" : "keep") : strat === "gamble" ? "keep" : bpick(ok);
        else { const pref = strat === "gamble" ? ["bet", "pay", "sell", "loan"] : strat === "random" ? null : ["pay", "sell", "loan", "bet"]; k = pref ? pref.find(x => ok.includes(x)) : bpick(ok); }
        go({ t: "payday", k: k || ok[0] }); break;
      }
      default: throw new Error("unknown pending " + P.t);
    }
  }
  return { seed, strat, end: S.ending || "none", month: S.month, day: S.day, days: (S.month - 1) * 7 + S.day, debt: S.debt, cash: S.cash, fame: S.galFame, liq: S.st.liq, steps, errs, state: opt.keepState ? S : null, cmds };
}
