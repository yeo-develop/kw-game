/* ================= view/panels2.js — 복권·빚또·은행 상환·상점·사채·유품(고르기·상점 뽑기)·아침 결산 화면 ================= */

/* ---------- 즉석 복권 ---------- */
async function scratchPrompt(P) {
  const PRICE = RU.SCRATCH_PRICE, MAXN = RU.SCRATCH_MAX;
  let C = PNL && PNL.k === "scratch" ? PNL : null;
  if (!C) {
    const p = panel(`<h2>🎟️ 즉석 복권 '빚세탁'</h2><div class="sub">한 장 ${won(PRICE)} · 한 번 올 때 최대 ${MAXN}장 · 같은 그림 3개 = 당첨 (💩 5천 · 🍀 2만 · 💎 50만 · 👑 1천만) · 칸을 눌러 긁기</div>
    <div class="scwrap"><div class="scard" id="scard"><div class="scempty">← 한 장 사세요</div></div><div class="scside"><div id="scInfo" class="scinfo"></div>
    <button class="btn" data-bot="sc-buy" id="scBuy">한 장 사기 (5,000원)</button><button class="btn" data-bot="sc-all" id="scAll">전부 긁기</button><div class="res" id="scRes"></div></div></div>
    <div class="row" style="justify-content:flex-end"><button class="btn pri" data-bot="sc-done" id="scDone">그만 (Enter)</button></div>`);
    hideDlg();
    C = PNL = { k: "scratch", p, cardN: 0, open: [] };
  }
  const p = C.p, card = P.card;
  /* 새 카드면 칸 다시 깔기 */
  if (card && C.cardN !== P.n) {
    C.cardN = P.n; C.open = [0, 0, 0, 0, 0, 0];
    p.querySelector("#scard").innerHTML = card.sym.map((_, i) => `<button class="scell" data-ci="${i}" data-bot="sc-c${i}">긁기</button>`).join("");
    p.querySelector("#scRes").textContent = "";
  }
  const info = () => { p.querySelector("#scInfo").innerHTML = `산 장수 ${P.n} / ${MAXN} · 쓴 돈 ${won(P.spent)} · 당첨 ${won(P.got)}<br>현금 ${won(S.cash)}`; p.querySelector("#scBuy").disabled = P.n >= MAXN || S.cash < PRICE || (card && !card.done); p.querySelector("#scAll").disabled = !card || card.done; };
  info();
  return new Promise(res => {
    const reveal = i => { if (!card || card.done || C.open[i]) return; C.open[i] = 1; const c = p.querySelector(`[data-ci="${i}"]`); c.classList.add("open"); c.textContent = card.sym[i]; if (C.open.every(Boolean)) res({ t: "scratchReveal" }); };
    p.querySelectorAll(".scell").forEach(c => c.onclick = e => { e.stopPropagation(); reveal(+c.dataset.ci); });
    p.querySelector("#scBuy").onclick = e => { e.stopPropagation(); if (!p.querySelector("#scBuy").disabled) res({ t: "scratchBuy" }); };
    p.querySelector("#scAll").onclick = e => { e.stopPropagation(); for (let i = 0; i < 6; i++) reveal(i); };
    p.querySelector("#scDone").onclick = async e => {
      e.stopPropagation();
      if (card && !card.done) { for (let i = 0; i < 6; i++) { const c = p.querySelector(`[data-ci="${i}"]`); if (c) { c.classList.add("open"); c.textContent = card.sym[i]; } } await wait(900); }
      res({ t: "scratchDone" });
    };
  });
}
function scratchShow(e) {
  const C = PNL; if (!C || C.k !== "scratch") return;
  const R = C.p.querySelector("#scRes");
  if (e.prize) { R.className = "res win"; R.textContent = `${e.prize[0]}×3 당첨! +${won(e.prize[1])}`; }
  else { R.className = "res lose"; R.textContent = "꽝. 종이값 5천원"; }
}

