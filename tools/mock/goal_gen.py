# 시안 생성: "뭘 해야 할지 보이게" 세 방향 (집 화면). 출력: /Users/admin/projects/kw-game/docs/mock/goal.html
R='file:///Users/admin/projects/kw-game/Assets/Resources/Art'
CSS = open('/Users/admin/projects/kw-game/docs/mock/ui_v2.html',encoding='utf-8').read().split('<style>')[1].split('</style>')[0]
CSS += '''
.lad{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.lad>div{position:static;background:#232737;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:7px 10px;line-height:1.25}
.lad>div.now{border:2px solid var(--gold);background:rgba(255,209,102,.09)}.lad b{font-size:20px}.lad small{font-size:12.5px}
.tag{display:inline-block;border:1px solid currentColor;border-radius:7px;padding:0 7px;font-size:12.5px;font-weight:700;margin-right:6px}
.dimmed{opacity:.38}.glow{box-shadow:0 0 0 3px var(--pink),0 0 22px rgba(255,107,157,.55)}
.kk{background:#fff;color:#1a1020;border-radius:10px;padding:8px 12px;font-size:13.5px;line-height:1.3;border:1px solid rgba(0,0,0,.1)}
.toast{background:rgba(30,60,40,.95);border-radius:8px;padding:6px 10px;font-size:13px}
.ck{display:flex;gap:8px;align-items:flex-start;margin-top:7px}.ck i{position:static;flex:none;width:18px;height:18px;border-radius:5px;border:2px solid var(--dim);display:inline-block;margin-top:2px}.ck i.ok{background:var(--ok);border-color:var(--ok)}
'''
def strip():
    return '''<div class="strip"><div class="rel"><span class="t">2일째 (화) · 오전</span><span>빚 <b class="w">3,000만</b></span><span>현금 <b class="o">276만</b></span><span>순자산 <b>324만</b></span>
  <span style="flex:1;display:flex;align-items:center;gap:10px"><b class="g">이번 주 납부 240만</b><span class="bar" style="flex:1;max-width:230px"><i style="width:100%;background:var(--ok)"></i></span><span class="o">다 모음</span><span class="chip" style="margin:0;font-size:12px;padding:1px 8px">D-5</span></span>
  <span class="d">스트레스 38 · 호감 53</span></div></div>'''
def left(bub, popups=1):
    s = f'''<div class="mirai" style="left:40px;top:96px;width:430px;height:624px;background-image:url({R}/Characters/Mirai/mirai_base.png)"></div>
 <div class="bub" style="left:228px;top:70px;max-width:290px;font-size:14.5px">{bub}</div>
 <div class="toast" style="left:16px;top:66px;width:190px">미래가 도시락을 싸 줬다 (스트레스 −5)</div>'''
    s += '''<div class="kk" style="left:16px;top:646px;width:300px"><b>미래 ♥</b> <span style="float:right;color:#777;font-size:12px">카카오톡 · 외 2개</span><br>오늘 밤 칸은 내 거야. 밤엔 나랑 있어 줘.</div>'''
    return s
def cards(dim=None, glow=None, hint=None, extra=None):
    """오전 칸 카드들. dim/glow = 카드 이름 집합"""
    dim = dim or set(); glow = glow or set(); hint = hint or {}
    def c(name): return ('card' + (' dimmed' if name in dim else '') + (' glow' if name in glow else ''))
    def h(name, d): return hint.get(name, d)
    return f'''
  <div class="{c('장')}" style="left:38px;top:{{y0}}px;width:318px;height:84px"><div class="rel"><div class="t" style="font-size:19px">장 보기 <span class="d" style="float:right;font-size:13px">1</span></div><div class="d" style="font-size:13.5px">{h('장','시세 보며 실시간 매매')}</div></div></div>
  <div class="{c('놀')}" style="left:366px;top:{{y0}}px;width:312px;height:84px"><div class="rel"><div class="t" style="font-size:19px">미래랑 놀기 <span class="d" style="float:right;font-size:13px">2</span></div><div class="d" style="font-size:13.5px">{h('놀','호감 +3 · 스트레스 풀림 · 낮엔 반만')}</div><div class="g" style="font-size:13px">부탁: 밤엔 나랑</div></div></div>
  <div class="{c('알')}" style="left:38px;top:{{y1}}px;width:640px;height:{{ah}}px"><div class="rel"><div style="display:flex;justify-content:space-between"><span class="t" style="font-size:19px">알바 가기</span><span class="d" style="font-size:13px">{h('알','누르면 설명 카드 · 포지션은 들고 감')}</span></div>
   <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:4px;font-size:13px;line-height:1.2">
    <div class="card" style="padding:6px 9px"><b>카페</b><br><span class="d">18~36만</span></div><div class="card" style="padding:6px 9px"><b>편의점</b><br><span class="d">18~36만</span></div>
    <div class="card" style="padding:6px 9px"><b>상하차</b><br><span class="d">25~50만 · 폰 못 봄</span></div><div class="card" style="padding:6px 9px"><b>마트</b><br><span class="d">22~43만</span></div></div></div></div>'''
