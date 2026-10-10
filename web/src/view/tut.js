/* ================= view/tut.js — 튜토리얼 코치마크 · 도움말 · 미니게임 설명 카드 (v3.2 그대로)
   데이터(TUT_FLOW·TIPS·GLOSS·MGHOW)는 data/tutorial.json. 진행 단계(S.tg)는 sim 상태 → guide 명령으로 바꾼다. */
const TUT_FLOW = DATA.TUT_FLOW, TUT_SEGS = DATA.TUT_SEGS, TIPS = DATA.TIPS, GLOSS = DATA.GLOSS, MGHOW = DATA.MGHOW;
/* ================= 설정 (localStorage, try/catch) ================= */
const TUT_KEY = "longjab_tut";
let TUTS = { off: false, seen: {} };
try { const o = JSON.parse(localStorage.getItem(TUT_KEY) || "null"); if (o) TUTS = Object.assign(TUTS, o); } catch (e) { }
function tutSave() { try { localStorage.setItem(TUT_KEY, JSON.stringify(TUTS)); } catch (e) { } }
function tutOn() { const q = QS.get("tut"); if (q === "0") return false; if (q === "1") return true; return !FAST && !TUTS.off; }
const mgCardOn = () => !FAST || QS.get("tut") === "1";
const tSeen = k => !!((S && S.tutSeen && S.tutSeen[k]) || TUTS.seen[k]);
function tMark(k) { TUTS.seen[k] = 1; tutSave(); if (S) SIM.apply(S, { t: "tutSeen", k }); }

