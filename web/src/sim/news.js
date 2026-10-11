/* sim/news.js — LLM 뉴스 디렉터 연동 (docs/LLM.md).
   게임이 정하는 것: 뉴스가 날지(WHEN 32%)·방향(호재/악재)·진짜/가짜(30%)·출처 등급·쓸 수 있는 종목/세기 목록(가드레일)·실제 크기(세기 구간 안에서 게임 난수).
   LLM 이 정하는 것: 목록 안의 종목·세기·사건·스토리 아크·헤드라인/기사/출처 문구.
   - S.llm 이 꺼져 있으면(기본, 골든·리플레이) newsReq 는 null 이고 genNews 는 예전 코드 그대로 (난수 소비 동일).
   - 요청(newsReq)은 상태 + 시드에서만 나오는 '뉴스 난수'(S.rng·S.fx 를 안 건드림)로 만든다 → 같은 상태면 같은 요청, 호스트가 미리(칸 시작) 받아 감.
   - 호스트 응답은 명령 newsFact 로 들어오고, 여기서 검증해 S.nfact 에 둔다. 칸 끝 genNews 때 맞는 칸의 사실이 있으면 쓰고, 없으면 내장 생성기. */
import { D, st } from "./core.js";
import { rnd, pick, m32 } from "./rng.js";
import { T } from "./fmt.js";
import { TKS, tkOpen, Tnow, absDay } from "./state.js";

export const STRENGTHS = ["weak", "mid", "strong"];
const LOG_MAX = 12, RECENT = 6, CAP_WIN = 6, CAP_N = 2, ARC_WIN = 12, ARC_MAX = 5;
const BAD = /[\u0000-\u001f\u007f-\u009f\u00a0\u2000-\u200f\u2028-\u202f\u205f\u3000\ufeff<>{}`\\]/g;
export const LIMITS = { headline: 60, body: 300, source: 20, event: 60 };

/* 뉴스 난수: 시드·칸 번호로만 정해짐 (게임 난수 상태와 무관) */
function hstream(G) {
  const S = st();
  let a = (S.seed ^ Math.imul(G + 1, 0x9E3779B1 | 0)) >>> 0;
  return () => { const [b, u] = m32(a); a = b >>> 0; return u / 4294967296; };
}
const pool = () => TKS().filter(k => k !== "INV" && tkOpen(k)).concat(["MKT"]);
const tkInfo = k => k === "MKT" ? { k, name: T("tick.all"), type: "market" } : { k, name: D.TK[k].name, type: D.TK[k].meme ? "meme" : D.TK[k].type };

/* 이번 칸 끝에 굴릴 뉴스의 요청 (없으면 null: LLM 모드 꺼짐 또는 이번 칸엔 뉴스 없음) */
export function newsReq() {
  const S = st();
  if (!S.llm) return null;
  const G = Tnow(), h = hstream(G);
  if (h() >= 0.32) return null;
  const P = pool();
  let pp = 0;
  for (const k of P) { const L = D.NEWS[k]; pp += L.filter(x => x[1] > 0).length / L.length; }
  pp /= P.length;
  const dir = h() < pp ? 1 : -1, fake = h() < 0.3, tier = Math.floor(h() * 3);
  const log = S.nlog || [], last = log.slice(-CAP_WIN);
  /* 가드레일: 최근 CAP_WIN 개 뉴스에 CAP_N 번 나온 종목은 이번엔 못 고름 */
  let ok = P.filter(k => last.filter(x => x.tk === k).length < CAP_N);
  if (!ok.length) ok = P;
  /* 가드레일: LLM 이 고른 세기 횟수가 최소보다 2 이상 많아지지 않게 → 장기적으로 세 구간 균등 = 크기 분포 유지 */
  const sc = S.nstr || [0, 0, 0], mn = Math.min(sc[0], sc[1], sc[2]);
  const strengths = STRENGTHS.filter((x, i) => sc[i] <= mn + 1);
  const arcs = [];
  for (const x of log) {
    if (!x.arc || x.slotId < G - ARC_WIN) continue;
    const a = arcs.find(y => y.id === x.arc);
    if (a) { a.tk = x.tk; a.step = x.step; a.h = x.h; a.slotId = x.slotId; } else arcs.push({ id: x.arc, tk: x.tk, step: x.step, h: x.h, slotId: x.slotId });
  }
  return {
    slotId: G, month: S.month, day: absDay(), slot: S.slot, dir, fake, tier,
    tickers: ok.map(tkInfo), strengths,
    recent: log.slice(-RECENT).map(x => ({ slotId: x.slotId, tk: x.tk, dir: x.dir, h: x.h, fake: x.fake, arc: x.arc, step: x.step })),
    arcs: arcs.filter(a => a.step < ARC_MAX),
  };
}

export function clean(s, max) {
  if (typeof s !== "string") return null;
  const x = s.replace(BAD, " ").replace(/ {2,}/g, " ").replace(/^ +| +$/g, "");
  return x.length && x.length <= max ? x : null;
}
/* 명령 newsFact 검증 → S.nfact. 틀리면 false (상태 안 바뀜) */
export function newsFact(c) {
  const S = st(), q = newsReq();
  if (!q || +c.slotId !== q.slotId || +c.dir !== q.dir) return false;
  if (typeof c.ticker !== "string" || !q.tickers.some(x => x.k === c.ticker)) return false;
  if (typeof c.strength !== "string" || !q.strengths.includes(c.strength)) return false;
  const h = clean(c.headline, LIMITS.headline), body = clean(c.body, LIMITS.body), src = clean(c.source, LIMITS.source), ev = clean(c.event, LIMITS.event);
  if (h === null || body === null || src === null || ev === null) return false;
  const arc = typeof c.arcId === "string" && /^[a-z0-9_-]{1,24}$/.test(c.arcId) ? c.arcId : null;
  const n = +c.arcStep, step = arc === null ? null : Number.isInteger(n) && n >= 1 && n <= ARC_MAX ? n : 1;
  S.nfact = { slotId: q.slotId, tk: c.ticker, s: STRENGTHS.indexOf(c.strength), h, body, src, ev, arc, step };
  return true;
}

export function logNews(n) {
  const S = st();
  if (!n) return;
  if (!S.nlog) S.nlog = [];
  S.nlog.push({ slotId: Tnow(), tk: n.tk, dir: n.dir, h: n.h, fake: n.fake, arc: n.arc || null, step: n.step || null });
  while (S.nlog.length > LOG_MAX) S.nlog.shift();
}

/* LLM 모드의 genNews: WHEN·방향·가짜는 요청 그대로, 크기는 종목 종류별 기존 구간을 세기로 3등분한 칸 안에서 게임 난수 */
export function genNewsLlm(old) {
  const S = st(), q = newsReq(), f = S.nfact && q && S.nfact.slotId === q.slotId ? S.nfact : null;
  S.nfact = null;
  if (!q) return null;
  let n;
  if (f) {
    const t = D.TK[f.tk], u = rnd(), part = (lo, w) => lo + w * (f.s + u) / 3;
    const mag = f.tk === "MKT" ? part(0.02, 0.02) : t.type === "stock" ? part(0.05, 0.07) : t.meme ? 0.4 : part(0.07, 0.09);
    if (!S.nstr) S.nstr = [0, 0, 0];
    S.nstr[f.s]++;
    n = { tk: f.tk, h: f.h, dir: q.dir, r: q.dir * mag, fake: q.fake, llm: 1, body: f.body, src: f.src, ev: f.ev, arc: f.arc, step: f.step };
  } else n = old(q);
  logNews(n);
  return n;
}
