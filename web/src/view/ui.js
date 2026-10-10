/* ================= view/ui.js — 화면 스케일 · 장면 · 대사창 · 선택지 · 패널 · 사이드 메뉴 · 모달 (v3.2 view 그대로) ================= */
let keyHook = null;   /* 미니게임·카드가 키 입력을 가로챔 */
/* ================= 화면 스케일 (1920×1080 레터박스) ================= */
function fit() {
  const wr = $("#wrap"), vv = window.visualViewport;
  const W = wr.clientWidth || (vv ? vv.width : window.innerWidth), H = wr.clientHeight || (vv ? vv.height : window.innerHeight);
  const s = Math.min(W / 1920, H / 1080);
  $("#stage").style.transform = `translate(${(W - 1920 * s) / 2}px,${(H - 1080 * s) / 2}px) scale(${s})`;
  $("#rotate").classList.toggle("show", W < 820 && H > W && !window.__rotOff);
}
window.addEventListener("resize", fit);
window.addEventListener("orientationchange", () => setTimeout(fit, 120));
if (window.visualViewport) window.visualViewport.addEventListener("resize", fit);
$("#rotOff").onclick = () => { window.__rotOff = 1; $("#rotate").classList.remove("show"); };

/* ================= 장면 ================= */
let curFace = "neutral";
function drawChar() { const el = $("#char"); el.innerHTML = miraeSVG(curFace, S ? S.outfit : "hoodie"); }
function setChar(show, face) { if (face) curFace = face; const el = $("#char"); el.classList.remove("ash"); if (show) { drawChar(); el.classList.remove("hide"); } else el.classList.add("hide"); }
function setFace(f) { if (!f || f === curFace) return; curFace = f; if (!$("#char").classList.contains("hide")) drawChar(); }
function setBg(name, opt) { $("#bg").innerHTML = bgSVG(name, Object.assign({ props: S ? S.props : {} }, opt || {})); }
function setMode(m) { $("#main").dataset.mode = m || ""; }
function setScene(bg, opt = {}) { setBg(bg, opt); setChar(opt.char !== false, opt.face || "neutral"); showKim(false); hideBubble(); setMode(opt.mode || ""); if (!opt.keepSide) hideSide(); hideMap(); }
function showKim(on, face) { const el = $("#npc"); $("#main").classList.toggle("kimOn", !!on); if (on) { el.innerHTML = kimSVG(face); el.classList.remove("hide"); } else el.classList.add("hide"); }
function showNpc(kind, mood) { const el = $("#npc"); if (!kind) { el.classList.add("hide"); return; } el.innerHTML = npcSVG(kind, mood); el.classList.remove("hide"); }
let bubT = null;
function bubble(text, ms = 2600, face) { if (face) setFace(face); const b = $("#bubble"); b.textContent = text; b.classList.remove("on"); void b.offsetWidth; b.classList.add("on"); clearTimeout(bubT); bubT = setTimeout(hideBubble, FAST ? 30 : ms); }
function hideBubble() { $("#bubble").classList.remove("on"); }

/* ================= 대사창 ================= */
let advWait = null, typing = null, chooseWait = null, modalOpen = false;
function nameCls(who) { return "name " + (who === "미래" ? "m" : who === "나" ? "me" : who === "김사장" ? "kim" : who ? "npc" : "hide"); }
function say(who, text, face) {
  if (face) setFace(face);
  hideBubble();
  return new Promise(res => {
    const d = $("#dlg"), nm = d.querySelector(".name"), tx = d.querySelector(".text"), nx = d.querySelector(".next");
    d.classList.remove("off", "idle");
    nm.className = nameCls(who); nm.textContent = who || "";
    tx.className = "text" + (who ? "" : " nar");
    const full = String(text);
    nx.classList.add("off");
    const done = () => {
      if (typing) clearInterval(typing.t); typing = null;
      tx.textContent = full; nx.classList.remove("off");
      advWait = () => { advWait = null; res(); };
    };
    if (FAST || !full.length) { done(); return; }
    let k = 0; tx.textContent = "";
    typing = { t: setInterval(() => { k += 1; tx.textContent = full.slice(0, k); if (k >= full.length) done(); }, 22), finish: done };
  });
}
/* 대기 없는 대사 (집·장소의 상시 대사) */
function idle(who, text, face) {
  if (face) setFace(face);
  const d = $("#dlg"), nm = d.querySelector(".name"), tx = d.querySelector(".text");
  d.classList.remove("off"); d.classList.add("idle");
  nm.className = nameCls(who); nm.textContent = who || "";
  tx.className = "text" + (who ? "" : " nar"); tx.textContent = text;
  d.querySelector(".next").classList.add("off");
}
const M = (t, f) => say("미래", t, f), ME = t => say("나", t), N = t => say(null, t), KIM = t => say("김사장", t);
function hideDlg() { $("#dlg").classList.add("off"); }
function advance() { if ((modalOpen && $("#modal.on")) || chooseWait) return; if (typing) { typing.finish(); return; } if (advWait) advWait(); }
/* 선택지: [{l, sub, k, dis}] → 고른 항목 */
function choose(opts) {
  return new Promise(res => {
    const box = $("#choices"); box.innerHTML = "";
    $("#dlg .next").classList.add("off");
    opts.forEach((o, i) => {
      const b = document.createElement("button");
      b.dataset.bot = o.k || ("c" + i); b.disabled = !!o.dis;
      b.innerHTML = `<span class="k">${i + 1}</span>${esc(o.l)}${o.sub ? `<small>${esc(o.sub)}</small>` : ""}`;
      b.onclick = e => { e.stopPropagation(); if (b.disabled) return; box.innerHTML = ""; chooseWait = null; res(o); };
      box.appendChild(b);
    });
    chooseWait = i => { const b = box.children[i]; if (b && !b.disabled) b.click(); };
  });
}

