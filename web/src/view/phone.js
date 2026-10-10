/* ================= view/phone.js — 폰 (v3.2 화면 그대로, 상태 변경은 sim 명령으로)
   (원래 머리말) v3.2 폰 = 전체 화면 오버레이 (카톡 · 주갤 · 개미증권 · 뉴스) =================
   여는 건 슬롯 소모 없음. 집·장소 메뉴·지도에서만 열림 (대화·미니게임 중엔 잠김). P / 📱 = 열기, Esc = 닫기 */
const PH = { on: false, app: "home", where: "app", res: null, room: "m", gtab: "all", gsel: null, gw: null, stab: "mkt", sel: null, amt: null, lev: 5, dir: 1, msg: "", tsel: "GSE" };
const APPS = [["home", "🏠", "홈"], ["kakao", "💬", "카톡"], ["gall", "📈", "주갤"], ["stock", "🐜", "개미증권"], ["news", "📰", "뉴스·알림"]];

/* ---------- 열기·닫기 ---------- */
function phoneOk() {
  if (!S || ["title", "opening", "ending", "morning", "payday"].includes(S.phase)) return false;
  if ($("#panel.on") || $("#modal.on") || $("#augPick.on") || $("#screen.on") || $("#full.on")) return false;
  if (chooseWait || advWait || typing) return false;
  return !!($("#side.on") || $("#map.on"));
}
function openPhone(app = "home", where = "app") {
  return new Promise(res => {
    if (PH.on) closePhone(true);
    Object.assign(PH, { on: true, app, where, res, msg: "", gw: null });
    if (app === "stock" && where === "broker") PH.stab = "detail";
    $("#phoneOv").classList.add("on"); phR();
  });
}
function closePhone(silent) {
  if (!PH.on) return;
  PH.on = false; $("#phoneOv").classList.remove("on"); $("#phoneOv").innerHTML = "";
  const r = PH.res; PH.res = null; PH.where = "app";
  updHud(); if (r) r();
  if (!silent) refreshSide();
}
function togglePhone(app) {
  if (PH.on) { closePhone(); return; }
  if (!phoneOk()) { toast("📵 지금은 폰 못 봄 (대화·게임 중엔 집중)", ""); return; }
  openPhone(app || "home");
}

/* ---------- 토스트 (메인 화면의 유일한 실시간 알림 줄) ---------- */
const TQ = []; let toastT = null;
function toast(text, kind = "", app, room) { TQ.push({ text, kind, app, room }); if (TQ.length > 4) TQ.shift(); if (!toastT) nextToast(); }
function nextToast() {
  const el = $("#toast"), t = TQ.shift();
  if (!t) { el.classList.remove("on"); toastT = null; return; }
  el.className = ""; void el.offsetWidth; el.className = "on " + t.kind;
  el.innerHTML = `<span>${esc(t.text)}</span>${t.app ? `<small>📱 폰에서 보기</small>` : ""}`;
  el.onclick = e => { e.stopPropagation(); if (t.app && phoneOk()) { if (t.room) PH.room = t.room; openPhone(t.app); } };
  toastT = setTimeout(nextToast, FAST ? 200 : 2800);
}

/* ---------- 배지 ---------- */
const kUnread = () => S.kun.m + S.kun.kim + S.kun.hy;
const unreal = () => q("unreal");
const hasPos = () => STK.some(k => S.hold[k]) || S.cps.length > 0;
let lastBdg = "";
function updBadges() {
  const el = $("#phBdg"); if (!el || !S) return;
  const k = kUnread(), g = S.gReact, n = S.gNew, pl = unreal();
  const html = (k ? `<b class="k">💬${k}</b>` : "") + (g ? `<b class="g">📈${g}</b>` : n ? `<b class="f">갤 ${n > 9 ? "9+" : n}</b>` : "") + (hasPos() ? `<b class="${pl >= 0 ? "pu" : "pd"}">${sgnMan(pl)}</b>` : "");
  if (html !== lastBdg) { el.innerHTML = html; if (lastBdg && html.length >= lastBdg.length) el.querySelectorAll("b").forEach(b => b.classList.add("new")); lastBdg = html; }
  else if (!el.innerHTML && html) el.innerHTML = html;
}

const rankOf = f => RANKS.filter(r => f >= r[0]).pop();
const nickIc = n => GN[n] ? GN[n].ic : n === "김사장(공식)" ? "💼" : n === "알바감남친" ? "💘" : "";
const postById = id => S.posts.find(p => p.id === id);
const rec = au => q("srcRec", au);
const wroteToday = () => S.wrote[absDay()] || 0;
const WRITE_MAX = RU.WRITE_MAX, GW = DATA.GW;
/* 안 읽음 처리 (폰을 보고 있으면 0) — 이벤트 없는 sim 명령 */
const markRead = c => { SIM.apply(S, Object.assign({ t: "read" }, c)); };
