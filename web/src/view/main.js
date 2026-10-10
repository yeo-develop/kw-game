/* ================= view/main.js — 메인 루프: sim pending 을 보고 화면(prompt)을 띄워 명령을 받아 보낸다 =================
   loop: [이벤트 재생] → prompt(pending) → 명령 → SIM.apply → 이벤트 … (pending 이 ending 이면 끝) */
const GREET = DATA.GREET;

async function homePrompt() {
  setScene("room", { night: isEve(), face: q("moodFace"), mode: "home" });
  idle("미래", S.hl ? S.hl.t : "", q("moodFace"));
  const ku = q("kUnread"), pl = q("hasPos") ? q("unreal") : null;
  const kp = sideMenu({ title: `🏠 집 <small>${SLOT_IC[S.slot]} ${SLOT_NAME[S.slot]} ${SLOT_CLOCK[S.slot]}</small>`, opts: [
    { k: "h-phone", ic: "📱", l: "폰 보기 (P)", sub: `카톡·주갤·증권·뉴스 · 칸 안 씀${ku ? ` · 💬${ku}` : ""}${pl != null ? ` · ${sgnMan(pl)}` : ""}`, cls: "wide hot" },
    { k: "h-map", ic: "🗺️", l: "지도 (나가기)", sub: `장소+행동 1번 = 1칸${S.hp < RU.HP_LOW ? " · 😵 체력 부족" : ""}` },
    { k: "h-rest", ic: "🛏️", l: isEve() ? "일찍 자기" : "집에서 쉬기", sub: `1칸 · 멘탈 회복 · 체력 +${isEve() ? RU.HP_REST_EVE : RU.HP_REST}${isEve() ? " (+밤잠 " + RU.HP_SLEEP + ")" : ""}`, cls: S.hp < RU.HP_LOW ? "hot" : "" },
    { k: "h-loan", ic: "💸", l: "돈 땡기기", sub: `사채 · 남은 한도 ${man(Math.max(0, q("loanCap") - S.debt))}` },
    { k: "h-etc", ic: "⋯", l: "기타", sub: "유품 목록 · 규칙 · 기록" },
  ] });
  tutHook("home");
  const k = await kp;
  hideSide();
  if (k === "h-rest") return { t: "rest" };
  if (k === "h-map") return { t: "map" };
  if (k === "h-phone") { await openPhone("home"); return null; }
  if (k === "h-loan") return { t: "loanOpen" };
  if (k === "h-etc") { await etcMenu(); return null; }
  return null;   /* __refresh */
}
async function etcMenu() {
  const v = await modal({ title: "⋯ 기타", wide: 1, body: `<h3 class="mh">🎁 챙긴 유품 · 수상한 물건</h3>${S.augs.length ? S.augs.map(id => { const a = AUG[id]; return `<div class="augli t${a.tier}"><span>${a.ic}</span><b>${esc(a.name)}</b><small>[${TIER[a.tier]} · ${a.cat}]</small> ${esc(a.d)}</div>`; }).join("") : "없음"}${recHtml()}
    <h3 class="mh">📜 규칙 요약</h3><div class="rules small">${RULES_HTML}</div>`, acts: [{ l: "타이틀로", v: "title", k: "etc-title" }, { l: "닫기 (Enter)", pri: 1, k: "etc-close" }] });
  if (v === "title") location.href = location.pathname + location.search;
}
async function mapPrompt() {
  setScene("map", { char: false, mode: "map" });
  idle("미래", fpick(["어디 갈까? 가서 뭐 하나 하면 한 칸 지나감.", "카지노? 카지노지? …아 알바? ㅅㅂ", "자기야 오늘 경마 배당 좋대 (출처: 갤)"]), "neutral");
  const mp = $("#map");
  const all = [["home", { name: "집", ic: "🏠", pos: [720, 540], open: SLOT_NAME.map((_, i) => i), hint: "돌아가기 · 칸 소모 없음" }]].concat(LOC_KEYS.map(k => [k, LOCS[k]]));
  mp.innerHTML = all.map(([k, L], i) => { const op = L.open.includes(S.slot); return `<button class="loc ${k === "home" ? "home" : ""}" data-pick="${i}" data-bot="m-${k}" ${op ? "" : "disabled"} style="left:${L.pos[0] + 120}px;top:${L.pos[1] - 66}px"><span class="k">${i + 1}</span><span class="ic">${L.ic}</span><b>${L.name}</b><small>${op ? L.hint : "영업 끝 · " + L.open.map(x => SLOT_NAME[x]).join("/") + "만"}</small></button>`; }).join("");
  mp.classList.add("on"); curLoc = "";
  tutHook("map");
  const k = await new Promise(res => { mapRes = res; mp.querySelectorAll(".loc").forEach(b => b.onclick = e => { e.stopPropagation(); if (!b.disabled) res(b.dataset.bot.slice(2)); }); });
  mapRes = null;
  if (k === "__refresh") return null;
  hideMap();
  return { t: "goTo", loc: k };
}
let mapRes = null, lastGreet = "";
async function locPrompt(P) {
  const key = P.key, L = LOCS[key];
  setScene(L.bg, { face: q("moodFace"), mode: "loc" }); showNpc(L.npc);
  const gk = `${Tnow()}:${key}`;   /* 같은 방문에서 다시 그릴 땐 인사 대신 "또 뭐" (v3.2 와 같음) */
  idle(NPCS[L.npc].name, P.first && gk !== lastGreet ? fpick(GREET[key]) : "또 뭐 하실래요?"); lastGreet = gk;
  const used = S.visit && S.visit.used;
  const opts = q("locOpts", key).concat([{ k: "l-leave", ic: "🚪", l: used ? "볼일 끝 (집으로)" : "나가기 (지도로)", sub: used ? "1칸 사용됨" : "칸 소모 없음", cls: "leave" }]);
  curLoc = key;
  const cp = sideMenu({ title: `${L.ic} ${L.name}`, sub: `${L.hint} · ${S.month}개월차 ${S.day}일 ${SLOT_NAME[S.slot]}`, opts });
  tutHook("loc", key);
  const c = await cp;
  if (c === "__refresh") return null;
  if (c === "l-leave") return { t: "leave" };
  hideSide(); hideDlg();
  return { t: "act", k: c };
}
async function choosePrompt(opts, hook) {
  const cpr = choose(opts.map(o => ({ k: o.k, l: o.l, sub: o.sub, dis: o.dis }))); if (hook) tutHook(hook); return cpr;
}
/* pending → 화면 → 명령 (null 이면 화면만 다시) */
async function prompt(P) {
  switch (P.t) {
    case "home": return homePrompt();
    case "map": return mapPrompt();
    case "loc": return locPrompt(P);
    case "relic": return augPrompt(P);
    case "relicShop": return relicShopPrompt(P);
    case "tempt": { const c = await choosePrompt(P.opts, "tempt"); return { t: "tempt", k: c.k }; }
    case "impulse": { const c = await choosePrompt(P.opts, "impulse"); return { t: "reply", i: P.opts.findIndex(o => o.k === c.k) }; }
    case "loan": return loanPrompt(P);
    case "encounter": { const c = await choosePrompt(P.opts); return { t: "encounter", ask: c.k === "enc-ask" }; }
    case "menhera": { const c = await choosePrompt(P.opts, "menhera"); return { t: "reply", i: P.opts.findIndex(o => o.k === c.k) }; }
    case "payday": { const c = await choosePrompt(P.opts, P.stage === "choose" ? "payday" : null); return { t: "payday", k: c.k }; }
    case "work": return workPrompt(P);
    case "casino": return casinoPrompt(P);
    case "race": return racePrompt(P);
    case "scratch": return scratchPrompt(P);
    case "lotto": return lottoPrompt(P);
    case "repay": return repayPrompt(P);
    case "shop": return shopPrompt(P);
    case "brokerTrade": { await openPhone("stock", "broker"); return { t: "brokerClose" }; }
  }
  console.warn("unknown pending", P.t);
  return null;
}
let endChoice = null;
async function mainLoop(first) {
  if (first) await send(first);
  for (; ;) {
    const P = S.pending;
    if (!P) return;
    if (P.t === "ending") {
      if (!P.cont) return;
      /* 정식 엔딩: 화면에서 '계속하기' 고르면 자유 모드로 이어 감 */
      const v = await new Promise(r => { endChoice = r; });
      endChoice = null;
      if (v !== "cont") return;
      $("#full").classList.remove("on"); $("#full").innerHTML = "";
      await send({ t: "continue" });
      toast("🎉 빚 없는 자유 모드 — 꾸미기·투자·갤 명성 마음대로 (이자일 없음)", "good", null);
      continue;
    }
    updHud();
    const c = await prompt(P);
    if (c) await send(c);
  }
}

