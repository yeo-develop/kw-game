/* ================= view/panels.js — 여러 단계 행동의 화면: 판돈 UI · 카지노 · 경마 · 알바 진행 =================
   각 prompt 함수는 sim pending 을 보고 패널을 그리고(이미 열려 있으면 이어서) 다음 명령을 돌려준다.
   결과 연출은 sim 이벤트(casino·race …)를 받아 열린 패널(PNL)에 그린다. */
let PNL = null;   /* 지금 열린 패널 컨트롤러 {k, p, …} */
function closePnl() { PNL = null; hidePanel(); }

/* ---------- 판돈 UI (베팅 상한 없음 = 가진 돈까지) ---------- */
function stakeHtml() {
  return `<div class="stake"><div class="row"><span style="font-size:18px;color:var(--mute)">판돈</span><span class="amt" id="stkV">0원</span>
    <button class="btn sm" data-q="0.1" data-bot="q1">10%</button><button class="btn sm" data-q="0.5" data-bot="q5">절반</button><button class="btn sm" data-q="1" data-bot="qall">최대</button>
    <span class="lim">상한 없음 · 가진 돈까지</span></div>
    <input type="range" id="stk" min="0" max="0" step="10000" value="0">
    <div id="stkInfo" style="font-size:16px;color:var(--mute)"></div></div>`;
}
function bindStake(p, defRatio) {
  const sl = p.querySelector("#stk"), v = p.querySelector("#stkV"), info = p.querySelector("#stkInfo");
  const mx = () => Math.floor(S.cash / 10000) * 10000;
  const refresh = keep => {
    const m = mx();
    sl.max = m; sl.min = m >= 10000 ? 10000 : 0; sl.disabled = m < 10000;
    if (!keep) sl.value = clamp(Math.round(m * defRatio / 10000) * 10000, +sl.min, m);
    if (+sl.value > m) sl.value = m;
    v.textContent = won(+sl.value);
    info.textContent = m < 10000 ? "현금이 없다. 집에서 폰으로 돈 땡기거나 알바하자." : `= ${conv(+sl.value)} · 현금 ${won(S.cash)}${+sl.value >= m * 0.95 && m >= 10000 ? " · 🎰 올인 = 중독도 급상승" : ""}`;
    p.querySelectorAll("[data-q]").forEach(b => b.disabled = sl.disabled);
    p.dispatchEvent(new Event("stake"));
  };
  sl.oninput = () => refresh(true);
  p.querySelectorAll("[data-q]").forEach(b => b.onclick = e => { e.stopPropagation(); sl.value = Math.max(+sl.min, Math.floor(mx() * +b.dataset.q / 10000) * 10000); refresh(true); });
  refresh();
  return { get: () => +sl.value, lock: on => { p.querySelectorAll(".stake button, .stake input").forEach(x => x.disabled = on); if (!on) refresh(true); }, refresh };
}
function startOrLeave(p, startB, stk) {
  return new Promise(res => {
    startB.addEventListener("click", function h(e) { e.stopPropagation(); if (stk.get() >= 10000) { startB.removeEventListener("click", h); res("go"); } });
    p.querySelector("#leave").onclick = e => { e.stopPropagation(); res("leave"); };
  });
}