/* ---------- 빚또 4/20 ---------- */
const ball = n => `<span class="ball b${n % 5}">${n}</span>`;
function lottoPrompt(P) {
  const PRICE = RU.LOTTO_PRICE, MAXD = RU.LOTTO_MAX;
  let C = PNL && PNL.k === "lotto" ? PNL : null;
  if (!C) {
    const p = panel(`<h2>🔮 빚또 4/20</h2><div class="sub">1~20 중 4개. 한 장 ${won(PRICE)}, 하루 최대 ${MAXD}장, <b>오늘 저녁 끝날 때 추첨</b>. 4개 = 4,000만 · 3개 = 10만 · 2개 = 2천원</div>
    <div class="ltix" id="ltix"></div>
    <div class="row" style="justify-content:space-between;margin-top:16px"><span id="ltInfo" style="font-size:20px;color:var(--mute)"></span><span class="row"><button class="btn" data-bot="lt-1" id="lt1">자동 1장</button><button class="btn" data-bot="lt-5" id="lt5">남은 만큼 자동</button><button class="btn pri" data-bot="lt-done" id="ltDone">됐어 (Enter)</button></span></div>`);
    hideDlg();
    C = PNL = { k: "lotto", p };
  }
  const p = C.p, mine = S.lotto.filter(t => t.d === absDay());
  p.querySelector("#ltix").innerHTML = mine.length ? mine.map((t, i) => `<div class="ltk">#${i + 1} ${t.n.map(ball).join("")}</div>`).join("") : `<div class="ltk empty">아직 없음. 미래: "자동이 제일 잘 됨. 통계적으로 (모름)"</div>`;
  const left = MAXD - mine.length;
  p.querySelector("#ltInfo").textContent = `오늘 ${mine.length}/${MAXD}장 · 현금 ${won(S.cash)}`;
  p.querySelector("#lt1").disabled = left <= 0 || S.cash < PRICE; p.querySelector("#lt5").disabled = left <= 0 || S.cash < PRICE;
  return new Promise(res => {
    p.querySelector("#lt1").onclick = e => { e.stopPropagation(); res({ t: "lottoBuy", k: 1 }); };
    p.querySelector("#lt5").onclick = e => { e.stopPropagation(); res({ t: "lottoBuy", k: MAXD }); };
    p.querySelector("#ltDone").onclick = e => { e.stopPropagation(); res({ t: "lottoDone" }); };
  });
}
/* sim 이벤트 lottoDraw: 저녁 추첨 모달 */
async function lottoDrawShow(e) {
  const rows = e.rows.map((t, i) => `<div class="ltk">#${i + 1} ${t.n.map(x => e.win.includes(x) ? ball(x).replace("ball", "ball hit") : ball(x)).join("")} <b class="${t.pz ? "up" : "dn"}">${t.m}개 ${t.pz ? "+" + won(t.pz) : "꽝"}</b></div>`).join("");
  await modal({ title: "🔮 오늘의 빚또 추첨", body: `<div class="ldraw">${e.win.map(ball).join("")}</div>${rows}<div class="conv" style="margin-top:12px">${e.tot ? `당첨금 ${won(e.tot)} = ${e.conv}` : "전부 꽝. 1등 확률 1/4845. 미래: \"번호가 나를 피함\""}</div>`, acts: [{ l: "확인 (Enter)", pri: 1, k: "lottook" }] });
}