/* ================= 엔딩 (스코어보드 · 정식 엔딩 컷신 → 계속하기) ================= */
const pctOf = (w, n) => n ? Math.round(w / n * 100) + "%" : "-";
function sbHtml(sb, E) {
  const cells = [
    ["엔딩", `${E.h}`], ["버틴 날", `${sb.days}일 (${sb.month}개월차 ${sb.day}일)`], ["총 수익 (투자 실현+평가)", sgnWon(sb.profit)], ["최대 자산", won(sb.maxAsset)],
    ["갚은 빚", won(sb.repaid)], ["남은 빚", won(sb.debt)], ["알바 수입", won(sb.earned)], ["도박 순손익", sgnWon(sb.gnet)],
    ["도박 승률", `${pctOf(sb.gW, sb.gN)} (${sb.gW}/${sb.gN})`], ["투자 승률", `${pctOf(sb.iW, sb.iN)} (${sb.iW}/${sb.iN})`], ["청산", `${sb.liq}회`], ["갤 명성", `${sb.fame} · ${sb.rank}`],
    ["낸 이자", won(sb.interest)], ["도박 중독도", `${sb.addict}`], ["기절", `${sb.faint}회`], ["돌발 매수", `${sb.impulse}회`],
  ];
  return `<div class="sboard">${cells.map(([a, b]) => `<div><small>${a}</small><b>${esc(b)}</b></div>`).join("")}</div>`;
}
async function endingShow() {
  const E = S.endInfo; if (!E) return;
  if (PH.on) closePhone(true); if (coachRun) coachRun.skip(); hideDlg(); closePnl(); hideSide(); hideMap(); $("#modal").classList.remove("on"); $("#modal").innerHTML = ""; modalOpen = false; $("#choices").innerHTML = ""; chooseWait = null; keyHook = null; $("#augPick").classList.remove("on");
  HS = null;
  if (E.kind === "clear") { updHud(); await runScene("clear"); }
  clearSave(); updHud();
  const rec = recSave(E.kind, E.sb);
  const f = $("#full"); f.classList.add("on");
  f.innerHTML = `<div class="end end-${E.kind}"><div class="art">${bgSVG(E.bg, { props: S.props, night: E.night })}</div>
    ${E.noChar ? "" : `<div class="echar">${miraeSVG(E.face, S.outfit)}</div>`}
    <div class="card2"><span class="tag ${E.ok ? "ok" : ""}">${E.tag}</span><h1>${esc(E.h)}</h1>
      <div class="lead">${esc(E.lead)}</div>
      <h3 class="sbh">📊 스코어보드</h3>${sbHtml(E.sb, E)}
      <div class="eaug">🎁 ${S.augs.length ? S.augs.map(x => AUG[x].ic + " " + AUG[x].name).join(" · ") : "유품 없음"} · 시드 ${S.seed} · 엔딩 기록 ${["clear", "bad1", "bad2"].map(k => rec.seen[k] ? "✅" : "⬜").join("")}</div>
      <div class="row">${E.cont ? `<button class="btn pri" id="contE" data-bot="cont">계속하기 — 빚 없는 자유 모드 (Enter)</button><button class="btn" id="again" data-bot="again">새 게임</button>` : `<button class="btn pri" id="again" data-bot="again">새 게임 (Enter)</button>`}</div>
      <div class="disc">※ 이 게임은 도박·투자 권유가 아닙니다. 종목·코인·차트는 전부 가상(합성)이고 등장인물·업체·커뮤니티도 가상입니다.<br>현실의 사채·도박·고배율 선물은 진짜로 원양어선입니다.</div></div></div>`;
  $("#again").onclick = e => { e.stopPropagation(); clearSave(); location.href = location.pathname + location.search; };
  if ($("#contE")) $("#contE").onclick = e => { e.stopPropagation(); if (endChoice) endChoice("cont"); };
}

