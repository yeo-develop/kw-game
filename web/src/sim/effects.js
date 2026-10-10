/* sim/effects.js — 수치 변화 + 알림 기록 (카톡·피드·토스트). 화면 연출은 이벤트로만 알린다. */
import { D, R, st, emit } from "./core.js";
import { clamp, roundHalfUp } from "./num.js";
import { T } from "./fmt.js";
import { has, mental, absDay, Tnow, clockNow, rankOf } from "./state.js";

/* 체력: d 만큼 (음수 = 소모). 0 이 되면 기절 예약 (flow.faintCheck 가 칸 끝에 처리) */
export function hp(d, why) {
  const S = st();
  d = roundHalfUp(d); if (!d) return;
  const b = S.hp;
  S.hp = clamp(S.hp + d, 0, R().HP_MAX);
  if (S.hp !== b) emit("hp", { d: S.hp - b, why: why || "" });
}
/* 도박 중독도 0~100 */
export function addict(d, notMe) {
  const S = st();
  const b = S.addict;
  S.addict = clamp(roundHalfUp(S.addict + d), 0, 100);
  if (d > 0 && !notMe) { S.gday = absDay(); S.gT = Tnow(); }   /* 내가 도박한 칸·날 (미래 몰래 카지노는 제외) → 그 칸·그날은 중독도 감소 없음 */
  if (S.addict !== b) emit("addict", { d: S.addict - b, v: S.addict });
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