/* ---------- 은행: 원금 상환 ---------- */
async function repayPrompt(P) {
  const mx = P.mx, due = P.due;
  const p = panel(`<h2>🏛️ 원금 상환</h2><div class="sub">원금을 갚으면 다음 달 이자도 줄어든다. <b style="color:#ffb3bb">${due ? `이자일(7일째 저녁)에 낼 ${won(due)}은 남겨 둘 것.` : "이번 달 이자는 완납."}</b></div>
    <div class="stake"><div class="row"><span style="font-size:18px;color:var(--mute)">상환액</span><span class="amt" id="rpV">0원</span>
      <button class="btn sm" data-r="keep" data-bot="rp-keep">이자 남기고 전부</button><button class="btn sm" data-r="all" data-bot="rp-all">전부</button></div>
      <input type="range" id="rp" min="0" max="${mx}" step="10000" value="0"><div id="rpI" style="font-size:18px;color:var(--mute)"></div></div>
    <div class="row" style="margin-top:20px;justify-content:flex-end;gap:16px"><button class="btn" id="rest0" data-bot="rp-cancel">안 갚음</button><button class="btn pri" id="repay" data-bot="repay">갚는다 (Enter)</button></div>`);
  hideDlg();
  const sl = p.querySelector("#rp"), v = p.querySelector("#rpV"), info = p.querySelector("#rpI");
  const rate = q("rate");
  const upd = () => { const a = +sl.value; v.textContent = won(a); info.textContent = `남는 현금 ${won(S.cash - a)} · 남는 빚 ${won(S.debt - a)} · 다음 달 이자 ${won(Math.round((S.debt - a) * rate / 1000) * 1000)}` + (a ? ` · = ${conv(a)}` : ""); p.querySelector("#repay").disabled = a <= 0; };
  sl.oninput = upd;
  p.querySelectorAll("[data-r]").forEach(b => b.onclick = e => { e.stopPropagation(); sl.value = b.dataset.r === "all" ? mx : Math.max(0, Math.floor(Math.min(S.cash - due, S.debt) / 10000) * 10000); upd(); });
  sl.value = Math.max(0, Math.floor(Math.min(S.cash - due, S.debt) / 10000) * 10000); upd();
  const a = await new Promise(res => { p.querySelector("#rest0").onclick = e => { e.stopPropagation(); res(0); }; p.querySelector("#repay").onclick = e => { e.stopPropagation(); res(+sl.value); }; });
  hidePanel();
  return { t: "repay", amt: a };
}

/* ---------- 상점: 꾸미기 ---------- */
function shopPrompt(P) {
  const p = panel(`<h2>🛍️ 꾸미기 상점</h2><div class="sub">사면 미래 옷·방이 실제로 바뀐다. 산 옷을 누르면 갈아입음. 현금 ${won(S.cash)}</div>
      <div class="shop">${ITEMS.map(it => { const own = it.type === "outfit" ? S.owned[it.id] : S.props[it.id]; const wear = S.outfit === it.id;
        return `<button class="item ${own ? "own" : ""}" data-it="${it.id}" data-bot="buy-${it.id}" ${!own && S.cash < it.p ? "disabled" : ""}><span class="ic">${it.ic}</span><b>${it.name}</b>
        <span class="p">${own ? (it.type === "outfit" ? (wear ? "착용 중" : "보유 · 입히기") : "설치됨") : won(it.p)}</span><span class="d">${it.d}</span></button>`; }).join("")}
        ${S.owned.hoodie && S.outfit !== "hoodie" ? `<button class="item own" data-it="hoodie" data-bot="buy-hoodie"><span class="ic">🖤</span><b>기본 후드티</b><span class="p">보유 · 입히기</span><span class="d">원조 롱잡고알바감 룩</span></button>` : ""}</div>
      <div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn pri" id="shopDone" data-bot="shopdone">다 샀다 (Enter)</button></div>`);
  if (!PNL || PNL.k !== "shop") hideDlg();
  PNL = { k: "shop", p };
  return new Promise(res => {
    p.querySelectorAll("[data-it]").forEach(b => b.onclick = e => { e.stopPropagation(); res({ t: "shopBuy", id: b.dataset.it }); });
    p.querySelector("#shopDone").onclick = e => { e.stopPropagation(); res({ t: "shopDone" }); };
  });
}

