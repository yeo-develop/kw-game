/* sim/core.js — 현재 상태 바인딩 · 이벤트 버퍼 · 데이터 테이블.
   규칙: DOM·타이머·await·HTML 없음. apply() 가 bind(S) 로 상태를 묶고, 모든 규칙 함수는 st() 로 꺼내 쓴다.
   (C# 이식: GameSim 인스턴스의 State 필드 + 이벤트 List 와 같은 구조) */

/* 콘텐츠 데이터 (data/*.json 을 평평하게 합친 것). Node 는 tools/load-data.mjs, 브라우저는 빌드가 인라인 */
export const D = {};
export function setData(o) { for (const k of Object.keys(o)) D[k] = o[k]; }
export const R = () => D.RULES;

let _S = null, _ev = null;
const CFG = { hud: false };
/* view 전용 옵션: hud=true 면 이벤트마다 HUD 스냅샷(h)을 붙인다 (sim-cli 는 끔 → 빠름) */
export function configure(o) { Object.assign(CFG, o || {}); }
export function bind(S) { _S = S; _ev = []; }
export function unbind() { const e = _ev; _S = null; _ev = null; return e || []; }
export function st() { return _S; }

let _snap = null;
/* hudSnap 은 state.js 가 등록 (순환 import 방지) */
export function setSnap(f) { _snap = f; }
export function emit(t, o) {
  if (!_ev) return;
  const e = Object.assign({ t }, o || {});
  if (CFG.hud && _snap && _S) e.h = _snap(_S);
  _ev.push(e);
}