def foot():
    return '''<div class="p" style="left:540px;top:662px;width:716px;height:44px"><div class="rel" style="display:flex;gap:8px;align-items:center;height:42px;padding:0 14px"><span class="chip on" style="margin:0">P 폰 · 카톡 3</span><span class="chip" style="margin:0">유물 1</span><span style="flex:1"></span><span class="chip" style="margin:0">도움말</span><span class="chip" style="margin:0">설정</span><span class="chip" style="margin:0">저장</span></div></div>'''
LADDER = '''<div class="lad" style="left:22px;top:{y}px;width:672px">
   <div class="now"><small class="g t">1주 · 이번 주</small><br><b>240만</b><br><small class="o t">D-5 · 다 모음</small></div>
   <div><small class="d t">2주</small><br><b>386만</b><br><small class="g">302만 더 벌어야</small></div>
   <div><small class="d t">3주</small><br><b class="d">727만</b><br><small class="d">1,029만 더</small></div>
   <div><small class="d t">4주 · 만기</small><br><b class="d">1,957만</b><br><small class="d">내면 빚 0 = 클리어</small></div></div>'''
def tail(y, chips=True):
    s = f'''<div class="card" style="left:22px;top:{y}px;width:330px;height:54px"><div class="rel"><b>오후</b> <span class="d" style="font-size:13px">12:00 ~ 18:00 · 장중 15:30 까지</span></div></div>
  <div class="card" style="left:364px;top:{y}px;width:330px;height:54px"><div class="rel"><b>밤</b> <span class="d" style="font-size:13px">미래 시간 · 호감 ×1.5</span></div></div>'''
    if chips: s += f'''<div style="left:22px;top:{y+66}px;width:672px"><span class="chip">쉬기 · 스트레스 −8</span><span class="chip">빚 갚기</span><span class="chip">은행</span><span class="chip d">그 밖 ▾ (카지노 · 복권소 · 한강공원 · 대출)</span></div>'''
    return s

def frame(body): return f'<div class="wrap"><div class="f" style="background-image:url({R}/Backgrounds/room_day.jpg)">{strip()}{body}{foot()}</div></div>'

# 가: 사다리 + 오늘 속도
A = left('좋은 아침! 다음 주 납부는 386만이래. 지금 속도면… 빠듯한데?') + f'''
 <div class="p" style="left:540px;top:66px;width:716px;height:586px;padding:0">
  <div style="left:22px;top:12px;font-size:15px" class="d">납부 일정 — 마지막 칸까지 내면 빚 0원</div>
  {LADDER.format(y=38)}
  <div style="left:22px;top:124px;width:672px;font-size:14.5px"><b class="g">끝까지 2,985만 더 · 남은 81칸</b> <span class="d">→ 칸마다</span> <b>+37만</b> <span class="d">이 제 속도 (알바 한 번 ≈ 27만 → 알바만으론 모자람)</span></div>
  <div class="bar" style="left:22px;top:152px;width:672px;height:8px"><i style="width:10%;background:var(--gold)"></i></div>
  <div style="left:22px;top:172px;width:672px;height:226px;border:2px solid var(--pink);border-radius:14px;background:rgba(255,107,157,.06)"></div>
  <div style="left:38px;top:180px;font-size:17px" class="t pk">오전 · 지금</div><div style="left:132px;top:183px;font-size:13px" class="d">08:00 ~ 12:00 · 이 칸에 고른 일의 예상 수입이 카드에 보임</div>
  {cards(hint={'장':'<b class=u>속보 2건 대기</b> · 수입은 내 손에 달림', '알':'<b class=o>확실한 +18~50만</b> · 제 속도의 50~150%'}).format(y0=208,y1=300,ah=90)}
  {tail(410)}
  <div style="left:22px;top:524px;width:672px;font-size:13.5px" class="d">어제 <b class="u">+26만</b> · 제 속도(3칸 +111만)보다 <b class="n">−85만</b> — 이번 주 납부는 이미 다 모았으니 남는 돈을 불릴 때</div>
 </div>'''