/* ---------- 돈 땡기기 (폰 · 김사장 사채) ---------- */
function loanPrompt(P) {
  if (!PNL || PNL.k !== "loan") { hideSide(); hideDlg(); }
  const cap = q("loanCap"), room = Math.max(0, cap - S.debt), fr = q("loanFee"), took = P.took;
  const p = panel(`<div class="loanbox"><div class="lk">${kimSVG()}</div><div>
        <h2>💸 돈 땡기기 — 친절한 김사장 캐피탈</h2>
        <div class="sub">선이자 ${Math.round(fr * 100)}% 떼고 바로 입금^^ 한도는 신용(=버틴 달 수)에 따라 열림: 1개월차 3,600만 · 2개월차 4,300만 · 3개월차 5,000만 (총 빚 기준). 빚 5,000만 넘으면… 아시죠?</div>
        <div class="lrow"><div><small>지금 빚</small><b class="dn">${won(S.debt)}</b></div><div><small>${S.month}개월차 한도</small><b>${won(cap)}</b></div><div><small>남은 한도</small><b class="up">${won(room)}</b></div></div>
        <div class="row" style="gap:14px;margin-top:18px">${RU.LOAN_AMTS.map(L => [L, man(L)]).map(([L, l]) => `<button class="btn red" data-ln="${L}" data-bot="ln-${L / 10000}" ${room < L ? "disabled" : ""}>+${l} <small>(실수령 ${man(L * (1 - fr))})</small></button>`).join("")}</div>
        <div class="gag" style="text-align:left;margin-top:14px">${took ? `이번에 땡긴 돈 ${won(took)} · 현금 ${won(S.cash)}` : "김사장: \"급하시죠? 다 압니다^^\""}</div>
        <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn pri" data-bot="ln-done" id="lnDone">됐어요 (Enter)</button></div></div></div>`);
  PNL = { k: "loan", p };
  return new Promise(res => {
    p.querySelectorAll("[data-ln]").forEach(b => b.onclick = e => { e.stopPropagation(); if (!b.disabled) res({ t: "borrow", amt: +b.dataset.ln }); });
    p.querySelector("#lnDone").onclick = e => { e.stopPropagation(); closePnl(); res({ t: "loanDone" }); };
  });
}

/* ---------- 유품 고르기 (시작: 부모님 유품 상자) ---------- */
function augPrompt(P) {
  const el = $("#augPick");
  hideSide(); hideDlg();
  const list = P.offer.map(id => AUG[id]);
  el.innerHTML = `<div class="aph"><h2><span class="e">📦</span> 부모님 유품</h2><div class="sub">${esc(P.reason)} · 3개 중 1개 · 게임 끝까지 유지 · 숫자키 1~3 · 나머지는 상점에서 뽑기/구매</div></div>
        <div class="acards">${list.map((a, i) => `<button class="acard t${a.tier}" data-pick="${i}" data-bot="aug${i}" data-aid="${a.id}" style="animation-delay:${FAST ? 0 : i * 0.12}s"><span class="k">${i + 1}</span><span class="tier">${TIER[a.tier]}</span><span class="cat">${a.cat}</span><span class="aic">${a.ic}</span><b>${esc(a.name)}</b><span class="ad">${esc(a.d)}</span><span class="fl">"${esc(a.fl)}"</span></button>`).join("")}</div>
        <div class="arow"><button class="btn" data-bot="aug-reroll" id="augRe" ${P.rerolled ? "disabled" : ""}>🔄 상자 더 뒤지기 (1회)</button><span class="owned">${S.augs.length ? "보유: " + S.augs.map(x => AUG[x].ic + " " + AUG[x].name).join(" · ") : ""}</span></div>`;
  el.classList.add("on");
  const pr = new Promise(res => {
    el.querySelectorAll(".acard").forEach(b => b.onclick = e => { e.stopPropagation(); el.classList.remove("on"); el.innerHTML = ""; res({ t: "pickRelic", i: +b.dataset.pick }); });
    el.querySelector("#augRe").onclick = e => { e.stopPropagation(); if (P.rerolled) return; res({ t: "relicReroll" }); };
  });
  tutHook("aug");
  return pr;
}

