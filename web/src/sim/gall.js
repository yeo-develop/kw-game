/* sim/gall.js — 주식 갤러리(글·댓글·찌라시·내 글 반응) + 미래 카톡 질문 + 형나믿지 DM. */
import { D, R, st, emit } from "./core.js";
import { rnd, frnd, pick, fpick } from "./rng.js";
import { T, fill, won, sgnWon, man, sgnMan, pct, conv } from "./fmt.js";
import { roundHalfUp } from "./num.js";
import { TKS, STK, Tnow, absDay, tkOpen, cpnl, mental, rate, interestDue, todayPnl, todayLiq, wroteToday } from "./state.js";
import { rollTip, tipAnnounce, whenLabel, srcRec } from "./tips.js";
import { stress, fame, toast, pushF, pushKR } from "./effects.js";
import { ANON, HY, MATH, KIM_OFF, ME_AU } from "./ids.js";

export const postById = id => st().posts.find(p => p.id === id);
export function genCm(n) {
  const out = [], seen = new Set(), GN = Object.keys(D.GN);
  for (let i = 0; i < n * 2 && out.length < n; i++) {
    const who = frnd() < 0.45 ? ANON : fpick(GN), x = fpick((D.CM[who] || []).concat(D.CM.any));
    if (seen.has(x)) continue; seen.add(x); out.push({ au: who, x, up: Math.floor(frnd() * 14) });
  }
  return out;
}
export function addPost(o) {
  const S = st();
  const p = Object.assign({ id: S.gid++, T: Tnow(), lab: `${S.month}-${S.day} ${D.SLOT_NAME[S.slot]}`, up: 0, dn: 0, cm: [], tag: T("tag.normal"), body: "" }, o);
  p.best = p.up >= 50;
  S.posts.push(p);
  while (S.posts.length > 70) { const i = S.posts.findIndex(x => !x.mine); if (i < 0) break; S.posts.splice(i, 1); }
  S.gNew++;
  emit("post", { id: p.id });
  return p;
}
/* 미래 관련 반응 글 1개 + 댓글 (GAL 대사 재활용) */
export function galReact(cat, ctx = {}, n = 3) {
  const S = st(), f = x => fill(x, ctx);
  const recent = new Set(S.posts.slice(-12).flatMap(p => p.cm.map(c => c.x)));
  const pool = D.GAL[cat].filter(([, x]) => !recent.has(f(x))), out = [];
  while (pool.length && out.length < Math.max(2, n)) out.push(pool.splice(Math.floor(frnd() * pool.length), 1)[0]);
  if (!out.length) return;
  const [au, x0] = out[0];
  addPost({ au: au === KIM_OFF ? au : frnd() < 0.5 ? au : ANON, tag: T(cat === "news" ? "tag.news" : "tag.react"), title: f(D.GR_T[cat] || x0), body: f(x0), up: D.HOT[cat] ? 40 + Math.floor(frnd() * 140) : Math.floor(frnd() * 42), dn: Math.floor(frnd() * 12),
    cm: out.slice(1).map(([a, x]) => ({ au: a, x: f(x), up: Math.floor(frnd() * 25) })).concat(genCm(1 + Math.floor(frnd() * 3))) });
}
export function makeTip(au, via, tk0) {
  const t = rollTip(au, { tk: tk0 }), dw = T(t.dir > 0 ? "dw.up" : "dw.dn"), nm = D.TK[t.tk].name, wl = whenLabel(t.Tr);
  if (via === "dm") pushKR("hy", "hy", au === MATH ? T("hy.mathTip", { nm, wl, dw, rec: srcRec(au) }) : fill(fpick(D.STR["hy.tip"]), { nm, wl, dw }));
  else if (via === "post") {
    const [ti, b] = fpick(D.TIPT[au]); const f = x => x.replace(/\{tk\}/g, nm).replace(/\{dw\}/g, dw);
    t.pid = addPost({ au, tag: T("tag.tip"), title: f(ti), body: f(b) + T("tip.when", { wl }), up: Math.floor(frnd() * 30), dn: Math.floor(frnd() * 10), cm: genCm(2 + Math.floor(frnd() * 3)), tip: t.id }).id;
  }
  tipAnnounce(t, via);
  return t;
}
/* 시황 · NPC 인증 글 (칸 끝) */
export function gallMarketPosts(mv) {
  const S = st(), ks = TKS().filter(k => tkOpen(k)), top = ks.reduce((a, k) => Math.abs(mv[k].r) > Math.abs(mv[a].r) ? k : a, ks[0]);
  const r = mv[top].r, nm = D.TK[top].name;
  if (frnd() < 0.6) addPost({ au: ANON, tag: T("tag.mkt"), title: T("mkt.title", { nm, p: pct(r) }), body: T("mkt.body", { s: D.SLOT_NAME[S.slot], nm, p: pct(r), q: T(r < 0 ? "mkt.dn" : "mkt.up") }), up: Math.floor(frnd() * 40), dn: Math.floor(frnd() * 8), cm: genCm(3 + Math.floor(frnd() * 4)) });
  if (frnd() < 0.3) {
    const au = fpick(D.STR.mktAu), tk = fpick(ks), lev = fpick([1, 3, 10, 25, 50]), loss = frnd() < 0.65, amt = roundHalfUp((20 + frnd() * 900)) * 10000;
    const v = { tk: D.TK[tk].name, lev, amt: man(amt) };
    addPost({ au, tag: T("tag.proof"), title: T(loss ? "proof.lossT" : "proof.gainT", v), body: T(loss ? "proof.lossB" : "proof.gainB", { c: conv(amt) }), up: 20 + Math.floor(frnd() * (loss ? 120 : 60)), dn: Math.floor(frnd() * 20), cm: genCm(3 + Math.floor(frnd() * 4)) });
  }
}
/* 칸 시작: 찌라시 글 + 내 글 반응 정산 */
export function gallTick() {
  const S = st();
  if (rnd() < 0.5) {
    const list = Object.keys(D.GN), tot = list.reduce((a, k) => a + D.GN[k].w, 0); let r = rnd() * tot, au = list[0];
    for (const k of list) { r -= D.GN[k].w; if (r <= 0) { au = k; break; } }
    makeTip(au, "post");
  }
  for (const p of S.posts) if (p.mine && p.pend && p.T < Tnow()) settleMine(p);
}