# 나: 주간 미션
B = left('이번 주 숙제 봤어? 알바 한 번만 더 가면 하나 끝이야!') + f'''
 <div class="p" style="left:16px;top:440px;width:330px;height:196px;padding:0"><div class="rel" style="padding:12px 14px">
   <div class="t g" style="font-size:16px">이번 주 할 일 <span class="d" style="font-weight:400;font-size:13px">1/3 · D-5</span></div>
   <div class="ck"><i class="ok"></i><span><b>납부 240만 모으기</b><br><small class="o">다 모음 — 7일째 밤에 내면 대출이 열림</small></span></div>
   <div class="ck"><i></i><span><b>알바 3번 가기</b> <span class="g">2/3</span><br><small class="d">보상: 미래 호감 +5</small></span></div>
   <div class="ck"><i></i><span><b>리포트를 따라 사서 이익 1번</b><br><small class="d">보상: 유료 리포트 1번 무료</small></span></div>
 </div></div>
 <div class="p" style="left:540px;top:66px;width:716px;height:586px;padding:0">
  <div style="left:22px;top:14px;font-size:21px" class="t g">오늘</div><div style="left:80px;top:20px;font-size:13.5px" class="d">행동 하나 = 한 칸 · 장은 09:00~15:30</div>
  <div style="left:22px;top:54px;width:672px;height:238px;border:2px solid var(--pink);border-radius:14px;background:rgba(255,107,157,.06)"></div>
  <div style="left:38px;top:62px;font-size:17px" class="t pk">오전 · 지금</div><div style="left:132px;top:65px;font-size:13px" class="d">08:00 ~ 12:00</div>
  {cards(hint={'장':'<span class=tag style="color:var(--gold)">할 일</span>리포트 따라 사서 이익 1번', '알':'<span class=tag style="color:var(--gold)">할 일</span>알바 3번 (2/3) · 한 번 더 가면 끝'}).format(y0=92,y1=186,ah=94)}
  {tail(306)}
  <div style="left:22px;top:424px;width:672px;font-size:13.5px" class="d">어제: 오전 장 보기 <b class="u">+20.9만</b> · 오후 편의점 알바 <b class="u">+17.2만</b> · 밤 카지노 <b class="n">−11.9만</b> · 합계 <b class="u">+26.2만</b></div>
  <div style="left:22px;top:456px;width:672px;font-size:13.5px" class="d">다 하면: <b class="g">주간 보상 상자</b> (유물 조각 · 현금 중 하나) — 못 해도 벌은 없음</div>
 </div>'''
# 다: 가 + 첫 주 길잡이
C = left('오늘은 장 보기부터 해 볼까? 내가 옆에서 봐 줄게.') + f'''
 <div class="p" style="left:540px;top:66px;width:716px;height:586px;padding:0">
  <div style="left:22px;top:12px;font-size:15px" class="d">납부 일정 — 마지막 칸까지 내면 빚 0원</div>
  {LADDER.format(y=38)}
  <div style="left:22px;top:126px;width:672px;height:52px;border-radius:12px;background:linear-gradient(90deg,rgba(255,107,157,.28),rgba(255,107,157,.08));border:1px solid var(--pink)"></div>
  <div style="left:36px;top:132px;width:650px;font-size:15px"><span class="tag pk">길잡이 2/7</span><b>지금 할 일: 장 보기에서 아무 종목이나 한 번 사 보기</b><br><span class="d" style="font-size:13px">어제는 알바로 확실한 돈을 벌었어요. 오늘은 그 돈을 불려 보는 날 — 첫 매매는 10만원이면 충분해요.</span></div>
  <div style="left:22px;top:190px;width:672px;height:212px;border:2px solid var(--pink);border-radius:14px;background:rgba(255,107,157,.06)"></div>
  <div style="left:38px;top:198px;font-size:17px" class="t pk">오전 · 지금</div><div style="left:132px;top:201px;font-size:13px" class="d">08:00 ~ 12:00</div>
  {cards(dim={'놀','알'}, glow={'장'}, hint={'장':'<b class=pk>← 여기</b> · 속보가 뜨면 시세가 움직여요'}).format(y0=226,y1=316,ah=80)}
  {tail(414, chips=False)}
  <div style="left:22px;top:480px;width:672px;font-size:13.5px" class="d">길잡이: <b class="o">1 알바 한 번 ✓</b> → <b class="pk">2 한 번 사 보기</b> → 3 속보 보고 팔기 → 4 리포트 보기 → 5 미래랑 놀기 → 6 빚 미리 갚기 → 7 납부</div>
  <div style="left:22px;top:508px;width:672px;font-size:13.5px" class="d">다른 걸 눌러도 됩니다 (흐리게만 보임). 첫 주가 끝나면 길잡이는 사라지고 위의 납부 일정만 남습니다. 2회차부터는 끌 수 있음.</div>
 </div>'''

html = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>롱잡고알바감 — "뭘 해야 할지" 시안 3가지</title><style>{CSS}</style></head><body><main>
<h1>"뭘 해야 할지 안 느껴진다" — 시안 3가지</h1>
<p class="lead">같은 장면(2일째 아침 집)을 세 방향으로 그렸습니다. 숫자는 지금 규칙 그대로(보통맛: 납부 240 → 386 → 727 → 1,957만)이고 그림은 구조를 보여 주는 시안입니다.</p>
<h3>왜 할 일이 안 느껴지나 — 제가 본 원인</h3>
<div class="diag">
 <div><b>① 첫날부터 "다 모음"</b><br>시작 현금 300만으로 첫 주 납부 240만을 바로 낼 수 있습니다. 화면은 이번 주 납부만 보여 줘서, 첫날부터 숙제가 끝난 것처럼 보입니다.</div>
 <div><b>② 진짜 벽이 화면에 없음</b><br>납부는 240 → 386 → 727 → 1,957만으로 커집니다. 4주째 1,957만은 알바로는 못 냅니다. 이 사실이 어디에도 안 보입니다.</div>
 <div><b>③ 누를 것 15개가 같은 무게</b><br>장 보기 · 놀기 · 알바 4종 · 칩 7개. 지금 무엇이 도움이 되는지 표시가 없습니다.</div>
 <div><b>④ 하루가 "했다/못 했다" 없이 끝남</b><br>저녁 정산은 번 돈만 보여 줍니다. 그 돈이 충분한지는 말해 주지 않습니다.</div>
 <div><b>⑤ 설명이 읽고 넘기는 글</b><br>안내 카드 9장 · 아침 15줄. 읽어도 손은 뭘 눌러야 할지 모릅니다.</div>
</div>
<table class="cmp">
<tr><th></th><th>가 · 납부 일정 + 제 속도</th><th>나 · 주간 할 일 3개</th><th>다 · 가 + 첫 주 길잡이</th></tr>
<tr><td class="d">한 줄</td><td>4주치 납부를 늘 보여 주고 "칸마다 얼마 벌어야 하나"를 숫자로</td><td>매주 할 일 3개를 체크리스트로, 하면 작은 보상</td><td>가에 더해 첫 7일은 "지금 할 일 한 가지"를 짚어 줌</td></tr>
<tr><td class="d">규칙이 바뀌나</td><td class="o">안 바뀜 (보여 주기만)</td><td class="w">바뀜 (보상 → 밸런스 다시 재야 함)</td><td class="o">안 바뀜</td></tr>
<tr><td class="d">처음 하는 사람</td><td class="w">숫자는 보이는데 뭘 누를지는 스스로</td><td class="o">할 일이 글로 보임</td><td class="o">누를 곳이 빛남</td></tr>
<tr><td class="d">익숙해진 뒤</td><td class="o">속도 숫자로 스스로 판단</td><td>숙제처럼 느껴질 수 있음</td><td class="o">길잡이는 사라지고 가만 남음</td></tr>
<tr><td class="d">글 안내 카드 9장</td><td>그대로</td><td>그대로</td><td class="o">없앰 (길잡이가 대신함)</td></tr>
<tr><td class="d">만드는 양</td><td class="o">적음</td><td class="w">많음 (할 일 종류 · 보상 · 밸런스)</td><td>중간 (7일치 길잡이)</td></tr>
</table>
<p class="note">세 시안 공통 정리: 카톡 알림은 하나만("외 2개") · 알림(토스트)은 두 개까지 · 잘 안 쓰는 칩은 "그 밖"으로 접음.</p>

<h2>가 · 납부 일정 + 제 속도</h2>
<p>계획판 맨 위에 4주치 납부를 늘 둡니다. 그 아래 한 줄이 "끝까지 얼마 · 칸마다 얼마"입니다. 카드마다 이 칸에 고르면 얼마쯤 버는지 보이고, 저녁 정산이 "제 속도보다 얼마 많다/적다"를 말해 줍니다.</p>
{frame(A)}
<h2>나 · 주간 할 일 3개</h2>
<p>매주 할 일 3개(납부 + 고를 수 있는 2개)가 체크리스트로 뜨고, 관련 카드에 "할 일" 꼬리표가 붙습니다. 다 하면 보상 상자. 규칙이 늘어나는 안입니다.</p>
{frame(B)}
<h2>다 · 가 + 첫 주 길잡이 <span style="font-size:15px;color:var(--ok)">추천</span></h2>
<p>가의 납부 일정은 그대로 두고, 첫 7일 동안만 "지금 할 일 한 가지"를 짚습니다. 그 버튼만 빛나고 나머지는 흐려집니다(눌러도 됨). 글 안내 카드 9장을 이걸로 바꿉니다.</p>
{frame(C)}
</main><script>function fit(){{document.querySelectorAll('.wrap').forEach(w=>{{w.firstElementChild.style.transform='scale('+(w.clientWidth/1280)+')'}})}}fit();addEventListener('resize',fit)</script></body></html>'''
open('/Users/admin/projects/kw-game/docs/mock/goal.html','w',encoding='utf-8').write(html)
print(len(html))