/* ================= 패널 · 사이드 · 모달 ================= */
function panel(html, wide) { const p = $("#panel"); p.removeAttribute("style"); p.className = "on" + (wide ? " wide" : ""); p.innerHTML = html; $("#main").classList.add("pOn"); return p; }
function hidePanel() { const p = $("#panel"); p.removeAttribute("style"); p.className = ""; p.innerHTML = ""; $("#main").classList.remove("pOn"); }
/* 오른쪽 메뉴 패널: {title, sub, top, opts:[{k,ic,l,sub,dis,cls}]} → 고른 k */
let sideWait = null;
function sideMenu(cfg) {
  return new Promise(res => {
    const el = $("#side");
    el.innerHTML = `<div class="sh">${cfg.title}</div>${cfg.sub ? `<div class="ss">${cfg.sub}</div>` : ""}${cfg.top || ""}
      <div class="sbtns">${cfg.opts.map((o, i) => `<button class="sbtn ${o.cls || ""}" data-pick="${i}" data-bot="${o.k}" ${o.dis ? "disabled" : ""}><span class="k">${i + 1}</span><span class="ic">${o.ic || ""}</span><b>${o.l}</b>${o.sub ? `<small>${o.sub}</small>` : ""}</button>`).join("")}</div>`;
    el.classList.toggle("compact", !cfg.top); el.classList.add("on");
    el.querySelectorAll(".sbtn").forEach(b => b.onclick = e => { e.stopPropagation(); if (b.disabled) return; sideWait = null; res(b.dataset.bot); });
    sideWait = res;
  });
}
function hideSide() { $("#side").classList.remove("on"); }
/* 폰을 닫았을 때 열려 있던 메뉴(집·장소)를 새 상태로 다시 그림 */
function refreshSide() { if (sideWait) { const r = sideWait; sideWait = null; r("__refresh"); } }
function hideMap() { $("#map").classList.remove("on"); }
function modal({ title, body, acts, wide }) {
  return new Promise(res => {
    modalOpen = true;
    const m = $("#modal");
    m.innerHTML = `<div class="box ${wide ? "wide" : ""}"><h2>${title}</h2><div class="body">${body}</div><div class="acts">${acts.map((a, i) => `<button class="btn ${a.pri ? "pri" : ""}" data-i="${i}" data-bot="${a.k || "ok"}">${a.l}</button>`).join("")}</div></div>`;
    m.classList.add("on");
    function close(v) { m.classList.remove("on"); m.innerHTML = ""; modalOpen = false; res(v); }
    m.querySelectorAll("[data-i]").forEach(b => b.onclick = e => { e.stopPropagation(); close(acts[+b.dataset.i].v); });
  });
}
const clickOnce = el => new Promise(r => { el.addEventListener("click", e => { e.stopPropagation(); r(e); }, { once: true }); });

/* 작은 시세 스파크라인 (SVG) */
function spark(hist, w = 90, h = 30) {
  const c = hist.slice(-12).map(x => x.c); if (c.length < 2) return "";
  const lo = Math.min(...c), hi = Math.max(...c), sp = hi - lo || 1;
  const pts = c.map((v, i) => `${(i / (c.length - 1) * (w - 4) + 2).toFixed(1)},${(h - 3 - (v - lo) / sp * (h - 6)).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="${c[c.length - 1] >= c[0] ? "#ff4d5e" : "#4e8cff"}" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
}