/* ---------- 내 글 ---------- */
function holdText() {
  const S = st();
  const a = STK().filter(k => S.hold[k]).map(k => { const h = S.hold[k], v = h.q * S.mk[k].p; return `${D.TK[k].name} ${pct(v / h.cost - 1)}`; })
    .concat(S.cps.map(c => T("hold.coin", { n: D.TK[c.tk].name, lev: c.lev, d: T(c.dir > 0 ? "long" : "short"), p: sgnMan(cpnl(c) + (c.bonus || 0)) })));
  return a.length ? T("hold.has", { l: a.join(", ") }) : T("hold.none");
}
function waterTarget() {
  const S = st();
  const s = STK().find(k => S.hold[k] && S.hold[k].q * S.mk[k].p < S.hold[k].cost);
  if (s) return { tk: s, r: S.hold[s].q * S.mk[s].p / S.hold[s].cost - 1 };
  const c = S.cps.find(c => cpnl(c) < 0); if (c) return { tk: c.tk, r: cpnl(c) / c.margin };
  return null;
}
/* 글쓰기 미리보기 (템플릿 → 실제 상황으로 자동 작성) */
export function draft(k) {
  const S = st(), pnl = todayPnl(), decor = Object.keys(S.props).length + Object.keys(S.owned).length - 1;
  const base = { m: S.month, d: S.day, pnl: sgnWon(pnl), pm: sgnMan(pnl), c: pnl ? conv(pnl) : T("conv0"), hold: holdText(), debt: won(S.debt) };
  switch (k) {
    case "gain": { const big = pnl >= 1e6, ok = pnl >= 50000; return { ok, big, tag: T("tag.proof"), title: T(ok ? (big ? "gw.gain.tBig" : "gw.gain.tOk") : "gw.gain.tNo", base), body: T("gw.gain.b", base), why: T(ok ? (big ? "gw.gain.wBig" : "gw.gain.wOk") : "gw.gain.wNo") }; }
    case "loss": { const ok = pnl <= -50000 || todayLiq(); return { ok, tag: T("tag.proof"), title: T(ok ? "gw.loss.tOk" : "gw.loss.tNo", base), body: (todayLiq() ? T("gw.loss.liq") : "") + T("gw.loss.b", Object.assign({}, base, { c: pnl ? conv(pnl) : T("zeroWon") })), why: T(ok ? "gw.loss.wOk" : "gw.loss.wNo") }; }
    case "gf": { const it = D.ITEMS.find(x => x.id === S.outfit); return { ok: true, tag: T("tag.brag"), title: T("gw.gf.t"), body: T("gw.gf.b", { hp: roundHalfUp(S.hp), o: it ? T("gw.gf.wear", { n: it.name }) : T("gw.gf.hoodie"), r: decor > 0 ? T("gw.gf.decor", { n: decor }) : T("gw.gf.jail"), day: absDay() }), why: T("gw.gf.w") }; }
    case "water": { const w = waterTarget(); return { ok: !!w, tk: w && w.tk, tag: T("tag.q"), title: w ? T("gw.water.t", { n: D.TK[w.tk].name, p: pct(w.r) }) : T("gw.water.tNo"), body: w ? T("gw.water.b", { p: pct(w.r), hold: base.hold }) : T("gw.water.bNo"), why: T(w ? "gw.water.w" : "gw.water.wNo") }; }
    case "kim": return { ok: true, tag: T("tag.sue"), title: T("gw.kim.t", { r: roundHalfUp(rate() * 100) }), body: T("gw.kim.b", { debt: won(S.debt), due: won(interestDue()) }), why: T("gw.kim.w") };
  }
  return null;
}
export function submitPost(k) {
  const S = st();
  if (!k || wroteToday() >= R().WRITE_MAX) return null;
  const d = draft(k);
  S.wrote[absDay()] = wroteToday() + 1;
  const p = addPost({ au: ME_AU, mine: 1, pend: 1, wk: k, ok: d.ok, big: d.big, wtk: d.tk, tag: d.tag, title: d.title, body: d.body, up: 0, dn: 0, pnl: todayPnl(), cm: [] });
  S.gNew = Math.max(0, S.gNew - 1);
  emit("bubble", { text: fpick(D.STR["post.bubble"]), ms: 1800, face: "smug" });
  return p;
}
export function settleMine(p) {
  const S = st();
  p.pend = 0;
  const pnl = p.pnl, mul = (0.75 + rnd() * 0.5) * (1 + S.galFame / 100) * (S.galFame >= 35 ? 1.3 : 1);
  let up = 0, dn = Math.floor(rnd() * 8), fm = 0, cmk = p.wk;
  if (!p.ok) { up = 2 + Math.floor(rnd() * 6); dn = 60 + Math.floor(rnd() * 60); fm = p.wk === "water" ? 0 : -3; cmk = p.wk === "water" ? "water" : "fake"; }
  else if (p.wk === "gain") { if (p.big) { up = Math.min(420, 45 + pnl / 30000) * mul; cmk = "big"; } else up = Math.min(60, 8 + pnl / 20000) * mul; }
  else if (p.wk === "loss") up = Math.min(450, 40 + Math.abs(pnl) / 20000) * mul;
  else if (p.wk === "gf") up = (10 + (100 - S.stress) * 0.4 + S.hp * 0.2 + (Object.keys(S.props).length + Object.keys(S.owned).length - 1) * 8) * mul;
  else if (p.wk === "water") up = (3 + rnd() * 14) * mul;
  else if (p.wk === "kim") up = (40 + rnd() * 50) * mul;
  up = roundHalfUp(up);
  /* 명성: 손절·대박 인증이 제일 큼(최대 9), 나머지 최대 4. 명성이 높을수록 체감 (÷(1+명성/40)) */
  if (p.ok) { const base = p.wk === "loss" ? Math.min(9, 3 + up / 50) : p.wk === "gain" ? (p.big ? Math.min(9, 3 + up / 60) : Math.min(3, up / 25)) : Math.min(4, up / 40 + (p.wk === "kim" ? 1 : 0)); fm = base > 0 ? Math.max(1, roundHalfUp(base / (1 + S.galFame / 40))) : 0; }
  p.up = up; p.dn = dn; p.best = up >= 50; p.fm = fm;
  const pool = D.MYCM[cmk].slice(), k = 3 + Math.floor(frnd() * 4), GN = Object.keys(D.GN);
  for (let i = 0; i < k && pool.length; i++) p.cm.push({ au: frnd() < 0.5 ? ANON : fpick(GN), x: pool.splice(Math.floor(frnd() * pool.length), 1)[0].replace("{conv}", conv(pnl || 10000)), up: Math.floor(frnd() * 40) });
  if (p.wk === "water" && p.ok) {
    /* v3.2 는 이 작성자를 연출 난수로 뽑았음(적중률이 시세에 영향 → 재현 불가 버그). v2 는 게임 난수 */
    const au = S.rngv >= 2 ? pick(D.STR.waterAu) : fpick(D.STR.waterAu), t = makeTip(au, "cm", p.wtk);
    p.cm.push({ au, x: T("water.cm", { n: D.TK[t.tk].name, w: whenLabel(t.Tr), dw: T(t.dir > 0 ? "dw.up" : "dw.dn"), rec: srcRec(au) }), up: Math.floor(frnd() * 20), tipc: 1 });
  }
  if (p.wk === "kim") { if (S.phase !== "ending") pushKR("kim", "kim", fpick(D.KIM_DM.sue)); stress(6); }
  if (fm) fame(fm);
  S.gReact++;
  const msg = T("mine.msg", { t: p.title.slice(0, 22) + (p.title.length > 22 ? "…" : ""), up, b: p.best ? T("mine.best") : "", f: fm ? T("mine.fame", { f: (fm > 0 ? "+" : "") + fm }) : "" });
  toast(msg, "gal", "gall"); pushF("📝", msg, "gal");
}
export function upvote(id) { const p = postById(id); if (p && !p.myUp) { p.myUp = 1; p.up++; p.best = p.up >= 50; } }