/* ---------- 카지노: 홀짝 · 카드 · 슬롯 · 사다리 ---------- */
const SLOT_SYM = DATA.SLOT_SYM, RK = DATA.RK, SU = DATA.SU;
const cardHtml = (r, s, hide) => hide ? `<div class="pcard back"><span>🂠</span></div>` : `<div class="pcard ${s === 1 || s === 2 ? "red" : ""}"><b>${RK[r]}</b><span>${SU[s]}</span></div>`;
const hlMult = (a, hi) => q("hlMult", a, hi);
function casinoOpen(P) {
  const kind = P.kind;
  const title = DATA.CAS_TITLE[kind];
  const sub = { oddeven: "그릇 속 구슬이 홀이냐 짝이냐. 맞히면 2배 (승률 49.5%).", card: "딜러 카드보다 다음 카드가 높을까 낮을까. 배당은 확률대로 (같은 숫자 = 판돈 반환).",
    slot: "777 = 50배 · 💎💎💎 = 8배 · 같은 그림 3개 = 4배 · 2개 = 반 돌려줌 · 📉📉📉 = 판돈 한 번 더 뜯김", ladder: "세 줄 중 하나. 당첨 칸에 닿으면 2.8배 (0.2는 김사장 수수료)." }[kind];
  let area = "", picks = "";
  if (kind === "oddeven") { area = `<div class="bowl" id="bowl"><div class="beads" id="beads"></div></div>`; picks = `<div class="seg" style="width:300px"><button data-pk="1" data-bot="odd">홀</button><button data-pk="0" data-bot="even">짝</button></div>`; }
  if (kind === "slot") area = `<div class="reels">${[0, 1, 2].map(i => `<div class="reel" id="r${i}">${SLOT_SYM[i]}</div>`).join("")}</div>`;
  if (kind === "ladder") { area = `<svg id="lad" viewBox="0 0 700 250" width="622" height="222"></svg>`; picks = `<div class="seg" style="width:360px">${["A", "B", "C"].map((c, i) => `<button data-pk="${i}" data-bot="lane${c}">${c}</button>`).join("")}</div>`; }
  if (kind === "card") { area = `<div class="cardrow"><div><small>딜러</small><div id="cA"></div></div><div class="vs">VS</div><div><small>다음 카드</small><div id="cB"></div></div></div>`; picks = `<div class="seg" style="width:420px"><button data-pk="1" data-bot="hi" id="hiB">하이</button><button data-pk="0" data-bot="lo" id="loB">로우</button></div>`; }
  const p = panel(`<h2>${title} <span class="lim2">상한 없음 · 한 테이블 최대 3판 · 크게 걸수록 중독도↑</span></h2><div class="sub" style="font-size:17px">${sub}</div>${stakeHtml()}
    <div class="gArea" style="height:232px">${area}</div>
    <div class="row" style="margin-top:12px;justify-content:space-between">${picks || "<span></span>"}<span class="row"><span class="rnd" id="rndN">1 / 3판</span><button class="btn" id="leave" data-bot="leave">나가기</button><button class="btn pri" id="gStart" data-bot="gstart">시작 (Enter)</button></span></div>
    <div class="res" id="gRes"></div><div class="gag" id="gGag"></div>`);
  p.style.top = "196px"; p.style.height = "760px"; hideDlg();
  const C = { k: "casino", kind, p, stk: bindStake(p, 0.5), segB: p.querySelectorAll("[data-pk]"), startB: p.querySelector("#gStart"), leaveB: p.querySelector("#leave"), playing: false, played: false };
  C.choice = kind === "oddeven" ? 1 : kind === "ladder" ? 1 : kind === "card" ? (P.A <= 7 ? 1 : 0) : 0;
  C.setPick = v => { C.choice = v; C.segB.forEach(b => b.classList.toggle("on", +b.dataset.pk === v)); };
  C.segB.forEach(b => b.onclick = e => { e.stopPropagation(); if (!b.disabled) C.setPick(+b.dataset.pk); });
  C.showCard = () => {
    const A = S.pending.A, As = S.pending.As;
    p.querySelector("#cA").innerHTML = cardHtml(A, As); p.querySelector("#cB").innerHTML = cardHtml(0, 0, true);
    const h = hlMult(A, 1), l = hlMult(A, 0);
    const hb = p.querySelector("#hiB"), lb = p.querySelector("#loB");
    hb.textContent = h ? `하이 ×${h}` : "하이 불가"; lb.textContent = l ? `로우 ×${l}` : "로우 불가";
    hb.disabled = !h; lb.disabled = !l;
    C.setPick(!h ? 0 : !l ? 1 : A <= 7 ? 1 : 0);
  };
  if (kind === "card") C.showCard();
  if (C.segB.length && kind !== "card") C.setPick(C.choice);
  if (kind === "ladder") drawLadder(p.querySelector("#lad"), null, C.choice);
  C.upd = () => { if (!C.playing) C.startB.disabled = C.stk.get() < 10000; };
  p.addEventListener("stake", C.upd); C.upd();
  return C;
}
async function casinoPrompt(P) {
  let C = PNL && PNL.k === "casino" ? PNL : null;
  if (!C) { setFace("smug"); C = PNL = casinoOpen(P); }
  else if (C.played) {
    /* 다음 판 준비 */
    C.playing = false; C.played = false;
    const r = P.rounds;
    C.p.querySelector("#rndN").textContent = `${r + 1} / 3판`;
    C.startB.textContent = `한 판 더 (${r + 1}/3)`; C.leaveB.textContent = "그만 (일어나기)"; C.leaveB.disabled = false;
    C.stk.lock(false); C.segB.forEach(b => b.disabled = false);
    if (C.kind === "card") C.showCard(); else if (C.kind === "ladder") drawLadder(C.p.querySelector("#lad"), null, C.choice);
    C.upd();
  }
  if (await startOrLeave(C.p, C.startB, C.stk) === "leave") return { t: "casinoLeave" };
  C.playing = true;
  const stake = C.stk.get();
  C.stk.lock(true); C.startB.disabled = true; C.leaveB.disabled = true; C.segB.forEach(b => b.disabled = true);
  return { t: "bet", stake, choice: C.choice };
}
/* sim 이벤트 casino: 한 판 결과 연출 */
async function casinoRound(e) {
  const C = PNL; if (!C || C.k !== "casino") return;
  const p = C.p, kind = e.kind;
  if (kind === "oddeven") {
    const bowl = p.querySelector("#bowl"); p.querySelector("#beads").innerHTML = ""; bowl.classList.add("shake");
    await wait(2000); bowl.classList.remove("shake");
    p.querySelector("#beads").innerHTML = "<i></i>".repeat(e.show.n);
  }
  if (kind === "card") {
    const cb = p.querySelector("#cB"); cb.classList.add("flip"); await wait(900);
    cb.innerHTML = cardHtml(e.show.B, e.show.Bs); cb.classList.remove("flip");
  }
  if (kind === "slot") {
    const reels = [0, 1, 2].map(i => p.querySelector("#r" + i));
    reels.forEach(x => x.classList.add("spin"));
    const iv = setInterval(() => reels.forEach(x => { if (x.classList.contains("spin")) x.textContent = fpick(SLOT_SYM); }), 70);
    for (let i = 0; i < 3; i++) { await wait(700 + i * 500); reels[i].classList.remove("spin"); reels[i].textContent = e.show.res[i]; }
    clearInterval(iv);
  }
  if (kind === "ladder") { drawLadder(p.querySelector("#lad"), e.show.rungs, e.choice, e.show.prize, true); await wait(3400); }
  floatTxt(sgnWon(e.net), e.net >= 0 ? "#7ee0a8" : "#ff6b7a", 430, 120);
  const R = p.querySelector("#gRes"); R.className = "res " + (e.net > 0 ? "win" : "lose"); R.textContent = `${e.txt}  ${sgnWon(e.net)}`;
  p.querySelector("#gGag").textContent = `= ${conv(e.net)} · 이번 테이블 누적 ${sgnWon(e.total)}`;
  C.played = true;
}
function drawLadder(svg, rungs, choice, prize, animate) {
  const X = [150, 350, 550], top = 34, bot = 212, lv = rungs ? rungs.length : 5, dy = (bot - top) / (lv + 1);
  let h = X.map((x, i) => `<line x1="${x}" y1="${top}" x2="${x}" y2="${bot}" stroke="#8a90a8" stroke-width="6"/><text x="${x}" y="22" font-size="22" font-weight="900" text-anchor="middle" fill="${i === choice ? "#ffd166" : "#c9cee0"}">${"ABC"[i]}</text>`).join("");
  let lane = choice, d = `M${X[lane]} ${top}`;
  if (rungs) {
    rungs.forEach((r, k) => { if (r < 0) return; const y = top + dy * (k + 1); h += `<line x1="${X[r]}" y1="${y}" x2="${X[r + 1]}" y2="${y}" stroke="#8a90a8" stroke-width="6"/>`; });
    rungs.forEach((r, k) => { const y = top + dy * (k + 1); d += ` L${X[lane]} ${y}`; if (r === lane) lane = r + 1; else if (r >= 0 && r + 1 === lane) lane = r; d += ` L${X[lane]} ${y}`; });
    d += ` L${X[lane]} ${bot}`;
    h += `<path id="lp" d="${d}" stroke="#ffd166" stroke-width="10" fill="none" stroke-linejoin="round"/>`;
    h += `<g id="prz" style="opacity:${animate ? 0 : 1};transition:opacity .3s ${FAST ? 0 : 3.1}s">` + X.map((x, i) => `<text x="${x}" y="244" font-size="24" font-weight="900" text-anchor="middle" fill="${i === prize ? "#ff4d5e" : "#6b7186"}">${i === prize ? "x2.8" : "꽝"}</text>`).join("") + `</g>`;
  } else X.forEach(x => { h += `<rect x="${x - 36}" y="${top + 20}" width="72" height="${bot - top - 40}" rx="10" fill="#1a1d29"/><text x="${x}" y="${(top + bot) / 2 + 8}" font-size="26" text-anchor="middle" fill="#6b7186">?</text><text x="${x}" y="244" font-size="24" text-anchor="middle" fill="#6b7186">?</text>`; });
  svg.innerHTML = h;
  const lp = svg.querySelector("#lp");
  if (lp && animate) { const L = lp.getTotalLength(); lp.style.strokeDasharray = L; lp.style.strokeDashoffset = L; void lp.getBoundingClientRect(); lp.style.transition = `stroke-dashoffset ${FAST ? 0 : 3.2}s linear`; lp.style.strokeDashoffset = 0; svg.querySelector("#prz").style.opacity = 1; }
  return lane;
}

