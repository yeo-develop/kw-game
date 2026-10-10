/* ================= view/fx.js — 수치 변화 연출 · HUD · 디버그 ================= */
function augFx(id, text) { const a = AUG[id]; floatTxt(`[${a.ic} ${a.name}] ${text}`, a.tier === 3 ? "#ff8fd8" : a.tier === 2 ? "#ffd166" : "#dfe6f2", hudX("augBar"), 150); const c = $(`#augBar [data-aug="${id}"]`); if (c) { c.classList.remove("ping"); void c.offsetWidth; c.classList.add("ping"); } }
function hudX(id, dx = 0) { const e = document.getElementById(id); return e ? e.offsetLeft + dx : 400; }
function floatTxt(t, col, x, y) { const f = document.createElement("div"); f.className = "float"; f.textContent = t; f.style.color = col; f.style.left = x + "px"; f.style.top = y + "px"; $("#fx").appendChild(f); setTimeout(() => f.remove(), 1700); }
function fxAdd(html, ms) { const d = document.createElement("div"); d.innerHTML = html; const el = d.firstElementChild; $("#fx").appendChild(el); setTimeout(() => el.remove(), ms); return el; }
function bigFx(text, kind, small) {
  if (kind === "up") fxAdd(`<div class="aurora"></div>`, 1900); else fxAdd(`<div class="gloom"></div>`, 1900);
  fxAdd(`<div class="bigfx ${kind}">${esc(text)}${small ? `<small>${esc(small)}</small>` : ""}</div>`, 2000);
}
function fxFlex(amt) {
  for (let i = 0; i < 34; i++) { const c = fxAdd(`<div class="conf">${fpick(["💸", "💰", "🪙", "✨", "💵"])}</div>`, 2400); c.style.left = (frnd() * 1880) + "px"; c.style.animationDelay = (frnd() * .6) + "s"; }
  fxAdd(`<div class="bigfx up" style="top:250px">FLEX 💸<small>${esc(sgnWon(amt))}</small></div>`, 2000);
  setFace("flex"); $("#char").classList.remove("bounce"); void $("#char").offsetWidth; $("#char").classList.add("bounce");
}
function fxCrack(amt) {
  const L = [];
  for (let i = 0; i < 14; i++) { const a = frnd() * Math.PI * 2; let x = 960, y = 500, pts = `M960 500`; for (let k = 0; k < 6; k++) { x += Math.cos(a + (frnd() - .5)) * (60 + frnd() * 90); y += Math.sin(a + (frnd() - .5)) * (60 + frnd() * 90); pts += ` L${x.toFixed(0)} ${y.toFixed(0)}`; } L.push(pts); }
  fxAdd(`<div class="redflash"></div>`, 900);
  fxAdd(`<div class="crack"><svg viewBox="0 0 1920 1080"><g stroke="#fff" stroke-width="4" fill="none" opacity=".9">${L.map(p => `<path d="${p}"/>`).join("")}</g><g stroke="#000" stroke-width="2" fill="none" opacity=".6">${L.map(p => `<path d="${p}" transform="translate(3 3)"/>`).join("")}</g><circle cx="960" cy="500" r="26" fill="#fff" opacity=".8"/></svg></div>`, 2300);
  fxAdd(`<div class="bigfx dn" style="top:600px;font-size:96px">${esc(sgnWon(amt))}</div>`, 2000);
  const m = $("#main"); m.classList.remove("shake"); void m.offsetWidth; m.classList.add("shake");
}
async function fxAsh() {
  setChar(true, "panic"); fxAdd(`<div class="whiteflash"></div>`, 1400);
  const c = $("#char"); c.classList.remove("ash"); void c.offsetWidth; c.classList.add("ash");
  for (let i = 0; i < 46; i++) { const d = fxAdd(`<div class="dust"></div>`, 2500); d.style.left = (380 + frnd() * 420) + "px"; d.style.top = (300 + frnd() * 600) + "px"; d.style.setProperty("--dx", (200 + frnd() * 600) + "px"); d.style.setProperty("--dy", (-200 - frnd() * 300) + "px"); d.style.animationDelay = (.6 + frnd() * 1.2) + "s"; }
  fxAdd(`<div class="bigfx dn" style="top:360px">청산<small>미래가 하얗게 불탔다… 재가 됐다…</small></div>`, 2600);
  await wait(2600);
  c.classList.remove("ash"); setFace("cry");
}

/* ================= HUD =================
   이벤트 재생 중엔 그 이벤트 시점의 스냅샷(HS = e.h)으로, 평소엔 현재 상태로 그린다. */
