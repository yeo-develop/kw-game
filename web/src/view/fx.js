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
  return { phase: S.phase, month: S.month, day: S.day, slot: S.slot, cash: S.cash, debt: S.debt, hp: S.hp, stress: S.stress, addict: S.addict, paidMonth: S.paidMonth, hv: q("holdVal"), augs: S.augs, galFame: S.galFame, faint: S.faint >= Tnow() };
}
const rateOf = h => RU.RATE - (h.augs.includes("loanbro") ? 0.01 : 0);
const dueOf = h => SIM.roundHalfUp(h.debt * rateOf(h) / 1000) * 1000;
const mentOf = h => h.stress >= (h.augs.includes("posi") ? 90 : 70) ? "men" : h.stress >= 40 ? "anx" : "calm";
const hpCls = v => v <= 0 ? "out" : v < RU.HP_LOW ? "low" : v < 60 ? "mid" : "ok";
function updHud() {
  const hEl = $("#hud");
  if (!S || ["title", "ending", "opening"].includes(S.phase) || (HS && ["ending", "opening"].includes(HS.phase))) { hEl.classList.add("off"); return; }
  const h = hudVals();
  hEl.classList.remove("off");
  const due = dueOf(h), dd = MONTH_DAYS - h.day, mt = mentOf(h), hv = h.hv;
  const paid = h.paidMonth === h.month || h.debt <= 0, hp = Math.round(h.hp);
  hEl.innerHTML = `
    <div class="hb" id="hDebt"><span class="l">💀 빚 · 월 ${Math.round(rateOf(h) * 100)}%</span><b class="v">${won(h.debt)}</b></div>
    <div class="hb" id="hCash"><span class="l">💵 현금${hv > 0 ? ` <i>평가 ${man(hv)}</i>` : ""}</span><b class="v">${won(h.cash)}</b></div>
    <div class="hb" id="hDay"><span class="l">${h.month}개월차 ${h.day}/${MONTH_DAYS}일</span><b class="v">${SLOT_IC[h.slot]} ${SLOT_NAME[h.slot]} <span class="pips">${SLOT_NAME.map((_, i) => `<i class="${i < h.slot ? "u" : i === h.slot ? "c" : ""}"></i>`).join("")}</span></b></div>
    <div class="hb ${paid ? "ok" : dd <= 1 ? "warn" : ""}" id="hDue"><span class="l">이자 ${man(due)}원</span><b class="v">${h.debt <= 0 ? "빚 없음 🎉" : paid ? "완납 ✅" : dd > 0 ? "D-" + dd : "오늘 저녁!"}</b></div>
    <div class="hb ${hpCls(hp)} ${h.faint ? "faint" : ""}" id="hHp"><span class="l">💪 체력 ${h.faint ? "<i>기절 중</i>" : hp < RU.HP_LOW ? "<i>과로 (성과↓)</i>" : ""}</span><b class="v"><span class="hpbar"><i style="width:${hp}%"></i></span><span class="hpn">${hp}</span></b></div>
    <div class="hb ${mt}" id="hMent"><span class="l">멘탈${h.addict >= RU.ADD_NAG ? ` <i class="add ${h.addict >= RU.ADD_TEMPT ? "a3" : h.addict >= RU.ADD_SECRET ? "a2" : "a1"}">🎰 중독 ${h.addict}</i>` : ""}</span><b class="v">${MENT[mt][0]} ${MENT[mt][1]}</b></div>
    <div id="augBar"><span class="lb">🎁</span>${h.augs.length ? h.augs.map(id => { const a = AUG[id]; return `<span class="chip t${a.tier}" data-aug="${id}">${a.ic}<span class="tip"><b>[${TIER[a.tier]} · ${a.cat}] ${esc(a.name)}</b><br>${esc(a.d)}</span></span>`; }).join("") : `<span class="none">유품 없음</span>`}</div>
    <span class="hsp"></span>
    <button id="phoneBtn" data-bot="phone" title="폰 (P)"><span class="pi">📱</span><span class="pt">폰<small>P</small></span><span class="bdg" id="phBdg"></span></button>
    <button id="menuBtn" data-bot="menu" title="메뉴 (M)">≡<small>M</small></button>`;
  $("#menuBtn").onclick = async e => {
    e.stopPropagation();
    if (PH.on) closePhone();
    const v = await modal({ title: "메뉴", body: `진행은 칸이 바뀔 때마다 자동 저장된다.<br><small style="color:var(--mute)">클릭/Space/Enter = 넘기기·확인 · 숫자키 = 선택 · P = 폰 · H = 도움말 · M = 메뉴 · Esc = 닫기 · D = 디버그</small>${recHtml()}`, acts: [{ l: "타이틀로", v: "title", k: "title" }, { l: "⚙️ 튜토리얼 설정", v: "tut", k: "m-tut" }, { l: "📚 도움말·용어집", v: "help", k: "m-help" }, { l: "닫기", pri: 1 }] });
    if (v === "title") location.href = location.pathname + location.search;
    if (v === "tut") tutSettings();
    if (v === "help") helpList();
  };
  $("#phoneBtn").onclick = e => { e.stopPropagation(); togglePhone(); };
  updBadges();
  updDebug();
}
/* sim 이벤트 → 수치 연출 */
function fxHp(d, why) {
  floatTxt(`💪 ${d > 0 ? "+" : "−"}${Math.abs(d)}${why ? " " + why : ""}`, d > 0 ? "#7ee0a8" : "#ffb070", hudX("hHp", 20), 92);
  const b = $("#hHp"); if (b) { b.classList.remove("ping"); void b.offsetWidth; b.classList.add("ping"); }
}
function fxAddict(d, v) {
  if (Math.abs(d) < 3) return;
  const th = [RU.ADD_NAG, RU.ADD_SECRET, RU.ADD_TEMPT].find(t => v >= t && v - d < t);
  if (th) bigFx(`🎰 도박 중독도 ${v}`, "dn", th === RU.ADD_NAG ? "미래가 도박 가자고 조르기 시작함" : th === RU.ADD_SECRET ? "미래가 몰래 카지노 감 · 안 하면 금단" : "행동마다 도박 유혹이 끼어듦");
  else floatTxt(`🎰 중독 ${d > 0 ? "+" : "−"}${Math.abs(d)}`, d > 0 ? "#ff8fd8" : "#9fb4d8", hudX("hMent", 10), 120);
}
function fxMent(m) { floatTxt(`멘탈 ${MENT[m][1]}`, m === "men" ? "#b98cff" : "#ffd166", hudX("hMent"), 92); }
function fxCash(d) { floatTxt(sgnWon(d), d >= 0 ? "#7ee0a8" : "#ff6b7a", hudX("hCash", 20), 92); }
function fxDebt(d) { floatTxt("빚 " + sgnWon(d), "#ff4d5e", hudX("hDebt", 20), 92); }
/* 엔딩 기록 (localStorage, 실패해도 무시) */
function recLoad() { try { return JSON.parse(localStorage.getItem(REC_KEY) || "null") || { seen: {}, best: null, runs: 0 }; } catch (e) { return { seen: {}, best: null, runs: 0 }; } }
function recSave(kind, sb) {
  const r = recLoad();
  r.seen[kind] = (r.seen[kind] || 0) + 1; r.runs++;
  if (kind === "clear" && (!r.best || sb.days < r.best.days)) r.best = { days: sb.days, seed: S.seed, profit: sb.profit };
  try { localStorage.setItem(REC_KEY, JSON.stringify(r)); } catch (e) { }
  return r;
}
function recHtml() {
  const r = recLoad(), nm = { clear: "정식(빚 0)", bad1: "끌려감", bad2: "도박 중독" };
  return `<div style="margin-top:12px;font-size:18px">📒 엔딩 기록: ${Object.keys(nm).map(k => `${r.seen[k] ? "✅" : "⬜"} ${nm[k]}${r.seen[k] ? ` ×${r.seen[k]}` : ""}`).join(" · ")}${r.best ? ` · 최단 클리어 ${r.best.days}일` : ""}</div>`;
}

