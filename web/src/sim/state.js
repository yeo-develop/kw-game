/* sim/state.js — 상태 스키마 + 읽기 전용 계산 (HUD·규칙 공용). 상태는 JSON 직렬화 가능한 평범한 객체. */
import { D, R, st, setSnap } from "./core.js";
import { clamp, round1k } from "./num.js";

export const STATE_VERSION = 33;
/* rngv: 2 = 이식 규격(기본) · 1 = v3.2 호환(레거시 난수·실수 펀딩비, 회귀 비교용) */
export function newState(seed, rngv = 2) {
  const r = R();
  const u = x => rngv >= 2 ? x >>> 0 : x | 0;
  return {
    version: STATE_VERSION, rngv, seed, rng: u(seed), fx: u(seed ^ 0x2545F491),
    month: 1, day: 1, slot: 0, phase: "opening", debt: r.DEBT0, cash: r.CASH0, aff: 50, stress: 20,
    outfit: "hoodie", owned: { hoodie: 1 }, props: {}, candles: [], cur: null, yday: [], today: [],
    kk: { m: [], kim: [], hy: [] }, kun: { m: 0, kim: 0, hy: 0 }, kq: null, posts: [], gid: 1, tips: [], wrote: {}, gNew: 0, gReact: 0,
    feed: [], fUnread: 0, shocks: {}, srcStat: {}, rsch: null, realized: 0, eqh: [], mplan: null, startT: -1,
    workStreak: 0, menKey: "", galFame: 0, lastJob: "", needMorning: false,
    augs: [], mk: null, hold: {}, cps: [], pid: 1, news: null, tip: null, whale: null, lotto: [], paidMonth: 0, insUsed: false, hl: null,
    st: { work: 0, gamble: 0, invest: 0, liq: 0, earned: 0, borrowed: 0, decor: 0, maxDebt: r.DEBT0, menOk: 0, menBad: 0, bigWin: 0, interest: 0, repaid: 0, race: 0, lotto: 0, pc: 0 },
    tg: "", tgT: 0, tutSeen: {}, mgN: 0,
    pending: null, flow: [], ending: null, endInfo: null,
  };
}

export const TKS = () => Object.keys(D.TK);
export const STK = () => TKS().filter(k => D.TK[k].type === "stock");
export const has = id => { const S = st(); return !!(S && S.augs.includes(id)); };
export const rate = () => R().RATE - (has("loanbro") ? 0.01 : 0);
export const interestDue = () => round1k(st().debt * rate());
export const menLine = () => has("posi") ? 90 : 70;
export const mental = () => { const S = st(); return S.stress >= menLine() ? "men" : S.stress >= 40 ? "anx" : "calm"; };
export const absDay = () => { const S = st(); return (S.month - 1) * R().MONTH_DAYS + S.day; };
export const Tnow = () => (absDay() - 1) * R().SLOTS + st().slot;
export const loanCap = () => R().LOAN_CAP[clamp(st().month, 1, 3) - 1];
export const stockOpen = () => { const s = st().slot; return s === 1 || s === 2; };
export const tkOpen = k => !D.TK[k].lock || has(D.TK[k].lock);
export const limitOf = kind => D.LIMIT0[kind] * R().LIMIT_MULT[clamp(st().month, 1, 3) - 1];
/* 포지션 평가 */
export const stockVal = () => { const S = st(); return STK().reduce((a, k) => a + (S.hold[k] ? S.hold[k].q * S.mk[k].p : 0), 0); };
export function cpnl(c, p) { const S = st(); return Math.max(-c.margin, c.margin * c.lev * c.mult * c.dir * ((p == null ? S.mk[c.tk].p : p) / c.entry - 1)); }
export const cEq = c => c.margin + cpnl(c) + (c.bonus || 0);
export const coinVal = () => st().cps.reduce((a, c) => a + cEq(c), 0);
export const holdVal = () => stockVal() + coinVal();
export const liqPx = c => c.entry * (1 - c.dir * 0.9 / (c.lev * c.mult));
export const unreal = () => { const S = st(); return STK().reduce((a, k) => a + (S.hold[k] ? S.hold[k].q * S.mk[k].p - S.hold[k].cost : 0), 0) + S.cps.reduce((a, c) => a + cpnl(c) + (c.bonus || 0), 0); };
export const hasPos = () => { const S = st(); return STK().some(k => S.hold[k]) || S.cps.length > 0; };
export const kUnread = () => { const S = st(); return S.kun.m + S.kun.kim + S.kun.hy; };
export const rankOf = f => D.RANKS.filter(r => f >= r[0]).pop();
export const todayPnl = () => st().today.filter(x => ["invest", "gamble"].includes(x.kind)).reduce((a, x) => a + x.amt, 0);
/* v3.2 와 동일: 오늘 기록 라벨에 '청산' 단어가 있으면 (경마 '청산각' 포함 — 원본 동작 유지) */
export const todayLiq = () => st().today.some(x => (x.label || "").includes(D.STR.liqWord));
export const wroteToday = () => st().wrote[absDay()] || 0;
export const moodFace = () => { const m = mental(); return m === "men" ? "menhera" : m === "anx" ? "tired" : st().aff >= 70 ? "happy" : "neutral"; };
export function clockNow() { const S = st(); return S && S.phase !== "title" ? (S.phase === "payday" ? "23:50" : D.SLOT_CLOCK[S.slot] || "09:00") : "09:00"; }
/* UI용: 한 칸 동안 청산가를 찍을 대략 확률 (반사 원리, 추세 무시) — 결과에 영향 없음 */
export function liqOdds(lev, vol) {
  const a = Math.log(1 / (1 - Math.min(0.99, 0.9 / lev))), sg = vol * Math.hypot(1, R().INTRA);
  const z = a / sg, t = 1 / (1 + 0.3275911 * z / Math.SQRT2);
  const erfc = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-z * z / 2);
  return Math.min(0.99, erfc);
}
/* HUD 스냅샷 (이벤트 재생 중 HUD를 그 시점 값으로) */
export function hudSnap(S) {
  return { phase: S.phase, month: S.month, day: S.day, slot: S.slot, cash: S.cash, debt: S.debt, aff: S.aff, stress: S.stress, paidMonth: S.paidMonth, hv: holdVal(), augs: S.augs.slice(), galFame: S.galFame, cur: S.cur ? Object.assign({}, S.cur) : null, nc: S.candles.length };
}
setSnap(hudSnap);