/* ---------- 미래 카톡 질문 (맞는 답 1 + 오답 2) ---------- */
export function kqMaybe() {
  const S = st();
  if (S.kq || mental() === "men" || rnd() >= 0.32) return;
  const i = Math.floor(rnd() * D.KQ.length), q = D.KQ[i];
  const opts = [{ l: q.ok, ok: 1 }, { l: q.no[0] }, { l: q.no[1] }];
  for (let j = 2; j > 0; j--) { const r = Math.floor(rnd() * (j + 1)); [opts[j], opts[r]] = [opts[r], opts[j]]; }
  S.kq = { i, opts, T: Tnow() };
  pushKR("m", "m", q.q);
}
export function kqExpire() {
  const S = st();
  if (S.kq && Tnow() - S.kq.T >= 2) {
    S.kq = null; pushKR("m", "m", fpick(D.STR["kq.ignored"]));
    stress(3);
  }
}
export function kqReply(i) {
  const S = st();
  if (!S.kq) return;
  const o = S.kq.opts[i], q = D.KQ[S.kq.i]; S.kq = null;
  pushKR("m", "me", o.l);
  if (o.ok) { pushKR("m", "m", q.good); stress(-6); } else { pushKR("m", "m", q.bad); stress(3); }
}
export function hyMaybe() {
  const S = st(), r = rnd();
  if (S.galFame >= D.FAME.dm && r < 0.3) makeTip(MATH, "dm");   // 명성 보상: 수학자급 정보
  else if (r < 0.25) makeTip(HY, "dm");
  else if (r < 0.4) pushKR("hy", "hy", fpick(D.HY_TALK));
}