/* ---------- 아침 결산 화면 (sim 이벤트 morning) ---------- */
async function morningShow(e) {
  setScene("room", { face: q("moodFace"), mode: "home" }); hideDlg();
  const sc = $("#screen"); sc.classList.add("on");
  const dd = e.dd, Y = e.Y;
  sc.innerHTML = `<div class="recap"><h2>☀️ ${e.month}개월차 ${e.day}일째 아침</h2>
    <div class="sub">💪 체력 ${e.hp}${e.addict >= RU.ADD_NAG ? ` · 🎰 중독도 ${e.addict}` : ""} · ${e.paid ? "이번 달 이자 완납 ✅" : dd > 0 ? `이자일까지 D-${dd} (7일째 저녁) · 이번 달 이자 ${won(e.due)}` : `<b style="color:var(--red)">오늘 저녁이 이자일!</b> 이자 ${won(e.due)} · 현금 ${won(e.cash)}`} · 현금 ${won(e.cash)} · 평가 ${won(e.hv)}</div>
    <div class="cols"><div><h3>어제 결산</h3><div class="ylist">${Y.length ? Y.slice(-7).map(x => `<div class="li"><span>${esc(x.label || x.kind)}</span><b class="${x.amt >= 0 ? "up" : "dn"}">${sgnWon(x.amt)}</b></div>`).join("") : `<div class="li"><span>어제 기록 없음 (빚만 숨 쉬듯 존재)</span><b>0원</b></div>`}${Y.length > 7 ? `<div class="li dim"><span>외 ${Y.length - 7}건</span><b></b></div>` : ""}</div>
      <div class="net ${e.net >= 0 ? "up" : "dn"}">${sgnWon(e.net)}</div><div class="conv">= ${esc(e.netConv)}</div></div>
    <div>${e.ev || e.tod.length ? `<h3>오늘의 사건</h3><div class="ev">${e.ev ? esc(e.ev) : ""}${e.tod.map(x => `<div>${esc(x.label)} <b class="up">${sgnWon(x.amt)}</b></div>`).join("")}</div>` : ""}
      <h3>주갤 개념글</h3><div class="box">${e.best.map(g => `<b>${esc(g.au)}</b> ${esc(g.title)} <span style="color:#ff8a95">↑${g.up}</span>`).join("<br>") || "조용함 (폭풍 전야)"}</div>
      <h3>미래 카톡</h3><div class="box">"${esc(e.mline)}"</div>
      <div style="text-align:right;margin-top:6px"><button class="btn pri" id="goDay" data-bot="goDay">🌅 하루 시작 (Enter)</button></div></div></div></div>`;
  await clickOnce($("#goDay"));
  sc.classList.remove("on"); sc.innerHTML = "";
}