/* ================= 타이틀 ================= */
function showTitle() {
  const f = $("#full"); f.classList.add("on");
  const sv = loadSave();
  f.innerHTML = `<div class="title"><div class="ticker"><span>[속보] 주식갤 고닉 「롱잡고알바감」 빚 3천 고백 ▲ 김사장 캐피탈 금리 동결 (월 5%) ▲ 빚트코인 오늘도 위아래로 흔듦 ▲ 멍멍코인 개가 짖음 ▲ 원양어선 선원 상시 모집 ▲ 형 나 믿지? ▲ 이 게임은 도박·투자 권유가 아닙니다 ▲</span></div>
    <div class="tchar">${miraeSVG("smug")}</div><div class="stamp">빚 3,000만</div>
    <div class="tx"><h1>롱잡고알바감</h1><div class="tg">~빚 3천 갚기 전엔 못 헤어져~</div>
    <div class="tg2">여친이 100일 기념으로 빚을 고백했다. 사채업자가 문을 두드린다.<br>하루 3칸, 한 달 7일. 알바냐, 경마냐, 50배냐. 체력 아끼고, 부모님 유품 챙기고, 빚 0원 만들어라.</div>
    <div class="acts"><button class="btn pri" id="newG" data-bot="newG" style="font-size:30px;padding:18px 44px">새 게임 (Enter)</button>${sv && sv.phase !== "ending" ? `<button class="btn" id="contG" data-bot="contG" style="font-size:26px">이어하기 · ${sv.month}개월차 ${sv.day}일 ${SLOT_NAME[sv.slot] || ""}</button>` : ""}</div></div>
    <div class="note">❓ 처음이면 새 게임 → 첫날 튜토리얼이 따라옴 (메뉴에서 끄기 가능) · 컨셉 프로토타입 v3.3 · 30~60분 (하루 3칸 · 한 달 7일 · 시간 제한 없음 · 엔딩 3종) · 클릭/Space/Enter = 진행 · 숫자키 = 선택 · P = 폰 · D = 디버그<br>이 게임은 도박·투자 권유가 아닙니다. 종목·코인은 전부 가상 · 등장인물·업체도 가상입니다.</div></div>`;
  $("#newG").onclick = e => { e.stopPropagation(); clearSave(); f.classList.remove("on"); f.innerHTML = ""; newGame(); };
  if ($("#contG")) $("#contG").onclick = e => { e.stopPropagation(); f.classList.remove("on"); f.innerHTML = ""; resume(sv); };
}
function newGame() {
  const seed = newSeed();
  S = SIM.createGame(seed, { tut: tutOn(), rngv: QS.get("rng") === "v1" ? 1 : 2 });   /* ?rng=v1 = v3.2 호환 난수 (회귀 비교용) */
  fxSeed = seed ^ 0x2545F491;
  updHud();
  mainLoop({ t: "start" });
}
function resume(sv) {
  S = sv; fxSeed = (S.seed ^ S.rng) | 0;
  updHud();
  SIM.apply(S, { t: "read" });
  mainLoop(null);
}

