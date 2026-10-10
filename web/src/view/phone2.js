/* ================= view/phone2.js — 폰 앱 화면 렌더 · 입력 ================= */
/* ================= 렌더 ================= */
function dockBadge(a) {
  if (a === "kakao") { const k = kUnread(); return k ? `<b class="k">${k}</b>` : ""; }
  if (a === "gall") return S.gReact ? `<b class="g">${S.gReact}</b>` : S.gNew ? `<b class="f">${S.gNew > 9 ? "9+" : S.gNew}</b>` : "";
  if (a === "news") return S.fUnread ? `<b class="f">${S.fUnread > 9 ? "9+" : S.fUnread}</b>` : "";
  if (a === "stock" && hasPos()) { const p = unreal(); return `<b class="${p >= 0 ? "pu" : "pd"}">${p >= 0 ? "▲" : "▼"}</b>`; }
  return "";
}
function phR() {
  if (!PH.on || !S) return;
  const ov = $("#phoneOv"), sc = {}; ov.querySelectorAll("[data-keep]").forEach(e => sc[e.dataset.keep] = e.scrollTop);
  if (PH.app === "kakao" && S.kun[PH.room]) markRead({ what: "kakao", room: PH.room });
  if (PH.app === "gall" && (S.gNew || (PH.gtab === "mine" && S.gReact))) markRead({ what: "gall", mine: PH.gtab === "mine" });
  if (PH.app === "news" && S.fUnread) markRead({ what: "news" });
  const body = { home: phHome, kakao: phKakao, gall: phGall, stock: phStock, news: phNews }[PH.app]();
  ov.innerHTML = `<div class="phf"><div class="pscr">
    <div class="pst"><span>${clockNow()} · ${S.month}개월차 ${S.day}일 ${SLOT_IC[S.slot]} ${SLOT_NAME[S.slot]}</span><span class="isl"></span><span class="pr">5G ▮▮▮ 🔋${S.cash < 100000 ? 4 : 87}%<button class="pclose" data-a="close" data-bot="ph-close">닫기 ✕ <small>Esc · P</small></button></span></div>
    <div class="pbody"><div class="pdock">${APPS.map(([k, ic, l], i) => `<button class="pdk ${PH.app === k ? "on" : ""}" data-a="app" data-v="${k}" data-bot="ph-app-${k}"><span class="ic">${ic}</span><span>${l}</span><span class="db">${dockBadge(k)}</span><i>${i}</i></button>`).join("")}</div>
    <div class="pcon app-${PH.app}">${body}</div></div></div></div>`;
  ov.querySelectorAll("[data-keep]").forEach(e => { if (sc[e.dataset.keep] != null) e.scrollTop = sc[e.dataset.keep]; else if (e.dataset.bottom) e.scrollTop = e.scrollHeight; });
  const k = ov.querySelector(".kmsgs"); if (k) k.scrollTop = k.scrollHeight;
  if (PH.app === "stock") phStockDraw();
  updBadges();
  tutHook("phone");
}
/* ---------- 홈 ---------- */
function phHome() {
  const due = q("interestDue"), dd = MONTH_DAYS - S.day, paid = S.paidMonth === S.month, pl = unreal();
  const lastK = ["m", "kim", "hy"].map(r => [r, S.kk[r][S.kk[r].length - 1]]).filter(x => x[1]).sort((a, b) => 0).slice(0, 3);
  const best = S.posts.filter(p => p.best).slice(-1)[0];
  const rk = rankOf(S.galFame);
  return `<div class="phome">
    <div class="hw"><div class="clk">${clockNow()}</div><div class="cday">${S.month}개월차 ${S.day}일 · ${SLOT_NAME[S.slot]} · ${stockOpen() ? "주식 장 열림" : "주식 장 마감 (코인만)"}</div>
      <div class="wg"><div class="wc"><small>현금</small><b class="g">${won(S.cash)}</b></div><div class="wc"><small>빚</small><b class="r">${won(S.debt)}</b></div><div class="wc"><small>이자 ${man(due)}원</small><b class="y">${paid ? "완납 ✅" : dd > 0 ? "D-" + dd : "오늘 저녁!"}</b></div>
        <div class="wc"><small>포지션 평가손익</small><b class="${pl >= 0 ? "up" : "dn"}">${hasPos() ? sgnWon(pl) : "없음"}</b></div><div class="wc"><small>갤 명성</small><b>${S.galFame} · ${rk[1]}</b></div><div class="wc"><small>미래 호감도</small><b class="p">♥ ${Math.round(S.aff)}</b></div></div>
      <div class="wk">${lastK.map(([r, m]) => `<div data-a="room" data-v="${r}" data-bot="ph-k-${r}"><span>${KROOM[r].ic}</span><b>${KROOM[r].n}</b> ${esc(m.x)}${S.kun[r] ? `<i>${S.kun[r]}</i>` : ""}</div>`).join("")}</div>
      ${best ? `<div class="wb" data-a="gpost" data-v="${best.id}"><small>🔥 주갤 개념글</small> ${esc(best.title)} <span>↑${best.up}</span></div>` : ""}</div>
    <div class="happs">${APPS.slice(1).map(([k, ic, l], i) => `<button class="happ a-${k}" data-a="app" data-v="${k}"><span class="ic">${ic}</span><b>${l}</b><span class="db">${dockBadge(k)}</span><small>${i + 1}</small></button>`).join("")}
      <div class="hnote">폰은 슬롯을 안 씀 · 주식은 오전·오후만 · 숫자키 1~4 = 앱 · Esc = 닫기</div></div></div>`;
}
/* ---------- 카톡 ---------- */
function phKakao() {
  const r = PH.room, L = S.kk[r], R = KROOM[r];
  let lastD = 0;
  const msgs = L.map(m => {
    let sep = ""; if (m.d !== lastD) { lastD = m.d; sep = `<div class="kday">${Math.floor((m.d - 1) / MONTH_DAYS) + 1}개월차 ${(m.d - 1) % MONTH_DAYS + 1}일</div>`; }
    if (m.w === "sys") return sep + `<div class="kb sys">${esc(m.x)}</div>`;
    const me = m.w === "me";
    return sep + `<div class="kb ${me ? "me" : "them " + m.w}">${me ? "" : `<span class="av">${R.ic}</span>`}<div class="kx">${me ? "" : `<small>${R.n}</small>`}<div class="b">${esc(m.x)}</div></div><span class="t">${m.t}</span></div>`;
  }).join("");
  const reply = r === "m" && S.kq ? `<div class="kreply"><span>답장 고르기 <small>(2칸 안에 안 하면 읽씹 처리 · 호감도)</small></span>${S.kq.opts.map((o, i) => `<button data-a="kr" data-v="${i}" data-bot="kr-${i}"><kbd>${"QWE"[i]}</kbd> ${esc(o.l)}</button>`).join("")}</div>`
    : `<div class="kreply off">${r === "m" ? "보낼 말이 없다. (미래가 먼저 말 걸면 여기서 답장)" : r === "kim" ? "답장 기능이 차단된 채팅방입니다 (김사장 측 설정)" : "형한테 답장해 봤자 '형 나 믿지?'만 옴"}</div>`;
  return `<div class="kk"><div class="krooms"><div class="khd">💬 채팅 <kbd>Tab</kbd></div>${Object.keys(KROOM).map(k => { const m = S.kk[k][S.kk[k].length - 1]; return `<button class="kroom ${k === r ? "on" : ""}" data-a="room" data-v="${k}" data-bot="k-room-${k}"><span class="av">${KROOM[k].ic}</span><span class="kn"><b>${KROOM[k].n}</b><small>${m ? esc(m.x) : KROOM[k].sub}</small></span>${S.kun[k] ? `<i>${S.kun[k]}</i>` : ""}</button>`; }).join("")}
      <div class="khint">💡 형나믿지 찌라시 적중률 ${rec("형나믿지")}${S.galFame >= FAME.dm ? ` · 수학자 ${rec("수학자")}` : ` · 명성 ${FAME.dm} 되면 '수학자 정보' DM 해금`}</div></div>
    <div class="kchat r-${r}"><div class="kchd"><span class="av">${R.ic}</span><b>${R.n}</b><small>${R.sub}</small></div><div class="kmsgs">${msgs || `<div class="kb sys">대화 없음</div>`}</div>${reply}</div></div>`;
}
/* ---------- 주갤 ---------- */
function phGall() {
  const tab = PH.gtab, rk = rankOf(S.galFame), nx = RANKS.find(x => x[0] > S.galFame);
  let list = S.posts.slice().reverse();
  if (tab === "best") list = list.filter(p => p.best); else if (tab === "mine") list = list.filter(p => p.mine);
  if (PH.gsel == null || !postById(PH.gsel)) PH.gsel = list[0] ? list[0].id : null;
  const rows = list.map(p => `<button class="gr ${p.id === PH.gsel && !PH.gw ? "on" : ""} ${p.mine ? "mine" : ""}" data-a="gpost" data-v="${p.id}" data-bot="g-post-${p.id}"><span class="gt t-${p.tag}">${p.tag}</span><span class="gti">${p.best ? "🔥 " : ""}${esc(p.title)}${p.cm.length ? ` <em>[${p.cm.length}]</em>` : ""}${p.pd ? ` <i class="no">🪤펌프앤덤프</i>` : p.res === 1 ? ` <i class="ok">✅적중</i>` : p.res === -1 ? ` <i class="no">❌빗나감</i>` : ""}${p.pend ? ` <i class="pd">반응 대기</i>` : ""}</span><span class="gau ${p.au === "ㅇㅇ" ? "ip" : ""}">${nickIc(p.au)}${esc(p.au)}</span><span class="gup">${p.up}</span></button>`).join("");
  const right = PH.gw ? gWriter() : PH.gsel != null ? gDetail(postById(PH.gsel)) : `<div class="gempty">글이 없음. 갤이 조용함 (폭풍 전야)</div>`;
  const wl = WRITE_MAX - wroteToday();
  return `<div class="gall"><div class="ghd"><b>📈 주식 갤러리</b><span class="gtabs"><kbd>Tab</kbd>${[["all", "전체글"], ["best", "개념글"], ["mine", "내 글"]].map(([k, l]) => `<button class="${tab === k ? "on" : ""}" data-a="gtab" data-v="${k}" data-bot="g-tab-${k}">${l}${k === "mine" && S.gReact ? ` <i>${S.gReact}</i>` : ""}</button>`).join("")}</span>
      <span class="gme">💘 알바감남친 · 명성 <b>${S.galFame}</b> · ${rk[1]}${nx ? ` <small>(다음: ${nx[1]} ${nx[0]})</small>` : ""}</span><button class="gwb" data-a="gwrite" data-bot="g-write" ${wl <= 0 ? "disabled" : ""}>✏️ 글쓰기 <kbd>N</kbd> <small>오늘 ${wl}/${WRITE_MAX}</small></button></div>
    <div class="gbody"><div class="glist" data-keep="gl"><div class="grh"><span>말머리</span><span>제목</span><span>글쓴이</span><span>추천</span></div>${rows || `<div class="gempty">${tab === "mine" ? "아직 쓴 글 없음. ✏️ 글쓰기로 손절 인증 ㄱ (갤러들은 잃을수록 좋아함)" : tab === "best" ? "개념글 없음 (추천 50↑)" : "글 없음"}</div>`}</div>
    <div class="gside" data-keep="gd">${right}</div></div></div>`;
}
function gDetail(p) {
  if (!p) return "";
  const g = GN[p.au];
  const tip = p.tip && S.tips.find(t => t.id === p.tip);
  return `<div class="gdet"><div class="gdh"><span class="gt t-${p.tag}">${p.tag}</span><h3>${p.best ? "🔥 " : ""}${esc(p.title)}</h3>
    <div class="gmeta"><b class="${p.au === "ㅇㅇ" ? "ip" : ""}">${nickIc(p.au)} ${esc(p.au)}${p.au === "ㅇㅇ" ? `(${110 + p.id * 37 % 120}.${10 + p.id * 13 % 80})` : ""}</b>${g ? `<span class="grec">찌라시 기록 ${rec(p.au)}</span><span class="gdesc">${g.d}</span>` : ""}<span>${p.lab}</span></div></div>
    ${tip ? `<div class="gres">${tipCard(tip)}</div>` : ""}
    <div class="gtx">${esc(p.body).replace(/\n/g, "<br>")}</div>
    <div class="gvote"><button data-a="gup" data-v="${p.id}" data-bot="g-up" ${p.myUp || p.mine ? "disabled" : ""}>👍 개추 <b>${p.up}</b> <kbd>G</kbd></button><button disabled>👎 비추 <b>${p.dn}</b></button>${p.mine && p.pend ? `<span class="gwait">다음 칸에 추천·댓글이 달림</span>` : p.mine && p.fm ? `<span class="gwait">명성 ${p.fm > 0 ? "+" : ""}${p.fm}</span>` : ""}</div>
    <div class="gcms"><div class="gch">댓글 ${p.cm.length}</div>${p.cm.map(c => `<div class="gc ${c.res ? "rc" : ""} ${c.tipc ? "tipc" : ""}"><b class="${c.au === "ㅇㅇ" ? "ip" : ""}">${nickIc(c.au)}${esc(c.au)}</b><span>${esc(c.x)}</span><small>↑${c.up}</small></div>`).join("") || `<div class="gc dim">${p.pend ? "아직 댓글 없음… (다음 칸에 달림)" : "댓글 없음"}</div>`}</div></div>`;
}
function gWriter() {
  const k = PH.gw, d = q("draft", k);
  return `<div class="gw"><h3>✏️ 글쓰기 <small>템플릿 고르면 본문은 실제 상황으로 자동 작성 · 오늘 ${WRITE_MAX - wroteToday()}/${WRITE_MAX}</small></h3>
    <div class="gwt">${GW.map(t => `<button class="${t.k === k ? "on" : ""}" data-a="gwk" data-v="${t.k}" data-bot="gw-${t.k}"><span>${t.ic}</span><b>${t.l}</b><small>${t.d}</small></button>`).join("")}</div>
    <div class="gwp"><div class="gwh"><span class="gt t-${d.tag}">${d.tag}</span><b>${esc(d.title)}</b></div><div class="gtx">${esc(d.body).replace(/\n/g, "<br>")}</div></div>
    <div class="gwn ${d.ok ? "" : "warn"}">${esc(d.why)}</div>
    <div class="gwa"><button class="btn" data-a="gwrite" data-bot="gw-cancel">취소</button><button class="btn pri" data-a="gwpost" data-bot="gw-post" ${wroteToday() >= WRITE_MAX ? "disabled" : ""}>등록</button></div>
    <div class="gwr">📜 명성 규칙: 개념글(추천 50↑) 가면 명성↑ · <b>손절 인증·대박 인증이 제일 많이 오름</b> (잃을수록 인기) · 근거 없는 인증 = 주작 → 명성 −3<br>등급: ${RANKS.map(r => `${r[1]} ${r[0]}${r[2] ? ` <small>(${r[2]})</small>` : ""}`).join(" · ")} · 명성 ${FAME.gall}↑면 파산 시 '갤 운영자' 루트</div></div>`;
}
/* ---------- 개미증권 ---------- */
function phStock() {
  const where = PH.where, fee = q("stockFee", where), tab = PH.stab;
  const hv = q("holdVal"), pl = unreal();
  const head = `<div class="shd"><b>🐜 개미증권 ${where === "broker" ? `<i class="tag2">창구 · 주식 수수료 ${(fee * 100).toFixed(1)}%</i>` : `<i class="tag2">앱 · 슬롯 소모 없음 · 수수료 ${(fee * 100).toFixed(1)}%</i>`}</b>
    <span class="stabs"><kbd>Tab</kbd>${[["mkt", "시세"], ["detail", "종목 상세·주문"], ["rsch", "🏦 리서치"], ["acct", "내 계좌"]].map(([k, l]) => `<button class="${tab === k ? "on" : ""}" data-a="stab" data-v="${k}" data-bot="st-tab-${k}">${l}</button>`).join("")}</span>
    <span class="ssum">현금 <b>${won(S.cash)}</b> · 평가 <b>${won(hv)}</b>${hasPos() ? ` <b class="${pl >= 0 ? "up" : "dn"}">${sgnWon(pl)}</b>` : ""} · <span class="${stockOpen() ? "up" : "dim"}">${stockOpen() ? "● 주식 장 열림" : "○ 주식 장 마감 (오전·오후만)"}</span> · 코인 24시간</span></div>`;
  return `<div class="stk">${head}<div class="sbody">${tab === "mkt" ? stMkt() : tab === "acct" ? stAcct() : tab === "rsch" ? stRsch() : stDetail()}</div></div>`;
}
function stRsch() {
  const R = q("rsch"), reps = S.tips.filter(t => t.tier === "rep").slice().reverse();
  return `<div class="srs"><div class="srh"><div><b>🏦 개미증권 리서치센터</b><small>리포트 = 저위험 정보. 신뢰 ${stars(4)} · 리턴 ${stars(1)} · 가끔 '이미 선반영'(방향은 맞는데 거의 안 움직임)${has("vip") ? " · 🎩 VIP: 무료 2개 + 적중↑" : ""}</small></div>
    <button class="btn pri" data-a="rfree" data-bot="r-free" ${R.free >= q("freeMax") ? "disabled" : ""}>📄 오늘의 무료 리포트 (${R.free}/${q("freeMax")})</button><button class="btn" data-a="rpaid" data-bot="r-paid" ${R.paid >= 2 || S.cash < RU.RSCH_FEE ? "disabled" : ""}>💳 유료 리포트 ${man(RU.RSCH_FEE)}원 (${R.paid}/2)</button></div>
    <div class="tmsg">${PH.msg}</div><div class="srsl">리서치·박대리 성적: <b>${rec("리서치")}</b> · <b>${rec("박대리")}</b></div>
    <div class="tcards col" data-keep="rs">${reps.map(t => tipCard(t, 1)).join("") || `<div class="dim" style="padding:14px">받은 리포트 없음. 증권사(박대리)에 가도 1~2개 줌</div>`}</div></div>`;
}
function posOf(k) { const h = S.hold[k]; const cs = S.cps.filter(c => c.tk === k); let v = 0; if (h) v += h.q * S.mk[k].p - h.cost; cs.forEach(c => v += q("cpnl", c) + (c.bonus || 0)); return (h || cs.length) ? v : null; }
function stMkt() {
  return `<div class="smkt">${TKS.map(k => { const t = TK[k], m = S.mk[k], l = m.hist[m.hist.length - 1], r = l.c / l.o - 1, lk = !tkOpen(k), po = posOf(k), d5 = m.hist.length > 5 ? m.p / m.hist[m.hist.length - 5].o - 1 : 0;
    return `<button class="sc ${lk ? "lk" : ""}" data-a="tsel" data-v="${k}" data-bot="t-sel-${k}"><div class="sct"><span class="ic">${t.ic}</span><b>${t.name}</b><span class="ty ${t.type}">${t.type === "coin" ? "코인" : "주식"}</span>${po != null ? `<span class="po ${po >= 0 ? "up" : "dn"}">보유 ${sgnMan(po)}</span>` : ""}</div>
      ${lk ? `<div class="sclk">🔒 '밈코인 감별사' 증강 필요</div>` : `<div class="scp"><span>${fmtP(m.p)}</span><b class="${r >= 0 ? "up" : "dn"}">${pct(r)}</b></div><div class="scs">${spark(m.hist, 380, 92)}</div><div class="scd">${esc(t.d)} · 4칸 ${pct(d5)}</div>`}</button>`; }).join("")}
    <div class="sintel"><b>📡 받은 정보 (진행 중) <small>· 전체 기록은 📰 뉴스 → 📒 정보 수첩</small></b>${tipIntel()}</div></div>`;
}
function stDetail() {
  const sel = PH.sel = TK[PH.sel || PH.tsel] && tkOpen(PH.sel || PH.tsel) ? (PH.sel || PH.tsel) : "GSE";
  PH.tsel = sel;
  const t = TK[sel], m = S.mk[sel], isC = t.type === "coin", fee = q("stockFee", PH.where);
  const last = m.hist[m.hist.length - 1], chg = last.c / last.o - 1;
  if (isC && PH.lev > t.maxLev) PH.lev = t.maxLev;
  const lev = PH.lev, dir = PH.dir;
  const maxAmt = Math.max(0, Math.floor((isC ? S.cash / (1 + lev * RU.COIN_FEE) : S.cash) / 10000) * 10000);
  if (PH.amt == null) PH.amt = Math.round(maxAmt * 0.25 / 10000) * 10000;
  PH.amt = clamp(PH.amt, 0, maxAmt); const amt = PH.amt;
  const h = S.hold[sel], hv = h ? h.q * m.p : 0;
  const levs = [1, 2, 3, 5, 10, 25, 50].filter(l => l <= t.maxLev);
  const allin = has("allin") && amt * (1 + lev * RU.COIN_FEE) >= S.cash * 0.95 ? 1.5 : 1;
  const estLiq = m.p * (1 - dir * 0.9 / (lev * allin));
  const order = isC ? `<div class="oh">🪙 코인 주문 <small>24시간 · 진입한 칸엔 정리 불가</small></div>
      <div class="oamt"><span id="tAmtV">${won(amt)}</span><small>증거금</small></div>
      <input type="range" id="tAmt" min="0" max="${maxAmt}" step="10000" value="${amt}" ${maxAmt < 10000 ? "disabled" : ""}>
      <div class="qrow">${[[.1, "10%"], [.25, "25%"], [.5, "50%"], [1, "최대"]].map(([q, l]) => `<button class="btn sm" data-a="tq" data-v="${q}" data-bot="t-q${Math.round(q * 100)}">${l}</button>`).join("")}</div>
      <div class="seg levs">${levs.map(l => `<button data-a="tlev" data-v="${l}" data-bot="t-lev${l}" class="${l === lev ? "on" : ""}">${l}x</button>`).join("")}</div>
      <div class="seg"><button class="long ${dir > 0 ? "on" : ""}" data-a="tdir" data-v="1" data-bot="t-long">롱 📈</button><button class="short ${dir < 0 ? "on" : ""}" data-a="tdir" data-v="-1" data-bot="t-short">숏 📉</button></div>
      <div class="onote">청산가 ≈ <b>${fmtP(estLiq)}</b> (${(90 / lev).toFixed(1)}% 역행)${lev > 1 ? `<br><b style="color:#ff4d5e">💀 이번 칸 청산 확률 ≈ ${Math.round(q("liqOdds", lev * allin, t.vol * (S.slot === 3 && has("whale") ? 2 : 1)) * 100)}%</b> (칸 중간 꼬리에도 청산)` : ""}<br>수수료 ${won(amt * lev * RU.COIN_FEE)}${lev > 1 ? ` · 펀딩비 칸당 ${won(amt * lev * RU.FUNDING)}` : ""}${has("kimp") && dir > 0 && S.kimpDay !== absDay() ? " · 🌶️김프 +5% (오늘 첫 롱)" : ""}${has("allin") ? " · 🎲95%↑ 넣으면 ×1.5" : ""}</div>
      <button class="btn pri2" data-a="topen" data-bot="t-open" ${amt < 10000 ? "disabled" : ""}>${dir > 0 ? "롱" : "숏"} ${lev}x 진입 <kbd>B</kbd></button>`
    : `<div class="oh">📊 주식 주문 ${stockOpen() ? `<small>장 열림 · 수수료 ${(fee * 100).toFixed(1)}%</small>` : `<small class="dn">장 마감 (오전·오후만)</small>`}</div>
      <div class="oamt"><span id="tAmtV">${won(amt)}</span><small>매수 금액</small></div>
      <input type="range" id="tAmt" min="0" max="${maxAmt}" step="10000" value="${amt}" ${maxAmt < 10000 || !stockOpen() ? "disabled" : ""}>
      <div class="qrow">${[[.1, "10%"], [.25, "25%"], [.5, "50%"], [1, "전부"]].map(([q, l]) => `<button class="btn sm" data-a="tq" data-v="${q}" data-bot="t-q${Math.round(q * 100)}" ${stockOpen() ? "" : "disabled"}>${l}</button>`).join("")}</div>
      <button class="btn pri2" data-a="tbuy" data-bot="t-buy" ${amt < 10000 || !stockOpen() ? "disabled" : ""}>매수 <kbd>B</kbd></button>
      <div class="onote">${h ? `보유 ${h.q.toFixed(h.q < 10 ? 2 : 0)}주 · 평단 ${fmtP(h.cost / h.q)}<br>평가 ${won(hv)} <b class="${hv >= h.cost ? "up" : "dn"}">${sgnWon(hv - h.cost)}</b> · ${Tnow() - h.t0}칸 보유` : "보유 없음"}</div>
      <div class="qrow"><button class="btn sm" data-a="tsellh" data-bot="t-sellhalf" ${h && stockOpen() ? "" : "disabled"}>절반 매도</button><button class="btn sm" data-a="tsella" data-bot="t-sellall" ${h && stockOpen() ? "" : "disabled"}>전량 매도 <kbd>S</kbd></button></div>`;
  const cps = S.cps.filter(c => c.tk === sel);
  return `<div class="sdet"><div class="sstrip">${TKS.map(k => { const mm = S.mk[k], l = mm.hist[mm.hist.length - 1], r = l.c / l.o - 1, lk = !tkOpen(k); return `<button class="${k === sel ? "on" : ""} ${lk ? "lk" : ""}" data-a="tsel" data-v="${k}" data-bot="t-sel-${k}" ${lk ? "disabled" : ""}>${TK[k].ic} ${TK[k].name} <b class="${r >= 0 ? "up" : "dn"}">${lk ? "🔒" : pct(r)}</b></button>`; }).join("")}</div>
    <div class="sdm"><div class="sleft"><div class="thd"><span>${t.ic} <b>${t.name}</b> <small>${isC ? "코인" : "주식"}</small></span><span class="px">${fmtP(m.p)}</span><span class="${chg >= 0 ? "up" : "dn"}">${pct(chg)}</span></div>
      <div class="tdesc">${esc(t.d)}</div><canvas id="tCv" width="2160" height="820"></canvas><div class="intel">${tipIntel(sel)}</div>
      ${cps.length ? `<div class="scps">${cps.map(c => cRow(c)).join("")}</div>` : ""}</div>
    <div class="tord">${order}<div class="tmsg">${PH.msg}</div></div></div></div>`;
}
function cRow(c) { const pl = q("cpnl", c) + (c.bonus || 0), lk = c.t0 === Tnow(); return `<div class="prow2"><span>${TK[c.tk].ic} ${TK[c.tk].name} <b class="${c.dir > 0 ? "up" : "dn"}">${c.lev}x ${c.dir > 0 ? "롱" : "숏"}</b>${c.mult > 1 ? " 🎲" : ""}</span><span>증거금 ${man(c.margin)} · 청산가 ${fmtP(q("liqPx", c))}</span><b class="${pl >= 0 ? "up" : "dn"}">${sgnWon(pl)}</b><button class="btn sm" data-a="tclose" data-v="${c.id}" data-bot="t-close-${c.id}" ${lk ? "disabled" : ""}>${lk ? "다음 칸부터" : "정리"}</button></div>`; }
function stAcct() {
  const hv = q("holdVal"), pl = unreal(), tot = S.realized + pl, ret = S.invIn ? tot / S.invIn : 0;
  const rows = STK.filter(k => S.hold[k]).map(k => { const x = S.hold[k], v = x.q * S.mk[k].p; return `<div class="prow2"><span>${TK[k].ic} ${TK[k].name} <small>주식</small></span><span>${man(x.cost)} → ${man(v)} · ${Tnow() - x.t0}칸 보유</span><b class="${v >= x.cost ? "up" : "dn"}">${sgnWon(v - x.cost)}</b><button class="btn sm" data-a="tsell" data-v="${k}" data-bot="t-sell-${k}" ${stockOpen() ? "" : "disabled"}>${stockOpen() ? "전량 매도" : "장 마감"}</button></div>`; }).concat(S.cps.map(cRow));
  return `<div class="sacct"><div class="acards"><div><small>현금</small><b>${won(S.cash)}</b></div><div><small>평가액</small><b>${won(hv)}</b></div><div><small>평가손익 (미실현)</small><b class="${pl >= 0 ? "up" : "dn"}">${sgnWon(pl)}</b></div><div><small>실현손익 누적</small><b class="${S.realized >= 0 ? "up" : "dn"}">${sgnWon(S.realized)}</b></div><div><small>투입금 대비 수익률</small><b class="${ret >= 0 ? "up" : "dn"}">${pct(ret)}</b></div></div>
    <div class="aeq"><div class="aeh">📈 누적 투자손익 (실현+평가, 칸마다) <small>투입 원금 누적 ${won(S.invIn)} · 펀딩비·수수료 포함</small></div><canvas id="eqCv" width="2200" height="420"></canvas></div>
    <div class="apos"><div class="ph">보유 포지션 ${S.cps.some(c => c.t0 !== Tnow()) ? `<button class="btn sm" data-a="tcloseall" data-bot="t-closeall">코인 전부 정리</button>` : ""}</div>${rows.length ? rows.join("") : `<div class="dim" style="padding:10px">없음. 미래: "현금 들고 있으면 인플레이션한테 지는 거임" (빚은 더 빨리 큼)</div>`}<div class="tmsg">${PH.msg}</div></div></div>`;
}
function phStockDraw() {
  const cv = $("#tCv"); if (cv) drawTk(cv, PH.sel);
  const e = $("#eqCv"); if (e) drawEq(e);
}
function drawEq(cv) {
  const ctx = cv.getContext("2d"), W = cv.width, H = cv.height, pts = S.eqh.concat([{ T: Tnow(), v: S.realized + unreal() }]);
  ctx.fillStyle = "#0d0f16"; ctx.fillRect(0, 0, W, H);
  ctx.font = "26px 'Noto Sans KR',sans-serif"; ctx.fillStyle = "#6b7186";
  if (pts.length < 2) { ctx.fillText("아직 기록 없음 — 칸이 지나면 그려짐", 40, H / 2); return; }
  let lo = Math.min(0, ...pts.map(p => p.v)), hi = Math.max(0, ...pts.map(p => p.v)); if (hi - lo < 1e5) { hi += 5e4; lo -= 5e4; }
  const pad = 40, X = i => pad + i / (pts.length - 1) * (W - pad * 2 - 160), Y = v => pad + (hi - v) / (hi - lo) * (H - pad * 2);
  ctx.strokeStyle = "#2e3346"; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(pad, Y(0)); ctx.lineTo(W - pad - 160, Y(0)); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillText("0", W - pad - 150, Y(0) + 8); ctx.fillText(sgnMan(hi), W - pad - 150, Y(hi) + 20); ctx.fillText(sgnMan(lo), W - pad - 150, Y(lo));
  const last = pts[pts.length - 1].v;
  ctx.strokeStyle = last >= 0 ? "#ff4d5e" : "#4e8cff"; ctx.lineWidth = 6; ctx.lineJoin = "round"; ctx.beginPath();
  pts.forEach((p, i) => i ? ctx.lineTo(X(i), Y(p.v)) : ctx.moveTo(X(i), Y(p.v))); ctx.stroke();
  ctx.lineTo(X(pts.length - 1), Y(0)); ctx.lineTo(X(0), Y(0)); ctx.closePath(); ctx.fillStyle = last >= 0 ? "rgba(255,77,94,.12)" : "rgba(78,140,255,.12)"; ctx.fill();
}
/* ---------- 뉴스·알림 ---------- */
function phNews() {
  const tab = PH.ntab || "feed";
  const rows = S.feed.slice().reverse().map(f => `<div class="nf k-${f.kind}"><span class="ic">${f.ic}</span><div><b>${esc(f.x)}</b>${f.rows ? `<div class="nrows">${f.rows.map(r => `<span>${esc(r)}</span>`).join("")}</div>` : ""}</div><small>${f.lab}</small></div>`).join("");
  return `<div class="news"><div class="nhd"><b>📰 뉴스·알림</b><span class="stabs"><kbd>Tab</kbd>${[["feed", "알림"], ["book", "📒 정보 수첩"]].map(([k, l]) => `<button class="${tab === k ? "on" : ""}" data-a="ntab" data-v="${k}" data-bot="n-tab-${k}">${l}</button>`).join("")}</span><small>뉴스 · 청산 · 배당 · 이자 · 정보 · 갤 반응 기록</small></div>
    ${tab === "book" ? phNotebook() : `<div class="nlist" data-keep="nl">${rows || `<div class="dim" style="padding:20px">아직 아무 일도 없음</div>`}</div>`}</div>`;
}
/* ---------- 입력 (위임) ---------- */
const evOf = (evs, t) => evs.find(e => e.t === t) || {};
function phAct(a, v) {
  const t = PH.sel && TK[PH.sel], where = PH.where;
  switch (a) {
    case "close": closePhone(); return;
    case "app": PH.app = v; PH.msg = ""; PH.gw = null; break;
    case "room": PH.app = "kakao"; PH.room = v; break;
    case "kr": sendQuick({ t: "kqReply", i: +v }); break;
    case "gtab": PH.gtab = v; PH.gw = null; PH.gsel = null; break;
    case "gpost": PH.app = "gall"; PH.gsel = +v; PH.gw = null; break;
    case "gup": sendQuick({ t: "upvote", id: +v }); break;
    case "gwrite": PH.gw = PH.gw ? null : (q("todayPnl") <= -50000 || q("todayLiq") ? "loss" : q("todayPnl") >= 50000 ? "gain" : "gf"); break;
    case "gwk": PH.gw = v; break;
    case "gwpost": { if (!PH.gw || wroteToday() >= WRITE_MAX) return; const e = evOf(sendQuick({ t: "post", k: PH.gw }), "posted"); if (e.id) { PH.gw = null; PH.gsel = e.id; PH.gtab = "mine"; } break; }
    case "stab": PH.stab = v; PH.msg = ""; break;
    case "ntab": PH.ntab = v; break;
    case "rfree": case "rpaid": { const e = evOf(sendQuick({ t: "report", paid: a === "rpaid" }), "report"); const tp = e.ok && S.tips.find(x => x.id === e.id); PH.msg = tp ? `📄 리포트: ${TK[tp.tk].name} ${tp.dir > 0 ? "▲" : "▼"} · ${q("whenLabel", tp.Tr)}` : a === "rpaid" ? "❌ 오늘 유료 리포트 끝 (또는 현금 부족)" : "❌ 오늘 무료 리포트 다 씀"; break; }
    case "tsel": PH.sel = v; PH.stab = "detail"; PH.amt = null; PH.msg = ""; break;
    case "tq": { const isC = t.type === "coin", mx = Math.max(0, Math.floor((isC ? S.cash / (1 + PH.lev * RU.COIN_FEE) : S.cash) / 10000) * 10000); PH.amt = Math.floor(mx * +v / 10000) * 10000; break; }
    case "tlev": PH.lev = +v; if (PH.lev >= 25) bubble(PH.lev === 50 ? "50배!!! 자기 최고야 사랑해" : "오 좀 치네?", 1800, "happy"); break;
    case "tdir": PH.dir = +v; break;
    case "tbuy": { const e = evOf(sendQuick({ t: "buy", tk: PH.sel, amt: PH.amt, where }), "trade"); PH.msg = e.ok ? `✅ ${t.name} ${won(e.amt)} 매수` : "❌ 매수 실패"; if (e.ok) bubble(fpick(["가즈아", "이건 우상향이다 (희망)", "평단 박았다"]), 1500, "smug"); PH.amt = null; break; }
    case "tsellh": { const e = evOf(sendQuick({ t: "sell", tk: PH.sel, frac: 0.5, where }), "trade"); PH.msg = !e.ok ? "❌" : `💰 절반 매도 ${sgnWon(e.pnl)}`; break; }
    case "tsella": case "tsell": { const k = a === "tsell" ? v : PH.sel; const e = evOf(sendQuick({ t: "sell", tk: k, frac: 1, where }), "trade"); PH.msg = !e.ok ? "❌" : `💰 ${TK[k].name} 전량 매도 ${sgnWon(e.pnl)} = ${conv(e.pnl)}`; if (e.ok) bubble(e.pnl >= 0 ? "익절은 과학이다" : "손절도 과학이다 (눈물)", 1600, e.pnl >= 0 ? "happy" : "cry"); break; }
    case "topen": { const e = evOf(sendQuick({ t: "open", tk: PH.sel, dir: PH.dir, lev: PH.lev, amt: PH.amt }), "trade"); PH.msg = e.ok ? `✅ ${t.name} ${e.lev}x ${PH.dir > 0 ? "롱" : "숏"} 진입 · 증거금 ${won(e.margin)}` : "❌ 진입 실패 (현금 부족)"; if (e.ok) bubble(PH.dir > 0 ? "롱 가즈아아아 🚀" : "숏 잡았다. 떨어져라 떨어져라", 1800, "smug"); PH.amt = null; break; }
    case "tclose": { const e = evOf(sendQuick({ t: "close", id: +v }), "trade"); PH.msg = !e.ok ? "❌" : `💰 ${TK[e.tk].name} 정리 ${sgnWon(e.pnl)} = ${conv(e.pnl)}`; if (e.ok) bubble(e.pnl >= 0 ? "익절 ㅋㅋ 나 천재?" : "…손절. 괜찮아. 괜찮아.", 1600, e.pnl >= 0 ? "happy" : "cry"); break; }
    case "tcloseall": { const e = evOf(sendQuick({ t: "closeCoins" }), "trade"); PH.msg = `💰 코인 정리 ${sgnWon(e.pnl || 0)}`; break; }
  }
  updHud(); phR();
}
$("#phoneOv").addEventListener("click", e => {
  e.stopPropagation();
  if (e.target.id === "phoneOv") { closePhone(); return; }
  const b = e.target.closest("[data-a]"); if (!b || b.disabled) return;
  phAct(b.dataset.a, b.dataset.v);
});
$("#phoneOv").addEventListener("input", e => {
  if (e.target.id !== "tAmt") return;
  PH.amt = +e.target.value; const v = $("#tAmtV"); if (v) v.textContent = won(PH.amt);
  const b = $("#phoneOv [data-a=topen]") || $("#phoneOv [data-a=tbuy]"); if (b) b.disabled = PH.amt < 10000 || (TK[PH.sel].type !== "coin" && !stockOpen());
});
$("#phoneOv").addEventListener("change", e => { if (e.target.id === "tAmt") { PH.amt = +e.target.value; phR(); } });
function phoneKey(e) {
  if (e.key === "Escape" || e.key === "p" || e.key === "P") { closePhone(); return true; }
  if (/^[0-4]$/.test(e.key)) { PH.app = APPS[+e.key][0]; PH.gw = null; phR(); return true; }
  if (e.key === "Backspace") { PH.app = "home"; phR(); return true; }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, a = PH.app, cyc = (L, v) => L[(L.indexOf(v) + 1) % L.length];
  const click = sel => { const b = $("#phoneOv " + sel); if (b && !b.disabled) b.click(); };
  if (a === "kakao") { if (k === "Tab") { PH.room = cyc(["m", "kim", "hy"], PH.room); phR(); } else if ("qwe".includes(k) && k.length === 1) click(`[data-bot=kr-${"qwe".indexOf(k)}]`); }
  if (a === "gall") {
    if (k === "Tab") { PH.gtab = cyc(["all", "best", "mine"], PH.gtab); PH.gsel = null; PH.gw = null; phR(); }
    else if (k === "n") click("[data-bot=g-write]"); else if (k === "g") click("[data-bot=g-up]");
    else if (PH.gw && (k === "ArrowLeft" || k === "ArrowRight")) { const L = GW.map(x => x.k), i = L.indexOf(PH.gw); PH.gw = L[(i + (k === "ArrowRight" ? 1 : L.length - 1)) % L.length]; phR(); }
    else if (PH.gw && k === "Enter") click("[data-bot=gw-post]");
    else if (k === "ArrowDown" || k === "ArrowUp") { const rows = [...document.querySelectorAll("#phoneOv .gr")], i = rows.findIndex(r => r.classList.contains("on")), j = clamp(i + (k === "ArrowDown" ? 1 : -1), 0, rows.length - 1); if (rows[j]) rows[j].click(); }
  }
  if (a === "stock") {
    if (k === "Tab") { PH.stab = cyc(["mkt", "detail", "rsch", "acct"], PH.stab); PH.msg = ""; phR(); }
    else if ((k === "ArrowLeft" || k === "ArrowRight") && PH.stab === "detail") { const L = TKS.filter(tkOpen), i = L.indexOf(PH.sel); PH.sel = L[(i + (k === "ArrowRight" ? 1 : L.length - 1)) % L.length]; PH.amt = null; phR(); }
    else if (k === "b") click("[data-bot=t-buy],[data-bot=t-open]"); else if (k === "s") click("[data-bot=t-sellall]");
  }
  if (a === "news" && k === "Tab") { PH.ntab = PH.ntab === "book" ? "feed" : "book"; phR(); }
  return true;   // 폰 열려 있으면 다른 키는 게임으로 안 넘김
}
function drawTk(cv, tk) {
  const ctx = cv.getContext("2d"), Wd = cv.width, Ht = cv.height, m = S.mk[tk], bars = m.hist.slice(-24);
  const padL = 14, padR = 170, padT = 24, padB = 24;
  ctx.fillStyle = "#0d0f16"; ctx.fillRect(0, 0, Wd, Ht);
  let lo = Math.min(...bars.map(b => b.l)), hi = Math.max(...bars.map(b => b.h));
  const lines = [];
  S.cps.filter(c => c.tk === tk).slice(0, 2).forEach(c => { lines.push({ y: c.entry, c: "#ffd166", l: `진입 ${c.lev}x` }); if (c.lev * c.mult > 1.2) lines.push({ y: q("liqPx", c), c: "#ff3b4f", l: "청산가" }); });
  if (S.hold[tk]) lines.push({ y: S.hold[tk].cost / S.hold[tk].q, c: "#ffd166", l: "평단" });
  lines.forEach(L => { lo = Math.min(lo, L.y); hi = Math.max(hi, L.y); });
  const span = Math.max(hi - lo, bars[0].o * 0.01); const mid = (hi + lo) / 2; lo = mid - span * .56; hi = mid + span * .56;
  const Y = v => padT + (hi - v) / (hi - lo) * (Ht - padT - padB), cw = (Wd - padL - padR) / 24;
  ctx.strokeStyle = "#1c2030"; ctx.lineWidth = 2; ctx.fillStyle = "#6b7186"; ctx.font = "22px ui-monospace,Menlo,monospace";
  for (let k = 0; k <= 4; k++) { const y = padT + k * (Ht - padT - padB) / 4; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(Wd - padR, y); ctx.stroke(); ctx.fillText(fmtP(hi - k * (hi - lo) / 4), Wd - padR + 8, y + 7); }
  bars.forEach((b, k) => {
    const x = padL + k * cw + cw / 2, col = b.c >= b.o ? "#ff4d5e" : "#4e8cff";
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, Y(b.h)); ctx.lineTo(x, Y(b.l)); ctx.stroke();
    const y1 = Y(Math.max(b.o, b.c)), y2 = Y(Math.min(b.o, b.c)); ctx.fillRect(x - cw * .34, y1, cw * .68, Math.max(3, y2 - y1));
  });
  lines.forEach(L => { ctx.strokeStyle = L.c; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ctx.beginPath(); ctx.moveTo(padL, Y(L.y)); ctx.lineTo(Wd - padR, Y(L.y)); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = L.c; ctx.font = "bold 24px 'Noto Sans KR',sans-serif"; ctx.fillText(L.l, padL + 8, Y(L.y) - 8); });
  const lc = m.p; ctx.fillStyle = "#e8eaf2"; ctx.fillRect(Wd - padR + 2, Y(lc) - 18, padR - 4, 36); ctx.fillStyle = "#111"; ctx.font = "bold 22px ui-monospace,Menlo,monospace"; ctx.fillText(fmtP(lc), Wd - padR + 8, Y(lc) + 8);
  ctx.fillStyle = "#4a5070"; ctx.font = "18px 'Noto Sans KR',sans-serif"; ctx.fillText("1봉 = 1슬롯", padL + 6, Ht - 6);
}
/* ---------- 정보 카드 · 정보 수첩 (v3.2 info.js 의 화면 부분) ---------- */
const srcOf = t => q("srcOf", t), resMark = r => q("resMark", r), whenLabel = Tr => q("whenLabel", Tr), activeTips = tk => q("activeTips", tk), TIER_NM = DATA.TIER_NM, SRC = DATA.SRC;
function tipCard(t, wide) {
  const d = srcOf(t);
  return `<div class="tcard tr-${t.tier} ${t.res ? "r-" + t.res : ""} ${wide ? "wide" : ""}"><span class="tsrc">${d.ic} ${esc(d.name)}${t.via === "sub" ? " · 구독" : ""}</span><span class="tst">신뢰 <i>${stars(d.trust)}</i> 리턴 <i>${stars(d.ret)}</i></span>
    <b class="${t.dir > 0 ? "up" : "dn"}">${TK[t.tk].ic} ${TK[t.tk].name} ${t.dir > 0 ? "▲ 오른다" : "▼ 내린다"}</b><span class="twhen">${t.res ? `${resMark(t.res)}${t.rr != null ? ` (${pct(t.rr)})` : ""}` : `⏰ ${whenLabel(t.Tr)}`}</span></div>`;
}
function tipIntel(tk) {
  const L = activeTips(tk).slice(-4).map(t => tipCard(t));
  if (S.whale && S.whale.T === Tnow() && (!tk || tk === S.whale.tk)) L.push(`<div class="tcard tr-walk"><span class="tsrc">🐋 새벽 고래</span><b class="${S.whale.dir > 0 ? "up" : "dn"}">${TK[S.whale.tk].name} ${S.whale.dir > 0 ? "▲ 매집" : "▼ 투매"}</b><span class="twhen">이번 칸 · 70%</span></div>`);
  return L.length ? `<div class="tcards">${L.join("")}</div>` : `<div class="dim">정보 없음. 감으로 하는 거임 (주식은 감이면 반반 · 정보는 증권사·갤·길거리에서)</div>`;
}
function phNotebook() {
  const whos = Object.keys(S.srcStat).concat(S.tips.map(t => t.who)).filter((x, i, a) => a.indexOf(x) === i);
  const rows = whos.map(w => { const d = SRC[w], g = S.srcStat[w] || [0, 0]; return `<div class="nbs"><span>${d.ic} ${esc(d.name)}</span><small>${TIER_NM[d.tier]}</small><span>신뢰 ${stars(d.trust)}</span><span>리턴 ${stars(d.ret)}</span><b>${g[1] ? `${g[0]}/${g[1]} 맞음 (${Math.round(g[0] / g[1] * 100)}%)` : "아직 결과 없음"}</b></div>`; }).join("");
  const tips = S.tips.filter(t => t.res !== "void").slice().reverse().map(t => tipCard(t, 1)).join("");
  return `<div class="nbook"><div class="nbh">출처별 성적 <small>★는 대충 느낌. 진짜 실력은 '맞음' 비율로 배우는 거임 · 🪤 = 먼저 오르고 결과 칸에 폭락</small></div>
    <div class="nbt">${rows || `<div class="dim" style="padding:12px">아직 받은 정보 없음. 🏦 증권사·리서치 / 📢 갤·형나믿지 / 🚶 길거리에서 모아 보자</div>`}</div>
    <div class="nbh">받은 정보 <small>최근순</small></div><div class="tcards col" data-keep="nb">${tips}</div></div>`;
}