/* ---------- 상점: 부모님 유품 · 수상한 물건 (싸게 뽑기 / 비싸게 골라 사기) ---------- */
const relicCard = (a, extra) => `<div class="rcard t${a.tier}"><span class="tier">${TIER[a.tier]}</span><span class="aic">${a.ic}</span><b>${esc(a.name)}</b><span class="ad">${esc(a.d)}</span><span class="fl">"${esc(a.fl)}"</span>${extra || ""}</div>`;
function relicShopPrompt(P) {
  const offer = (S.relicOffer ? S.relicOffer.ids : []).filter(id => !has(id)), GP = RU.GACHA_PRICE;
  let C = PNL && PNL.k === "relicShop" ? PNL : null;
  const html = `<h2>🎁 부모님 유품 · 수상한 물건 <span class="lim2">현금 ${won(S.cash)} · 뭐라도 사면 1칸</span></h2>
    <div class="rshop"><div class="rgacha"><div class="cap" id="cap"><span>?</span></div><div class="rgi"><b>수상한 물건 뽑기</b><small>${won(GP)} · ${Math.round(RU.GACHA_JUNK * 100)}% 확률로 쓰레기(꽝) · 당첨 등급: 수상함 60 / 골동품 30 / 가보 10</small>
      <button class="btn pri2" id="gacha" data-bot="gacha" ${S.cash < GP ? "disabled" : ""}>뽑기 (${man(GP)}) <kbd>G</kbd></button><div class="res" id="gRes2"></div></div></div>
    <div class="roffer"><h3>오늘의 진열장 (골라 사기 · 비쌈)</h3><div class="rcards">${offer.length ? offer.map((id, i) => { const a = AUG[id], pr = q("relicPrice", id); return `<button class="rbuy" data-id="${id}" data-bot="rb-${i}" ${S.cash < pr ? "disabled" : ""}>${relicCard(a, `<span class="pr">${won(pr)}</span>`)}</button>`; }).join("") : `<div class="rempty">오늘 진열장 비었음. 내일 또 와~</div>`}</div></div></div>
    <div class="row" style="justify-content:space-between;margin-top:10px"><span class="gag" id="rMsg">${C && C.msg ? esc(C.msg) : "사장님: \"유품은 사연이 있어서 비싸요~ 뽑기는 사연이 없어서 싸고요^^\""}</span><button class="btn pri" id="rDone" data-bot="rdone">됐어 (Enter)</button></div>`;
  const p = panel(html, true);
  p.style.top = "150px"; p.style.height = "900px";
  if (!C) hideDlg();
  PNL = C = { k: "relicShop", p, msg: C ? C.msg : "", cap: C ? C.cap : null };
  if (C.cap) { const cp = p.querySelector("#cap"); cp.className = C.cap[0]; cp.innerHTML = C.cap[1]; const r = p.querySelector("#gRes2"); r.className = C.cap[2]; r.textContent = C.cap[3]; }
  return new Promise(res => {
    p.querySelector("#gacha").onclick = e => { e.stopPropagation(); if (!e.currentTarget.disabled) res({ t: "gachaRelic" }); };
    p.querySelectorAll(".rbuy").forEach(b => b.onclick = e => { e.stopPropagation(); if (!b.disabled) res({ t: "buyRelic", id: b.dataset.id }); });
    p.querySelector("#rDone").onclick = e => { e.stopPropagation(); res({ t: "relicDone" }); };
    keyHook = e => { if (e.key === "g" || e.key === "G") { const b = p.querySelector("#gacha"); if (b && !b.disabled) { keyHook = null; res({ t: "gachaRelic" }); } return true; } if (e.key === "Enter" || e.key === " ") { keyHook = null; res({ t: "relicDone" }); return true; } return false; };
  }).then(c => { keyHook = null; return c; });
}
/* sim 이벤트 gacha: 캡슐 흔들 → 열림 */
async function gachaShow(e) {
  const C = PNL; if (!C || C.k !== "relicShop") return;
  const cap = C.p.querySelector("#cap"), R = C.p.querySelector("#gRes2");
  cap.className = "cap spin"; cap.innerHTML = "<span>?</span>";
  await wait(1100);
  if (e.id) {
    const a = AUG[e.id];
    cap.className = "cap open t" + a.tier; cap.innerHTML = `<span>${a.ic}</span>`;
    R.className = "res win"; R.textContent = `${TIER[a.tier]}! ${a.name}`;
    C.msg = `뽑음: ${a.ic} ${a.name} — ${a.d}`;
    C.cap = [cap.className, cap.innerHTML, R.className, R.textContent];
    if (a.tier === 3) bigFx(`${a.ic} ${a.name}`, "up", "가보급 수상한 물건");
  } else {
    cap.className = "cap open junk"; cap.innerHTML = "<span>🗑️</span>";
    R.className = "res lose"; R.textContent = `꽝: ${e.text}`;
    C.msg = `꽝: ${e.text} (15만 원짜리)`;
    C.cap = [cap.className, cap.innerHTML, R.className, R.textContent];
  }
  await wait(700);
}
/* 상점에서 산 유품 알림 (HUD 칩 + 떠오르는 글) */
function relicGot(id, how) { const c = $(`#augBar [data-aug="${id}"]`); if (c) { c.classList.remove("ping"); void c.offsetWidth; c.classList.add("ping"); } }
