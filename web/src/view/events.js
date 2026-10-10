/* ================= view/events.js — sim 이벤트 재생기 =================
   이벤트 하나씩 순서대로: e.h(그 시점 HUD 스냅샷)를 HUD 에 반영하고 연출한다. 대사(say)·모달은 끝날 때까지 기다림.
   casino·race 처럼 애니메이션이 있는 이벤트는 HUD 를 연출 뒤에 반영(돈이 결과 나올 때 바뀌게). */
const LATE_HUD = new Set(["casino", "race"]);
const WHO = { m: "미래", me: "나", kim: "김사장", nar: null };
let playing = 0;
async function playEvents(evs) {
  playing++;
  try {
    for (const e of evs) {
      if (e.h && !LATE_HUD.has(e.t)) { HS = e.h; updHud(); }
      await playOne(e);
      if (e.h && LATE_HUD.has(e.t)) { HS = e.h; updHud(); }
    }
  } finally {
    playing--;
    if (!playing) { HS = null; updHud(); if (PH.on) phR(); }
  }
}
async function playOne(e) {
  switch (e.t) {
    case "say": await say(e.who === "npc" ? e.name : WHO[e.who], e.text, e.face); return;
    case "hideDlg": hideDlg(); return;
    case "bubble": bubble(e.text, e.ms, e.face); return;
    case "face": setFace(e.f); return;
    case "scene": setScene(e.bg, { night: e.night, face: e.face, mode: e.mode }); return;
    case "npc": showNpc(e.kind, e.mood); return;
    case "kim": showKim(e.on, e.face); return;
    case "hideUi": hideSide(); closePnl(); return;
    case "tut": if (typeof tutTipNow === "function") await tutTipNow(e.k); return;
    case "fx":
      if (e.k === "ash") await fxAsh();
      else if (e.k === "flex") fxFlex(e.amt);
      else if (e.k === "crack") fxCrack(e.amt);
      else if (e.k === "big") bigFx(e.text, e.kind, e.small);
      return;
    case "aff": fxAff(e.d, e.why); return;
    case "ment": fxMent(e.m); return;
    case "cash": fxCash(e.d); return;
    case "debt": fxDebt(e.d); return;
    case "repaid": floatTxt("빚 −" + won(e.a), "#7ee0a8", 60, 120); return;
    case "augfx": augFx(e.id, e.text); return;
    case "toast": toast(e.text, e.kind, e.app, e.room); return;
    case "kakao": case "feed": case "post": if (PH.on && !playing) phR(); else updBadges(); return;
    case "tip": if (e.bubble) bubble(e.bubble, 2200, e.face); if (typeof tutQueue === "function") tutQueue("tip1"); return;
    case "tickFloat": floatTxt(e.text, "#cfd6ea", 860, 150); return;
    case "morning": await morningShow(e); return;
    case "lottoDraw": await lottoDrawShow(e); return;
    case "menhera": await menheraFx(e); return;
    case "casino": await casinoRound(e); return;
    case "race": await raceRun(e); return;
    case "scratch": scratchShow(e); return;
    case "panelEnd":
      if (e.k === "casino" && PNL && PNL.k === "casino" && PNL.played) await wait(1100);
      closePnl(); return;
    case "bought": { setFace("happy"); drawChar(); const c = $("#char"); c.classList.remove("bounce"); void c.offsetWidth; c.classList.add("bounce"); return; }
    case "outfit": drawChar(); return;
    case "opening": await runScene("opening"); return;
    case "ending": await endingShow(); return;
    case "save": save(); return;
    case "error": console.warn("[sim]", e.msg); return;
  }
}
/* 멘헤라: 카톡 탄막 */
function danmaku(t) { const d = document.createElement("div"); d.className = "dm"; d.textContent = t; d.style.top = (180 + frnd() * 600) + "px"; d.style.animationDuration = (3.6 + frnd() * 2) + "s"; $("#dan").appendChild(d); setTimeout(() => d.remove(), 6000); }
async function menheraFx(e) {
  closePnl(); hideSide(); hideMap(); hideDlg(); setChar(true, "menhera");
  { const pb = $("#phoneBtn"); if (pb) { pb.classList.remove("buzz"); void pb.offsetWidth; pb.classList.add("buzz"); } }
  for (const m of e.msgs) { danmaku(m); await wait(170); }
}
/* 장면 스크립트 실행기 (data/scenes.json) */
async function runScene(id) {
  for (const s of DATA.SCENES[id]) {
    if (s.say) { await say(WHO[s.say], s.text, s.face); continue; }
    switch (s.do) {
      case "scene": setScene(s.bg, { face: s.face }); break;
      case "shake": { const mn = $("#main"); mn.classList.remove("shake"); void mn.offsetWidth; mn.classList.add("shake"); break; }
      case "face": setFace(s.f); break;
      case "kim": showKim(s.on); break;
      case "hideDlg": hideDlg(); break;
      case "rules": await modal({ title: "📜 빚 3천 갚기 (규칙은 짧게)", body: `<div class="rules">${RULES_HTML}</div>`, acts: [{ l: "ㅇㅋ 갚는다 (Enter)", pri: 1, k: "rulesOk" }] }); break;
    }
  }
}
const RULES_HTML = DATA.RULES_TEXT.map(x => `<div>${x}</div>`).join("");