/* ================= 디버그 (D키) ================= */
let dbgOn = false;
function updDebug() {
  const el = $("#debug"); if (!S) return;
  el.classList.toggle("on", dbgOn); if (!dbgOn) return;
  if (!el.querySelector("pre")) {
    el.innerHTML = `<pre style="margin:0;font:inherit"></pre><button data-d="cash">현금 +1000만</button><button data-d="pay">이자일 저녁으로</button><button data-d="men">멘헤라로</button><button data-d="zero">빚 100만으로</button><button data-d="aug">유품 +1</button><button data-d="hp">체력 5로</button><button data-d="addict">중독도 85로</button>`;
    el.querySelectorAll("[data-d]").forEach(b => b.onclick = e => {
      e.stopPropagation(); const k = b.dataset.d;
      sendQuick({ t: "debug", k });
      if (k === "pay") floatTxt("[디버그] 7일째 저녁으로 · 이번 행동이 끝나면 이자일", "#7aa7ff", 300, 240);
      if (k === "aug") floatTxt("[디버그] 다음 칸 시작 때 유품 선택", "#7aa7ff", 300, 240);
      updHud();
    });
  }
  const h = hudVals();
  el.querySelector("pre").textContent = `[DEBUG] seed=${S.seed} rng=v${S.rngv} phase=${S.phase} pending=${S.pending ? S.pending.t : "-"} ${S.month}월 ${S.day}일 ${SLOT_NAME[S.slot]} T=${Tnow()}
빚 ${won(S.debt)}  현금 ${won(S.cash)}  평가 ${won(h.hv)}  이자 ${won(dueOf(h))}
체력 ${S.hp}  중독도 ${S.addict}  스트레스 ${S.stress}(${mentOf(h)})  갤명성 ${S.galFame}  시장 ${S.mk ? (S.mk.reg > 0 ? "상승장" : "하락장") : "-"}
유품 ${S.augs.join(",") || "-"}  뉴스 ${S.news ? S.news.tk + (S.news.fake ? "(가짜)" : "") : "-"}
일 ${S.st.work} 도박 ${S.st.gamble} 투자 ${S.st.invest} 청산 ${S.st.liq}`;
}