/* ================= 코치마크 (view) ================= */
let coachRun = null;
const COND = {
  btn: () => false, map: () => !!$("#map.on"), loc: () => !!$("#side.on") && $("#main").dataset.mode === "loc", panel: () => !!$("#panel.on"), picked: () => !$("#side.on"),
  phone: () => PH.on, "app:stock": () => PH.on && PH.app === "stock", "app:gall": () => PH.on && PH.app === "gall", "tab:detail": () => PH.on && PH.app === "stock" && PH.stab === "detail",
  trade: () => S.st.invest > (coachRun ? coachRun.inv0 : 0),
};
const SKIPC = { stockClosed: () => !stockOpen() };
function stageBox(el) { const sr = $("#stage").getBoundingClientRect(), s = sr.width / 1920, r = el.getBoundingClientRect(); return { x: (r.left - sr.left) / s, y: (r.top - sr.top) / s, w: r.width / s, h: r.height / s }; }
function coach(steps, opt = {}) {
  return new Promise(res => {
    const el = $("#coach"); let i = 0, poll = null;
    const finish = v => { clearInterval(poll); el.className = ""; el.innerHTML = ""; coachRun = null; res(v); };
    const show = () => {
      clearInterval(poll);
      while (i < steps.length && steps[i].skip && SKIPC[steps[i].skip] && SKIPC[steps[i].skip]()) i++;
      if (i >= steps.length) return finish("done");
      const st = steps[i], tg = st.target ? [...document.querySelectorAll(st.target)].find(e => e.offsetParent !== null || e.id === "phoneOv") : null;
      if (st.target && !tg) { if (st.next === "btn") { i++; return show(); } }
      const act = st.next && st.next !== "btn";
      coachRun.inv0 = coachRun.inv0 == null ? S && S.st.invest : coachRun.inv0;
      const b = tg ? stageBox(tg) : null, pad = 10;
      const hole = b ? { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 } : null;
      let bx = 660, by = 380;
      if (hole && hole.h > 420) {   // 키 큰 대상: 옆에, 옆자리 없으면 대상 안쪽 아래
        by = clamp(hole.y + 20, 20, 700);
        if (hole.x > 700) bx = hole.x - 690; else if (hole.x + hole.w + 700 < 1920) bx = hole.x + hole.w + 20; else { bx = clamp(hole.x + hole.w - 700, 20, 1220); by = clamp(hole.y + hole.h - 330, 20, 740); }
      }
      else if (hole) { by = hole.y + hole.h + 24 > 760 ? Math.max(20, hole.y - 290) : hole.y + hole.h + 24; bx = clamp(hole.x + hole.w / 2 - 330, 20, 1920 - 680); }
      const blk = hole ? [[0, 0, 1920, hole.y], [0, hole.y + hole.h, 1920, 1080 - hole.y - hole.h], [0, hole.y, hole.x, hole.h], [hole.x + hole.w, hole.y, 1920 - hole.x - hole.w, hole.h]].concat(act ? [] : [[hole.x, hole.y, hole.w, hole.h]]) : [[0, 0, 1920, 1080]];
      el.className = "on" + (hole ? "" : " full");
      el.innerHTML = blk.map(([x, y, w, h]) => `<div class="cblk" style="left:${x}px;top:${y}px;width:${Math.max(0, w)}px;height:${Math.max(0, h)}px"></div>`).join("")
        + (hole ? `<div class="chole ${act ? "act" : ""}" style="left:${hole.x}px;top:${hole.y}px;width:${hole.w}px;height:${hole.h}px"></div>` : "")
        + `<div class="cbub" style="left:${bx}px;top:${by}px"><div class="cav">${miraeSVG(act ? "happy" : "smug", S ? S.outfit : "hoodie", true)}</div><div class="ctx"><b>${esc(opt.title || "미래 튜터")} <small>${steps.length > 1 ? `${i + 1}/${steps.length}` : ""}</small></b>
          <p>${esc(st.text).replace(/\n/g, "<br>")}</p><div class="cbt">${opt.list ? `<button data-c="list" data-bot="c-list">📚 도움말 목록</button>` : ""}<button data-c="skip" data-bot="c-skip">${steps.length > 1 ? "건너뛰기" : "닫기"} <kbd>Esc</kbd></button>${act ? `<button data-c="next" data-bot="c-pass">이 단계 넘기기</button>` : `<button class="pri" data-c="next" data-bot="c-next">${i + 1 < steps.length ? "다음" : "알겠음"} <kbd>Enter</kbd></button>`}</div></div></div>`;
      el.dataset.target = act ? st.target : "";
      el.querySelectorAll("[data-c]").forEach(bt => bt.onclick = e => { e.stopPropagation(); const c = bt.dataset.c; if (c === "next") { i++; show(); } else if (c === "skip") finish("skip"); else { finish("list"); helpList(); } });
      if (act) { const cond = COND[st.next]; poll = setInterval(() => { if (cond && cond()) { i++; setTimeout(show, FAST ? 0 : 250); clearInterval(poll); } }, 120); }
    };
    coachRun = { next: () => { const st = steps[i]; if (!st || (st.next && st.next !== "btn")) return; i++; show(); }, skip: () => finish("skip"), inv0: null };
    show();
  });
}
/* 첫날 가이드: 구간(seg)별로 이어 감 */
async function runSeg(seg) {
  const steps = TUT_FLOW.filter(s => s.seg === seg);
  const r = await coach(steps);   // S.tg는 구간이 끝날 때까지 유지 (그동안 길거리 이벤트·다른 팁 보류)
  if (r === "skip") { SIM.apply(S, { t: "guide", seg: "" }); toast("튜토리얼 건너뜀 · 언제든 ❓(H) → 도움말", "", null); return; }
  const nx = TUT_SEGS[TUT_SEGS.indexOf(seg) + 1] || "";
  SIM.apply(S, { t: "guide", seg: nx });
  ({ home: ["home"], map: ["map"], loc: ["loc-work"], phone: ["ph-home", "ph-stock", "ph-gall"] }[seg] || []).forEach(tMark);
  if (seg === "phone") { tMark("ph-news"); toast("🎓 튜토리얼 끝! 모르면 ❓(H)", "good", null); }
  setTimeout(() => tutHook(PH.on ? "phone" : $("#map.on") ? "map" : $("#main").dataset.mode === "loc" && $("#side.on") ? "loc" : $("#side.on") ? "home" : "", curLoc), FAST ? 0 : 60);
}
const SEG_CTX = { home: "home", map: "map", loc: "loc", home2: "home", phone: "phone" };
const tutPend = [];
function tutQueue(k) { if (!tutOn() || tSeen(k) || tutPend.includes(k)) return; tutPend.push(k); }
function ctxKey(ctx, arg) {
  if (ctx === "phone") { if (PH.app === "stock" && PH.stab === "detail" && PH.sel && TK[PH.sel].type === "coin") return "coin"; if (PH.app === "news" && PH.ntab === "book") return "book"; return "ph-" + PH.app; }
  if (ctx === "loc") return "loc-" + arg;
  return ctx;
}
function tutHook(ctx, arg) {
  if (!S || !tutOn() || coachRun) return;
  const seg = S.tg;
  if (seg && SEG_CTX[seg] === ctx && (seg !== "home2" || Tnow() > (S.tgT || 0)) && (seg !== "loc" || arg === "work") && (seg !== "phone" || PH.app === "home")) { runSeg(seg); return; }
  if (seg) return;   // 가이드 진행 중엔 다른 팁 보류
  const k = tutPend.find(x => !tSeen(x)); if (k && ["home", "phone", "loc"].includes(ctx)) { tutPend.splice(tutPend.indexOf(k), 1); showTip(k); return; }
  const key = ctxKey(ctx, arg); if (TIPS[key] && !tSeen(key)) showTip(key);
}
async function tutTipNow(k) { if (!S || !tutOn() || coachRun || tSeen(k) || S.tg) return; await showTip(k); }
function showTip(k, force) {
  const T = TIPS[k]; if (!T) return Promise.resolve();
  if (!force) tMark(k);
  return coach([{ target: T.s, text: T.x, next: "btn" }], { title: T.t, list: force });
}
/* ❓ 도움말 (H): 지금 화면 설명 */
function helpCtx() {
  if (!S || $("#full.on")) return "title";
  if ($("#augPick.on")) return "aug";
  if (PH.on) return ctxKey("phone");
  if ($("#panel.on")) return "panel";
  if ($("#choices button")) return S.phase === "payday" ? "payday" : "menhera";
  if ($("#map.on")) return "map";
  if ($("#main").dataset.mode === "loc" && curLoc) return "loc-" + curLoc;
  return "home";
}
let curLoc = "";
function helpNow() { if (coachRun) { coachRun.skip(); return; } if (modalOpen) return; showTip(helpCtx(), true); }
function helpList() {
  if (modalOpen) return;
  const tips = Object.values(TIPS).map(T => `<div class="hl"><b>${T.t}</b><span>${esc(T.x).replace(/\n/g, "<br>")}</span></div>`).join("");
  const gl = GLOSS.map(([a, b]) => `<div class="hg"><b>${a}</b><span>${esc(b)}</span></div>`).join("");
  modal({ title: "📚 도움말 목록 · 용어집", wide: 1, body: `<div class="hlist"><h3 class="mh">화면별 설명</h3>${tips}<h3 class="mh">병맛 용어집</h3><div class="hgl">${gl}</div>
    <h3 class="mh">조작</h3><div class="hl"><b>⌨️ 키</b><span>클릭/Space/Enter = 넘기기·확인 · 숫자키 = 선택 · P = 폰 · H = 도움말 · M = 메뉴 · Esc = 닫기 · D = 디버그</span></div></div>`, acts: [{ l: "닫기 (Enter)", pri: 1, k: "help-close" }] });
}
/* 설정 (메뉴 안) */
async function tutSettings() {
  const v = await modal({ title: "⚙️ 튜토리얼 설정", body: `튜토리얼·첫 방문 팁: <b>${TUTS.off ? "꺼짐" : "켜짐"}</b>${FAST ? "<br><small>(?fast=1 모드에선 자동으로 꺼짐)</small>" : ""}`, acts: [{ l: TUTS.off ? "켜기" : "끄기", v: "tog", k: "tut-toggle" }, { l: "다시 보기 (팁 초기화)", v: "reset", k: "tut-reset" }, { l: "📚 도움말 목록", v: "list", k: "tut-list" }, { l: "닫기", pri: 1 }] });
  if (v === "tog") { TUTS.off = !TUTS.off; tutSave(); toast(`튜토리얼 ${TUTS.off ? "끔" : "켬"}`, "", null); }
  if (v === "reset") { TUTS.seen = {}; TUTS.off = false; tutSave(); if (S) SIM.apply(S, { t: "guide", seg: "home", reset: true }); toast("튜토리얼 다시 보기 켬 · 다음 화면부터", "good", null); }
  if (v === "list") helpList();
}
/* ================= 미니게임 설명 카드 + 3-2-1 (view) ================= */
function mgCard(key, practice, after) {
  const H = MGHOW[key];
  return new Promise(res => {
    const p = panel(`<div class="mgc"><h2>${H.t}${after != null ? ` <small class="tag2">연습 결과 ${Math.round(after * 100)}%</small>` : ""}</h2>
      <div class="mgs">${H.steps.map((s, i) => `<div class="mgst" style="animation-delay:${i * 0.5}s"><i>${i + 1}</i><span>${esc(s)}</span></div>`).join("")}</div>
      <div class="mgdemo d-${key}"><span class="dm1"></span><span class="dm2"></span><span class="dm3"></span></div>
      <div class="mgk">${H.keys.map(([k, l]) => `<span><kbd>${k}</kbd> ${l}</span>`).join("")}</div>
      <div class="mgn">${after != null ? `연습 끝! 실전이었으면 일당 ${Math.round(after * 100)}% 만큼. 이제 진짜 ㄱ` : practice ? "처음이면 연습판 추천 (돈 안 받음 · 칸은 실전 때만)" : "타이머는 시작 누르고 3-2-1 뒤에 시작"}</div>
      <div class="row" style="justify-content:flex-end;gap:14px">${practice ? `<button class="btn" data-bot="mg-practice" id="mgPr">연습판 먼저 <kbd>R</kbd></button>` : ""}<button class="btn pri" data-bot="mg-start" id="mgGo">시작 <kbd>Enter</kbd></button></div></div>`);
    hideDlg();
    const done = v => { keyHook = null; res(v); };
    p.querySelector("#mgGo").onclick = e => { e.stopPropagation(); done("start"); };
    if (practice) p.querySelector("#mgPr").onclick = e => { e.stopPropagation(); done("practice"); };
    keyHook = e => { if (e.key === "Enter" || e.key === " ") { done("start"); return true; } if (practice && (e.key === "r" || e.key === "R")) { done("practice"); return true; } return true; };
  });
}
async function countdown() {
  const p = $("#panel"); const c = document.createElement("div"); c.className = "cdown"; p.appendChild(c);
  for (const n of ["3", "2", "1", "시작!"]) { c.textContent = n; c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop"); await wait(560); }
  c.remove();
}