/* ---------- 경마장 ---------- */
async function racePrompt(P) {
  const H = P.H;
  const cmt = o => o < 2.5 ? "인기마 · 근데 빚 있음" : o < 5 ? "무난 · 국밥 정도는 벌어 줌" : o < 12 ? "다크호스 (어두움)" : "꼴찌 전문 · 로또임";
  const p = panel(`<h2>🏇 제${P.race}경주 · 단승식 <span class="lim2">상한 없음 · 환급률 85%</span></h2>
    <div class="track" id="track">${H.map((h, i) => `<div class="lane"><span class="ln">${i + 1}</span><div class="hz" id="hz${i}"><span class="hn">${esc(h.name)}</span><span class="ho">🏇</span></div></div>`).join("")}<div class="finish"></div></div>
    <div class="horses">${H.map((h, i) => `<button class="hbtn" data-pk="${i}" data-bot="horse${i}"><b>${i + 1}. ${esc(h.name)}</b><span>×${h.odds}</span><small>${cmt(h.odds)}</small></button>`).join("")}</div>
    ${stakeHtml()}
    <div class="row" style="justify-content:space-between"><span class="res" id="gRes" style="margin:0;font-size:34px;min-height:0"></span><span class="row"><button class="btn" id="leave" data-bot="leave">안 건다</button><button class="btn pri" id="gStart" data-bot="rstart">출발! (Enter)</button></span></div>`, true);
  p.style.top = "196px"; p.style.height = "860px"; hideDlg();
  const stk = bindStake(p, 0.5);
  let choice = H.reduce((b, h, i) => h.odds < H[b].odds ? i : b, 0);
  const hb = p.querySelectorAll(".hbtn");
  const setPick = v => { choice = v; hb.forEach(b => b.classList.toggle("on", +b.dataset.pk === v)); };
  hb.forEach(b => b.onclick = e => { e.stopPropagation(); if (!b.disabled) setPick(+b.dataset.pk); }); setPick(choice);
  const startB = p.querySelector("#gStart");
  const upd = () => { startB.disabled = stk.get() < 10000; }; p.addEventListener("stake", upd); upd();
  PNL = { k: "race", p, H };
  if (await startOrLeave(p, startB, stk) === "leave") return { t: "raceLeave" };
  p.removeEventListener("stake", upd);
  const stake = stk.get(); stk.lock(true); startB.disabled = true; p.querySelector("#leave").disabled = true; hb.forEach(b => b.disabled = true);
  return { t: "raceBet", i: choice, stake };
}
/* sim 이벤트 race: 경주 연출 → 결과 → 패널 닫기 */
async function raceRun(e) {
  const C = PNL; if (!C || C.k !== "race") return;
  const p = C.p, H = C.H, win = e.win, choice = e.choice;
  const els = H.map((_, i) => p.querySelector("#hz" + i));
  if (!FAST) {
    const Tf = H.map((_, i) => i === win ? 1 : 1.03 + frnd() * 0.22), ph = H.map(() => frnd() * 6), fq = H.map(() => 3 + frnd() * 5);
    const lead = fpick(H.filter((_, i) => i !== win)).name;
    for (let f = 0; f <= 72; f++) {
      const t = f / 60;
      H.forEach((h, i) => { let x = Math.min(1, t / Tf[i]); if (x < 1) x += 0.035 * Math.sin(t * fq[i] + ph[i]) * (1 - x); els[i].style.left = (clamp(x, 0, 1) * 86) + "%"; });
      if (f === 14) bubble(`${lead} 치고 나간다!!`, 1500, "panic");
      if (f === 40) bubble(`${H[choice].name} 가즈아아아!!`, 1500, "panic");
      await wait(55);
    }
  }
  H.forEach((h, i) => { els[i].style.left = (i === win ? 86 : 50 + frnd() * 30) + "%"; els[i].classList.toggle("win", i === win); });
  /* 결승 연출: 1등 말 흔들림 + 빛남 (가볍게) */
  const wl = els[win].closest(".lane"); if (wl) wl.classList.add("winLane");
  els[win].classList.add("fin1");
  if (choice === win) els[win].classList.add("mine");
  const R = p.querySelector("#gRes"); R.className = "res " + (e.net > 0 ? "win" : "lose"); R.textContent = `1착 ${H[win].name}! ${sgnWon(e.net)}`;
  await wait(1800);
  closePnl();
}

/* ---------- 알바 (미니게임 설명 카드 → 연습판 → 실전) ---------- */
const playMg = (key, su) => key === "cafe" ? mgCafe(su) : key === "store" ? mgStore(su) : key === "mart" ? mgMart(su) : mgWare(su);
async function workPrompt(P) {
  const key = P.key;
  if (!P.setup) {
    if (mgCardOn()) {
      const first = tutOn() && !tSeen("mg-" + key);
      if (await mgCard(key, first) === "practice") return { t: "mgSetup", practice: true };
      tMark("mg-" + key);
      await countdown();
    }
    return { t: "mgSetup" };
  }
  if (P.setup.practice) {
    const ps = await playMg(key, P.setup); hidePanel(); tMark("mg-" + key);
    await mgCard(key, false, ps);
    tMark("mg-" + key);
    await countdown();
    return { t: "mgSetup" };
  }
  const score = await playMg(key, P.setup);
  hidePanel();
  return { t: "mgResult", score };
}
