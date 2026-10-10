/* ================= view/minigames.js — 알바 미니게임 3종 (입력·연출만, 0~1 점수를 sim 에 넘김)
   판 구성 난수(주문·바코드 구간·깨지기 쉬움 시점)는 sim 의 mgSetup 이 미리 굴려 setup 으로 준다.
   ?mg=1 : 자동 테스트용 고정 점수 (0.60~0.80 순환) — 구 빌드(v3.2) 비교용 훅과 같은 수열 */
const MGM = QS.get("mg"); let mgK = 0;
const mgMock = () => { const k = mgK++; return 0.6 + ((k * 37) % 21) / 100; };
const D = ms => FAST ? Math.max(60, ms * 0.06) : ms;
function timerBar(p, ms) {
  const bar = p.querySelector(".timer i"); const t0 = performance.now();
  return () => { const r = clamp(1 - (performance.now() - t0) / ms, 0, 1); if (bar) bar.style.width = (r * 100) + "%"; return r; };
}
async function mgCafe(su) {
  if (MGM) return mgMock();
  const DR = [["아아", "🧊"], ["라떼", "🥛"], ["바닐라", "🍦"], ["녹차", "🍵"], ["딸바", "🍓"]];
  const NO = 3, SEC = Math.round(12000 / su.H), PEEK = Math.round(3500 / su.H);
  const orders = su.orders;   /* 주문은 sim 이 미리 굴림 (게임 난수) */
  const p = panel(`<h2>☕ 주문 맞추기</h2><div class="sub">주문표대로 담고 <b>서빙</b>. 숫자키 1~5 = 음료, Enter = 서빙, 0 = 비우기. ${(SEC / 1000).toFixed(1)}초에 주문 ${NO}개. 손님은 주문을 ${(PEEK / 1000).toFixed(1)}초만 보여 주고 폰 봄 → 까먹으면 <b>R = 다시 말해 주세요</b> (주문당 1번). 틀리면 그 주문 날아감.</div>
    <div class="timer"><i></i></div><div class="order" id="ord"></div><div class="tray" id="tray"></div>
    <div class="drinks">${DR.map((d, i) => `<button data-d="${i}" data-bot="d${i}"><span>${d[1]}</span>${i + 1}. ${d[0]}</button>`).join("")}</div>
    <div class="row" style="margin-top:14px;justify-content:space-between"><span class="row"><button class="btn" id="clr" data-bot="clr">0. 비우기</button><button class="btn" id="cafeR" data-bot="cafe-r">R. 다시 말해 주세요</button></span><span id="cafeMsg" style="font-size:22px;color:var(--gold)"></span><button class="btn pri" id="serve" data-bot="serve">서빙 (Enter)</button></div>`);
  let oi = 0, tray = [0, 0, 0, 0, 0], done = 0, fin = false, hidden = false, peekT = null, reUsed = false;
  const peek = ms => { hidden = false; clearTimeout(peekT); peekT = setTimeout(() => { hidden = true; show(); }, D(ms)); };
  const show = () => {
    const o = orders[oi];
    p.querySelector("#ord").textContent = !o ? "끝!" : `주문 ${oi + 1}/${NO} · ` + (hidden ? "(손님 이미 폰 보는 중… 뭐였더라)" : o.map((n, i) => n ? `${DR[i][0]} ${n}` : "").filter(Boolean).join(" · "));
    p.querySelector("#tray").textContent = tray.map((n, i) => DR[i][1].repeat(n)).join("") || "(빈 쟁반)";
    p.querySelector("#cafeR").disabled = !o || reUsed || !hidden;
  };
  peek(PEEK); show();
  return new Promise(res => {
    const tick = timerBar(p, D(SEC));
    const end = () => { if (fin) return; fin = true; keyHook = null; clearInterval(iv); clearTimeout(peekT); res(done / NO); };
    const iv = setInterval(() => { if (tick() <= 0) end(); }, 50);
    const add = i => { if (fin || oi >= orders.length) return; tray[i]++; show(); };
    const again = () => { if (fin || oi >= orders.length || reUsed || !hidden) return; reUsed = true; p.querySelector("#cafeMsg").textContent = "손님: (한숨) …다시 말씀드릴게요"; bubble("아 죄송함다 ㅎ 귀가 빚 때문에 막힘", 1300, "tired"); peek(1500); show(); };
    const serve = () => {
      if (fin || oi >= orders.length) return;
      const ok = tray.every((n, i) => n === orders[oi][i]);
      p.querySelector("#cafeMsg").textContent = ok ? "손님: 감사합니다~" : "손님: 이거 제가 시킨 거 아닌데요?";
      bubble(ok ? "오 맞았다. 근데 팁은 없음 ㅅㅂ" : "아 몰라 다 아아로 통일해", 1500, ok ? "smug" : "angry");
      if (ok) done++;
      oi++; tray = [0, 0, 0, 0, 0]; reUsed = false; peek(PEEK); show(); if (oi >= orders.length) setTimeout(end, FAST ? 0 : 400);
    };
    p.querySelectorAll("[data-d]").forEach(b => b.onclick = e => { e.stopPropagation(); add(+b.dataset.d); });
    p.querySelector("#serve").onclick = e => { e.stopPropagation(); serve(); };
    p.querySelector("#cafeR").onclick = e => { e.stopPropagation(); again(); };
    p.querySelector("#clr").onclick = e => { e.stopPropagation(); tray = [0, 0, 0, 0, 0]; show(); };
    keyHook = e => { if (/^[1-5]$/.test(e.key)) { add(+e.key - 1); return true; } if (e.key === "0") { tray = [0, 0, 0, 0, 0]; show(); return true; } if (e.key === "r" || e.key === "R") { again(); return true; } if (e.key === "Enter" || e.key === " ") { serve(); return true; } return false; };
  });
}
async function mgStore(su) {
  if (MGM) return mgMock();
  let zi = 0;
  const H = su.H, NB = 4, SEC = Math.round(10000 / H);
  const p = panel(`<h2>🏪 바코드 타이밍</h2><div class="sub">바늘이 초록 구간에 왔을 때 <b>Space / 클릭</b>으로 삑! ${NB}개 찍기. ${(SEC / 1000).toFixed(1)}초. 찍을수록 빨라지고 구간은 좁아짐.</div>
    <div class="timer"><i></i></div><div class="mgBar" id="mb"><div class="zone" id="zn"></div><div class="needle" id="nd"></div></div>
    <div class="tray" id="sc" style="margin-top:20px">${"🛒 ".repeat(NB)}</div>
    <button class="mash" id="scan" data-bot="scan" style="height:150px">삑! (Space)</button><div class="gag" id="stMsg"></div>`);
  const zone = () => { const w = Math.max(8, 15 - hits * 1.5) / H, x = 8 + su.u[Math.min(zi++, su.u.length - 1)] * (100 - w - 16);   /* 구간 위치 난수 5개는 sim 이 미리 굴림 */ const z = p.querySelector("#zn"); z.style.left = x + "%"; z.style.width = w + "%"; return [x, x + w]; };
  let hits = 0, tries = 0, Z = zone(), pos = 0, dir = 1, speed = 85 * H, fin = false, last = performance.now();
  const marks = [];
  return new Promise(res => {
    const tick = timerBar(p, D(SEC));
    const end = () => { if (fin) return; fin = true; keyHook = null; res(hits / NB); };
    const loop = now => {
      if (fin) return;
      const dt = (now - last) / 1000; last = now;
      pos += dir * speed * dt; if (pos > 100) { pos = 100; dir = -1; } if (pos < 0) { pos = 0; dir = 1; }
      p.querySelector("#nd").style.left = `calc(${pos}% - 5px)`;
      if (tick() <= 0) return end();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    const scan = () => {
      if (fin) return;
      const ok = pos >= Z[0] && pos <= Z[1]; tries++; if (ok) hits++;
      marks.push(ok ? "✅" : "❌"); p.querySelector("#sc").textContent = marks.join(" ") + " " + "🛒 ".repeat(Math.max(0, NB - tries));
      p.querySelector("#stMsg").textContent = ok ? "삑! (정상 결제)" : "삐빅— 다시 찍어 주세요 (점장 째려봄)";
      if (!ok) bubble("바코드도 나 싫어함 ㅋ", 1300, "tired");
      speed += 30 * H; Z = zone();
      if (tries >= NB) setTimeout(end, FAST ? 0 : 350);
    };
    p.querySelector("#scan").onclick = e => { e.stopPropagation(); scan(); };
    keyHook = e => { if (e.key === " " || e.key === "Enter") { scan(); return true; } return false; };
  });
}
async function mgWare(su) {
  if (MGM) return mgMock();
  const GOAL = Math.round(40 * su.H), SEC = 6000;
  const p = panel(`<h2>📦 상하차 연타</h2><div class="sub"><b>Space / 클릭 연타</b>로 박스 ${GOAL}개 올리기. 6초. 중간에 한 번 <b>⚠️ 깨지기 쉬움</b> 박스가 오면 1초 동안 손 떼기 (치면 −3). 허리는 소모품.</div>
    <div class="timer"><i></i></div><button class="mash" id="mash" data-bot="mash">📦 올려! (Space 연타)</button><div class="boxes" id="bx"></div><div class="res" id="cnt">0 / ${GOAL}</div>`);
  let n = 0, fin = false, frag = false, rem = 1;
  // 깨지기 쉬움 구간 1번 (남은 시간 비율 기준, 1/6 = 1초)
  const W = [0.66 - su.w * 0.2].map(a => [a - 1 / 6, a]);
  const mash = p.querySelector("#mash");
  return new Promise(res => {
    const tick = timerBar(p, D(SEC));
    const end = () => { if (fin) return; fin = true; keyHook = null; clearInterval(iv); res(Math.min(1, n / GOAL)); };
    const iv = setInterval(() => {
      rem = tick(); if (rem <= 0) return end();
      const f = W.some(([a, b]) => rem > a && rem <= b);
      if (f !== frag) { frag = f; mash.textContent = f ? "⚠️ 깨지기 쉬움! 손 떼!" : "📦 올려! (Space 연타)"; mash.style.background = f ? "#b3261e" : ""; }
    }, 30);
    const hit = () => {
      if (fin) return;
      if (frag) { n = Math.max(0, n - 3); p.querySelector("#cnt").textContent = `${n} / ${GOAL}`; p.querySelector("#bx").textContent = "📦".repeat(Math.min(n, 40)); bubble("야 그거 유리라고 ㅅㅂ (−3)", 900, "angry"); mash.classList.remove("shake"); void mash.offsetWidth; mash.classList.add("shake"); return; }
      n++;
      p.querySelector("#cnt").textContent = `${n} / ${GOAL}`; p.querySelector("#bx").textContent = "📦".repeat(Math.min(n, 40));
      if (n === 12) bubble("허리 나감 ㅅㅂ", 1200, "angry"); if (n === 26) bubble("박스 = 1틱 박스 = 1틱 박스 = 1틱", 1300, "tired");
      if (n >= GOAL) end();
    };
    p.querySelector("#mash").onclick = e => { e.stopPropagation(); hit(); };
    keyHook = e => { if (e.key === " " || e.key === "Enter") { hit(); return true; } return false; };
  });
}
