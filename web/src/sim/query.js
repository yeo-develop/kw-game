/* sim/query.js — view 가 읽기 전용으로 쓰는 계산들. query(S, fn, ...) 는 상태를 잠깐 묶고, 난수 상태는 되돌린다
   (글쓰기 미리보기의 돈 환산 드립 같은 연출 난수 소비가 저장 상태를 바꾸지 않게). */
import { bind, unbind } from "./core.js";
import * as St from "./state.js";
import * as Tp from "./tips.js";
import * as Tr from "./trade.js";
import * as Ga from "./games.js";
import * as Pl from "./places.js";
import * as Gl from "./gall.js";

export function query(S, fn, ...a) {
  const r0 = S.rng, f0 = S.fx;
  bind(S);
  try { return fn(...a); } finally { unbind(); S.rng = r0; S.fx = f0; }
}
export const Q = {
  has: St.has, rate: St.rate, interestDue: St.interestDue, menLine: St.menLine, mental: St.mental, absDay: St.absDay, Tnow: St.Tnow, loanCap: St.loanCap,
  stockOpen: St.stockOpen, tkOpen: St.tkOpen, stockVal: St.stockVal, cpnl: St.cpnl, cEq: St.cEq, coinVal: St.coinVal, holdVal: St.holdVal,
  liqPx: St.liqPx, unreal: St.unreal, hasPos: St.hasPos, kUnread: St.kUnread, rankOf: St.rankOf, todayPnl: St.todayPnl, todayLiq: St.todayLiq, wroteToday: St.wroteToday,
  moodFace: St.moodFace, isEve: St.isEve, hpMult: St.hpMult, hpCost: St.hpCost, jobHp: St.jobHp, clockNow: St.clockNow, liqOdds: St.liqOdds, TKS: St.TKS, STK: St.STK,
  srcOf: Tp.srcOf, srcRec: Tp.srcRec, whenLabel: Tp.whenLabel, resMark: Tp.resMark, activeTips: Tp.activeTips, rsch: Tp.rsch, freeMax: Tp.freeMax,
  stockFee: Tr.stockFee, hlMult: Ga.hlMult, ladderEnd: Ga.ladderEnd, mgHard: Ga.mgHard, lottoToday: Ga.lottoToday,
  locOpts: Pl.locOpts, loanFee: Pl.loanFee, relicPrice: Pl.relicPrice, draft: Gl.draft, postById: Gl.postById,
};