let HS = null;
function hudVals() {
  if (HS) return HS;
  return { phase: S.phase, month: S.month, day: S.day, slot: S.slot, cash: S.cash, debt: S.debt, aff: S.aff, stress: S.stress, paidMonth: S.paidMonth, hv: q("holdVal"), augs: S.augs, galFame: S.galFame, cur: S.cur, nc: S.candles.length };
}
const rateOf = h => RU.RATE - (h.augs.includes("loanbro") ? 0.01 : 0);
const dueOf = h => SIM.roundHalfUp(h.debt * rateOf(h) / 1000) * 1000;
const mentOf = h => h.stress >= (h.augs.includes("posi") ? 90 : 70) ? "men" : h.stress >= 40 ? "anx" : "calm";
function updHud() {
  const hEl = $("#hud");
  if (!S || ["title", "ending", "opening"].includes(S.phase) || (HS && ["ending", "opening"].includes(HS.phase))) { hEl.classList.add("off"); return; }
  const h = hudVals();
  hEl.classList.remove("off");
  const due = dueOf(h), dd = MONTH_DAYS - h.day, mt = mentOf(h), hv = h.hv;
  const paid = h.paidMonth === h.month;
  hEl.innerHTML = `
    <div class="hb" id="hDebt"><span class="l">💀 빚 · 월 ${Math.round(rateOf(h) * 100)}%</span><b class="v">${won(h.debt)}</b></div>
    <div class="hb" id="hCash"><span class="l">💵 현금${hv > 0 ? ` <i>평가 ${man(hv)}</i>` : ""}</span><b class="v">${won(h.cash)}</b></div>
    <div class="hb" id="hDay"><span class="l">${h.month}개월차 ${h.day}/${MONTH_DAYS}일</span><b class="v">${SLOT_IC[h.slot]} ${SLOT_NAME[h.slot]} <span class="pips">${[0, 1, 2, 3].map(i => `<i class="${i < h.slot ? "u" : i === h.slot ? "c" : ""}"></i>`).join("")}</span></b></div>
    <div class="hb ${paid ? "ok" : dd <= 1 ? "warn" : ""}" id="hDue"><span class="l">이자 ${man(due)}원</span><b class="v">${paid ? "완납 ✅" : dd > 0 ? "D-" + dd : "오늘 저녁!"}</b></div>
    <div class="hb" id="hAff"><span class="l">♥ 호감도</span><b class="v">${Math.round(h.aff)}</b><canvas id="affCv" width="260" height="96"></canvas></div>
    <div class="hb ${mt}" id="hMent"><span class="l">멘탈</span><b class="v">${MENT[mt][0]} ${MENT[mt][1]}</b></div>
    <div id="augBar"><span class="lb">🎴</span>${h.augs.length ? h.augs.map(id => { const a = AUG[id]; return `<span class="chip t${a.tier}" data-aug="${id}">${a.ic}<span class="tip"><b>[${TIER[a.tier]} · ${a.cat}] ${esc(a.name)}</b><br>${esc(a.d)}</span></span>`; }).join("") : `<span class="none">증강 없음</span>`}</div>
    <span class="hsp"></span>
    <button id="phoneBtn" data-bot="phone" title="폰 (P)"><span class="pi">📱</span><span class="pt">폰<small>P</small></span><span class="bdg" id="phBdg"></span></button>
    <button id="menuBtn" data-bot="menu" title="메뉴 (M)">≡<small>M</small></button>`;
  drawAff(h);
  $("#menuBtn").onclick = async e => {
    e.stopPropagation();
    if (PH.on) closePhone();
    const v = await modal({ title: "메뉴", body: `진행은 슬롯이 바뀔 때마다 자동 저장된다.<br><small style="color:var(--mute)">클릭/Space/Enter = 넘기기·확인 · 숫자키 = 선택 · P = 폰 · H = 도움말 · M = 메뉴 · Esc = 닫기 · D = 디버그</small>`, acts: [{ l: "타이틀로", v: "title", k: "title" }, { l: "⚙️ 튜토리얼 설정", v: "tut", k: "m-tut" }, { l: "📚 도움말·용어집", v: "help", k: "m-help" }, { l: "닫기", pri: 1 }] });
    if (v === "title") location.href = location.pathname + location.search;
    if (v === "tut") tutSettings();
    if (v === "help") helpList();
  };
  $("#phoneBtn").onclick = e => { e.stopPropagation(); togglePhone(); };
  updBadges();
  updDebug();
}
function drawAff(h) {
  const cv = $("#affCv"); if (!cv) return;
  const ctx = cv.getContext("2d"), Wd = cv.width, Ht = cv.height, N = 12;
  ctx.clearRect(0, 0, Wd, Ht);
  const cs = S.candles.slice(0, h.nc).concat(h.cur ? [h.cur] : []).slice(-N);
  if (!cs.length) return;
  let lo = Math.min(...cs.map(c => c.l), h.aff), hi = Math.max(...cs.map(c => c.h), h.aff);
  const mid = (lo + hi) / 2, half = Math.max(12, (hi - lo) / 2 + 4); lo = Math.max(0, mid - half); hi = Math.min(100, mid + half);
  if (hi - lo < 24) { if (lo === 0) hi = 24; else lo = hi - 24; }
  const Y = v => 10 + (hi - v) / (hi - lo) * (Ht - 20);
  ctx.strokeStyle = "#262a3a"; ctx.lineWidth = 2;
  [hi, lo].forEach(v => { ctx.beginPath(); ctx.moveTo(0, Y(v)); ctx.lineTo(Wd, Y(v)); ctx.stroke(); });
  const cw = Wd / N;
  cs.forEach((c, k) => {
    const x = k * cw + cw / 2, up = c.c >= c.o, col = up ? "#ff4d5e" : "#4e8cff";
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, Y(c.h)); ctx.lineTo(x, Y(c.l)); ctx.stroke();
    const y1 = Y(Math.max(c.o, c.c)), y2 = Y(Math.min(c.o, c.c));
    ctx.fillRect(x - cw * .34, y1, cw * .68, Math.max(5, y2 - y1));
  });
}
/* sim 이벤트 → 수치 연출 */
function fxAff(d, why) {
  if (Math.abs(d) >= 10) bigFx(d > 0 ? `📈 떡상 +${d}` : `📉 떡락 −${-d}`, d > 0 ? "up" : "dn", why || "미래 호감도");
  else floatTxt(`♥ ${d > 0 ? "+" : "−"}${Math.abs(d)}`, d > 0 ? "#ff8fb1" : "#7aa7ff", hudX("hAff", 20), 92);
}
function fxMent(m) { floatTxt(`멘탈 ${MENT[m][1]}`, m === "men" ? "#b98cff" : "#ffd166", hudX("hMent"), 92); }
function fxCash(d) { floatTxt(sgnWon(d), d >= 0 ? "#7ee0a8" : "#ff6b7a", hudX("hCash", 20), 92); }
function fxDebt(d) { floatTxt("빚 " + sgnWon(d), "#ff4d5e", hudX("hDebt", 20), 92); }

