/* sim/effects.js — 수치 변화 + 알림 기록 (카톡·피드·토스트). 화면 연출은 이벤트로만 알린다. */
import { D, st, emit } from "./core.js";
import { clamp, roundHalfUp } from "./num.js";
import { T } from "./fmt.js";
import { has, mental, absDay, clockNow, rankOf } from "./state.js";

/* 호감도 캔들 */
export function beginTurn() { const S = st(); S.cur = { o: S.aff, h: S.aff, l: S.aff, c: S.aff }; }
export function endTurn() { const S = st(); if (S.cur) { S.candles.push(S.cur); if (S.candles.length > 60) S.candles.shift(); S.cur = null; } }
export function aff(d, why) {
  const S = st();
  d = roundHalfUp(d); if (!d) return;
  S.aff = clamp(S.aff + d, 0, 100);
  if (S.cur) { S.cur.c = S.aff; S.cur.h = Math.max(S.cur.h, S.aff); S.cur.l = Math.min(S.cur.l, S.aff); }
  emit("aff", { d, why: why || "" });
}
export function stress(d) {
  const S = st();
  if (d > 0 && has("posi")) d *= 0.7;
  const before = mental();
  S.stress = clamp(S.stress + d, 0, 100);
  if (mental() !== before) emit("ment", { m: mental() });
}
export function money(d, kind, label) { const S = st(); S.cash += d; S.today.push({ kind, amt: d, label }); emit("cash", { d }); }
export function addDebt(d, label) { const S = st(); S.debt += d; S.st.maxDebt = Math.max(S.st.maxDebt, S.debt); S.today.push({ kind: "debt", amt: -d, label }); emit("debt", { d }); }
export function coverNeg() { const S = st(); if (S.cash < 0) { const d = Math.ceil(-S.cash); S.cash = 0; addDebt(d, T("lbl.cover")); } }
export function augFx(id, text) { emit("augfx", { id, text }); }
export function toast(text, kind, app, room) { emit("toast", { text, kind: kind || "", app: app || null, room: room || null }); }
export function fame(d) {
  const S = st();
  const before = rankOf(S.galFame);
  S.galFame = Math.max(0, S.galFame + d);
  const after = rankOf(S.galFame);
  if (after[0] > before[0]) { toast(T("fame.toast", { r: after[1], d: after[2] }), "gal", "gall"); pushF("🏅", T("fame.feed", { r: after[1], f: S.galFame, d: after[2] }), "fame"); }
}
/* 카톡: room = m | kim | hy, w = 보낸 쪽 (m, me, kim, hy, sys). 안 읽음 수는 view 가 read 명령으로 0 처리 */
export function pushK(w, x) { pushKR(w === "kim" ? "kim" : "m", w, x); }
export function pushKR(room, w, x) {
  const S = st();
  const L = S.kk[room]; L.push({ w, x, t: clockNow(), d: absDay() }); if (L.length > 60) L.splice(0, L.length - 60);
  if (w !== "me" && w !== "sys") S.kun[room]++;
  if (room === "kim" && w === "kim") toast(T("kim.toast", { x }), "kim", "kakao", "kim");
  emit("kakao", { room });
}
/* 뉴스·알림 피드 */
export function pushF(ic, x, kind, rows) {
  const S = st();
  S.feed.push({ ic, x, kind: kind || "", lab: T("feedLab", { m: S.month, d: S.day, s: D.SLOT_NAME[S.slot] }), rows });
  if (S.feed.length > 90) S.feed.shift();
  S.fUnread++;
  emit("feed", {});
}