/* ================= 입력 ================= */
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("button"); if (b) b.blur(); }, true);
$("#main").addEventListener("click", e => { if (e.target.closest("button,#panel,#screen,input,#side,#map,#hud,#toast")) return; advance(); });
document.addEventListener("keydown", e => {
  const qs = s => document.querySelector(s), go = e.key === " " || e.key === "Enter", num = /^[0-9]$/.test(e.key) ? +e.key - 1 : -1;
  if (e.key === "d" || e.key === "D") { dbgOn = !dbgOn; updDebug(); return; }
  if (e.repeat && go) { e.preventDefault(); return; }
  if (go || /^[0-9]$/.test(e.key)) e.preventDefault();
  if (coachRun) {
    if (e.key === "Escape") { coachRun.skip(); e.preventDefault(); return; }
    if (go && !$("#coach").dataset.target) { e.preventDefault(); coachRun.next(); return; }
    if (!$("#coach").dataset.target) { e.preventDefault(); return; }   // 설명 단계: 다른 키 막음 · 행동 단계: 통과
  }
  if ((e.key === "h" || e.key === "H") && !keyHook) { helpNow(); return; }
  if ((e.key === "m" || e.key === "M") && !keyHook && !modalOpen && $("#menuBtn")) { $("#menuBtn").click(); return; }
  if ((e.key === "p" || e.key === "P") && !keyHook) { togglePhone(); return; }
  if (qs("#augPick.on")) { if (num >= 0) { const c = qs(`#augPick [data-pick="${num}"]`); if (c) c.click(); } return; }
  if (qs("#modal.on")) { if (go) { const b = qs("#modal .btn.pri") || qs("#modal .btn"); if (b) b.click(); } return; }
  if (PH.on) { if (e.key === "d" || e.key === "D") return; phoneKey(e); e.preventDefault(); return; }
  if (keyHook && keyHook(e)) return;
  if (qs("#full.on")) { if (go) { const b = qs("#full #contE") || qs("#full #again") || qs("#full #newG"); if (b) b.click(); } return; }
  if (chooseWait && !modalOpen) { if (num >= 0) chooseWait(num); return; }
  if (qs("#screen.on")) { if (go) { const b = qs("#screen .btn.pri"); if (b) b.click(); } return; }
  if (qs("#panel.on")) {
    if (num >= 0) { const c = qs(`#panel [data-pick="${num}"]`); if (c && !c.disabled) c.click(); return; }
    if (go) { const b = [...document.querySelectorAll("#panel .btn.pri")].find(x => !x.disabled); if (b) b.click(); }
    return;
  }
  if (go && (advWait || typing)) { advance(); return; }
  if (qs("#map.on")) { if (num >= 0) { const c = qs(`#map [data-pick="${num}"]`); if (c && !c.disabled) c.click(); } return; }
  if (qs("#side.on")) { if (num >= 0) { const c = qs(`#side [data-pick="${num}"]`); if (c && !c.disabled) c.click(); } return; }
  if (go) advance();
});
$("#helpBtn").onclick = e => { e.stopPropagation(); helpNow(); };
fit();
/* 자동 테스트(Playwright 봇)용 창구 — v3.2 와 같은 이름 */
window.__G = { get S() { return S; }, isEve, q, waiting: () => !!advWait || !!typing, TK, has, holdVal: () => q("holdVal"), interestDue: () => q("interestDue"), loanCap: () => q("loanCap"), Tnow, stockOpen, cpnl: c => q("cpnl", c), PH, phoneOk, unreal, GN, rec, get coach() { return !!coachRun; }, SIM };
showTitle();
