/* ================= view/base.js — 기본 유틸 · sim 연결 =================
   view 는 클래식 스크립트(같은 전역 스코프). 게임 상태는 sim 이 소유: S = 현재 상태(읽기 전용으로 씀),
   바꾸려면 send(명령) → SIM.apply → 이벤트 재생(events.js). 계산은 q("이름", …) = SIM.query. */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const QS = new URLSearchParams(location.search);
const FAST = QS.get("fast") === "1";
const wait = ms => new Promise(r => setTimeout(r, FAST ? 0 : ms));
const clamp = SIM.clamp;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const { won, sgnWon, man, sgnMan, pct, fmtP, stars } = SIM.F;
const TX = (k, v) => SIM.F.T(k, v);
SIM.configure({ hud: true });

/* 데이터 테이블 (읽기 전용) */
const TK = DATA.TK, TKS = Object.keys(TK), STK = TKS.filter(k => TK[k].type === "stock");
const NPCS = DATA.NPCS, AUG = Object.fromEntries(DATA.AUGS.map(a => [a.id, a])), TIER = DATA.TIER;
const RU = DATA.RULES, MONTH_DAYS = RU.MONTH_DAYS, SLOTS = RU.SLOTS, SLOT_NAME = DATA.SLOT_NAME, SLOT_IC = DATA.SLOT_IC, SLOT_CLOCK = DATA.SLOT_CLOCK;
const GN = DATA.GN, FAME = DATA.FAME, RANKS = DATA.RANKS, KROOM = DATA.KROOM, ITEMS = DATA.ITEMS, JOBS = DATA.JOBS, LOCS = DATA.LOCS, LOC_KEYS = Object.keys(LOCS);
const SAVE_KEY = "longjab_v34";
const REC_KEY = "longjab_records";   /* 엔딩 기록 (본 엔딩·최고 점수) */

/* 연출용 난수 (파티클 위치 등) — 결과에 영향 없음, 상태에 안 들어감 */
let fxSeed = (Date.now() ^ 0x5bd1e995) | 0;
function frnd() { const [a, u] = SIM.m32(fxSeed); fxSeed = a; return u / 4294967296; }
const fpick = arr => arr[Math.floor(frnd() * arr.length)];

/* ---------- sim 연결 ---------- */
let S = null;
const q = (name, ...a) => SIM.query(S, SIM.Q[name], ...a);
const conv = n => SIM.query(S, SIM.F.conv, n);
const has = id => !!(S && S.augs.includes(id));
const absDay = () => (S.month - 1) * MONTH_DAYS + S.day;
const Tnow = () => (absDay() - 1) * SLOTS + S.slot;
const stockOpen = () => RU.STOCK_SLOTS.includes(S.slot);
const isEve = () => S.slot === SLOTS - 1;
const tkOpen = k => !TK[k].lock || has(TK[k].lock);
const mental = () => q("mental");
const MENT = { calm: ["😌", "평온"], anx: ["😰", "불안"], men: ["🌀", "멘헤라"] };
let sending = false;
/* 명령 보내기: 상태 갱신 → 이벤트 재생(대사·연출 끝날 때까지 기다림) */
async function send(cmd) {
  const r = SIM.apply(S, cmd);
  S = r.state;
  await playEvents(r.events);
  return r.events;
}
/* 폰처럼 화면 위에서 바로 바뀌는 명령 (재생은 기다리지 않음) */
function sendQuick(cmd) { const r = SIM.apply(S, cmd); S = r.state; playEvents(r.events); return r.events; }
function newSeed() { const qs = parseInt(QS.get("seed"), 10); return isFinite(qs) ? qs | 0 : ((Date.now() * 2654435761) ^ (performance.now() * 1e6)) | 0; }
function save() { try { if (S && !["opening", "ending"].includes(S.phase)) localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
function loadSave() { try { const t = localStorage.getItem(SAVE_KEY); if (!t) return null; const o = JSON.parse(t); return o && o.version === SIM.STATE_VERSION && o.pending ? o : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }
function clockNow() { return S && S.phase !== "title" ? (S.phase === "payday" ? "23:50" : SLOT_CLOCK[S.slot] || "09:00") : "09:00"; }