/* ================= 디버그 (D키) ================= */
let dbgOn = false;
function updDebug() {
  const el = $("#debug"); if (!S) return;
  el.classList.toggle("on", dbgOn); if (!dbgOn) return;
  if (!el.querySelector("pre")) {
    el.innerHTML = `<pre style="margin:0;font:inherit"></pre><button data-d="cash">현금 +1000만</button><button data-d="pay">이자일 저녁으로</button><button data-d="men">멘헤라로</button><button data-d="zero">빚 100만으로</button><button data-d="aug">증강 +1</button>`;
    el.querySelectorAll("[data-d]").forEach(b => b.onclick = e => {
      e.stopPropagation(); const k = b.dataset.d;
      sendQuick({ t: "debug", k });
      if (k === "pay") floatTxt("[디버그] 7일째 저녁으로 · 이번 행동이 끝나면 이자일", "#7aa7ff", 300, 240);
      if (k === "aug") floatTxt("[디버그] 다음 슬롯 시작 때 증강 선택", "#7aa7ff", 300, 240);
      updHud();
    });
  }
  const h = hudVals();
  el.querySelector("pre").textContent = `[DEBUG] seed=${S.seed} rng=v${S.rngv} phase=${S.phase} pending=${S.pending ? S.pending.t : "-"} ${S.month}월 ${S.day}일 ${SLOT_NAME[S.slot]} T=${Tnow()}
빚 ${won(S.debt)}  현금 ${won(S.cash)}  평가 ${won(h.hv)}  이자 ${won(dueOf(h))}
호감도 ${S.aff}  스트레스 ${S.stress}(${mentOf(h)})  갤명성 ${S.galFame}  시장 ${S.mk ? (S.mk.reg > 0 ? "상승장" : "하락장") : "-"}
증강 ${S.augs.join(",") || "-"}  뉴스 ${S.news ? S.news.tk + (S.news.fake ? "(가짜)" : "") : "-"}
일 ${S.st.work} 도박 ${S.st.gamble} 투자 ${S.st.invest} 청산 ${S.st.liq}`;
}
