#!/usr/bin/env python3
"""화면 캡처(PNG, tools/screens/capture.js 가 만든 것) → docs/screens/*.jpg + docs/SCREENS.md
사용: python3 tools/screens/make_doc.py <캡처 폴더> <버전(커밋)>"""
import glob, os, re, sys
from PIL import Image

SECTIONS = [
 ("타이틀", [
  ("title", "타이틀", "이어하기 · 새로 시작 · 설정 · 기록 · 종료."),
  ("title_newgame", "새로 시작", "난이도(순한맛 · 보통맛 · 매운맛)와 판 코드. 난이도 설명은 풀어 쓴 문장."),
  ("title_settings", "설정 (타이틀)", "음량 · 전체 화면."),
  ("title_records", "기록", "판 수 · 클리어 · 엔딩 도감."),
 ]),
 ("오프닝과 첫날", [
  ("opening_card", "오프닝 — 석 달 전", "불장 차트 카드로 시작."),
  ("opening_dialogue", "오프닝 — 100일 기념 고백", "\"나 빚 3천 있어 ㅎㅎ\""),
  ("opening_cg_visit", "오프닝 — 김사장 방문", "원금 3,000만 · 주 이자 · 7일마다 수금."),
  ("opening_cg_box", "오프닝 — 유물 상자", "\"아빠 유물 상자. 하나쯤은 쓸모 있겠지?\""),
  ("relic_pick", "유물 고르기", "시작 유물 셋 중 하나. 선택지 오른쪽 위 번호 = 숫자 키."),
  ("morning_first", "아침 카드 (첫날)", "장 이름 · 이번 주 납부 · 목표. ※ 첫날은 게임이 아침 카드를 안 띄워서 같은 화면 코드에 값을 넣어 띄운 것."),
  ("coach_card", "도움말 카드", "짚는 곳만 밝히고 설명. 판 아래 '도움말'로 다시 볼 수 있음."),
  ("status_card", "상태 카드", "맨 위 상태 띠를 누르면: 목표 · 부탁 · 돈 · 납부 내역 · 몸과 마음 · 호감 버프 · 유물. ※ 버프가 보이게 호감만 올려 띄운 것."),
  ("settings_game", "설정 (게임 안)", "음량 · 글자 속도 · 화면 효과 · 읽은 대사 빨리 넘기기."),
  ("loan_locked", "김사장 대출 (잠김)", "첫 납부를 통과해야 열림."),
 ]),
 ("집 계획판", [
  ("plan_morning", "계획판 — 첫날 오전", "맨 위 상태 띠 + 왼쪽 미래 + 오른쪽 '오늘' 판(오전 · 오후 · 밤). 지금 칸에 장 보기 · 미래랑 놀기 · 알바 4종, 아래 칩 줄과 판 아래 작은 줄."),
  ("plan_phone", "계획판 — 폰을 연 집", "P 폰. 집에선 증권 앱(코인을 급히 볼 때) · 카톡 · 주갤 · 뉴스 · 정보 수첩."),
  ("plan_afternoon", "계획판 — 오후", "끝난 오전 칸에 한 일과 그 칸 손익."),
  ("plan_night", "계획판 — 밤", "오전 · 오후 칸에 한 일 · 손익, 밤 칸이 지금."),
  ("plan_day2", "계획판 — 둘째 날 아침", "칩 줄 아래 '어제' 줄: 칸마다 한 일 · 손익 · 합계."),
  ("plan_weekend", "계획판 — 주말", "토 · 일은 국장 휴장(코인만). ※ 날짜만 토요일 아침으로 놓고 띄운 것."),
 ]),
 ("장 보기 데스크", [
  ("desk_stock", "데스크 — 주식", "왼쪽 종목 목록(등락 · 주갤 온도 막대 · 거래량 배수) · 가운데 큰 차트(봉 + 거래량) · 오른쪽 분석가 → 주문 → 내 포지션 · 아래 소식 띠 · 미래 작은 창. 맨 위 띠는 시계 · 속도 · 그만 보기."),
  ("desk_report", "데스크 — 리포트를 받은 뒤", "분석가 칸에 그 종목 정보 줄(누가 · 방향 · 기한 · 전적)."),
  ("desk_coin_order", "데스크 — 코인 주문", "금액 · 배율 · 예상 청산가 · 청산 확률 막대 · 증거금 상한 남은 돈 · 롱/숏 · 진입."),
  ("desk_confirm", "데스크 — 한 번 더 누르기", "25배 이상 · 증거금 100만 이상 · 청산 확률 30% 이상이면 '한 번 더 누르면 진입'."),
  ("desk_fail", "데스크 — 주문 실패", "실패 이유가 버튼 바로 위 결과 줄에. ※ 가진 돈보다 큰 주문을 넣어 띄운 것."),
  ("desk_positions", "데스크 — 포지션", "손익 큰 숫자 · 절반 팔기 · 전부 팔기(큰 건 두 번) · 코인은 닫기 + 예약 칩."),
  ("desk_range_12h", "데스크 — 12시간 차트", ""),
  ("desk_range_48h", "데스크 — 48시간 차트", ""),
  ("desk_op_pump", "데스크 — 작전 종목 (끌어올리는 중)", "주갤 온도 · 거래량 배수가 높고, 살 때 예상 미끄러짐이 주문 패널에. ※ 첫 주엔 작전이 없어 작전 상태를 넣어 띄운 것."),
  ("desk_op_pre", "데스크 — 큰손 매도 전조", "소식 띠에 전조 줄 + 종목 목록 줄이 깜빡임. ※ 사건 값을 넣어 띄운 것."),
  ("desk_op_dump", "데스크 — 설거지", "소식 띠 + 위쪽 배너(보유 중) + 데스크 흔들림 + 미래 놀람. ※ 사건 값을 넣어 띄운 것."),
  ("desk_op_locked", "데스크 — 하한가 잠김", "목록 꼬리표 · 포지션 줄 · 주문 패널에 못 파는 이유. ※ 잠김 상태를 넣어 띄운 것."),
  ("desk_kakao", "데스크 위 폰 — 카톡", "데스크에서 폰은 카톡 · 주갤 · 뉴스 · 정보 수첩만(매매는 주문 패널 한 곳)."),
  ("banner_report", "발표 배너", "리포트 결과: 종목 · 방향 · 분석가 적중/빗나감 · 보유 중 + 소식 띠 줄. ※ 값을 넣어 띄운 것."),
  ("banner_stop", "예약 체결 배너", "예약 손절 · 익절이 체결되면. ※ 값을 넣어 띄운 것."),
  ("desk_liq", "청산 연출", "실시간 청산: 터짐 연출 + 소식 띠 '청산' 줄. ※ 연출만 띄운 것."),
  ("cash_float", "현금 ± 숫자", "현금이 바뀌면 띠의 현금 옆에 잠깐 떠오름."),
 ]),
 ("폰 (집)", [
  ("gall_list", "주갤 — 목록", ""),
  ("gall_post", "주갤 — 글", ""),
  ("news", "뉴스", "칸이 시작할 때 속보."),
  ("tips", "정보 수첩", "진행 중인 정보와 출처별 전적."),
 ]),
 ("알바", [
  ("encounter", "말 거는 사람", "계획판에서 알바 카드를 누르면 길에서 만나는 정보원이 끼어들 수 있음. ※ 안 나오면 같은 모양으로 직접 띄운 것."),
  ("work_brief", "알바 설명 카드", "계획판 알바 카드 → 바로 이 카드(지도 · 장소 화면 없음). 일당 · 난이도 · 한 줄 요약 · '다른 알바 고르기'(시간 안 씀, 집으로)."),
  ("mg_cafe", "카페 알바", "주문표대로 담아 서빙."),
  ("mg_store", "편의점 알바", "초록 구간에 삑."),
  ("mg_ware", "상하차", "연타로 박스 올리기. 폰을 못 봄."),
  ("mg_mart", "마트 창고", "떨어지는 박스 피하기."),
  ("mg_positions", "포지션을 든 채 알바", "오른쪽 아래 구석에 내 포지션 손익 + '몰래 폰 보기'."),
  ("mg_peek", "몰래 폰 보기 창", "코인 포지션마다 [정리], 주식 줄(등락 · 온도 · 거래량 · 손익 + [팔기]), [전부 정리] · [그냥 닫기]."),
  ("mg_liq", "알바 중 청산", "청산 연출 + 구석에 붉은 줄. ※ 연출만 띄운 것."),
  ("mg_howto", "그림 안내 카드", "미니게임 시작 전 조작법."),
  ("mg_result", "알바 결과 카드", "등급 · 성과 · 예상 일당."),
 ]),
 ("저녁과 밤", [
  ("settle_profit", "저녁 정산 — 이익 날", "띠 아래 한 장: 왼쪽 미래(표정 + 한마디), 오른쪽 카드에 오전 · 오후 줄(한 일 + 칸 손익) · 그 밖 · 오늘 합계 · 현금 A → B · 옮긴 돈 · 이번 주 납부 막대 · 리포트 · 포지션 · [밤으로]. 오전 + 오후 + 그 밖 = 합계. ※ 값을 넣어 띄운 것."),
  ("settle_loss", "저녁 정산 — 손실 날", "※ 값을 넣어 띄운 것."),
  ("settle_liq", "저녁 정산 — 청산 날", "※ 값을 넣어 띄운 것."),
  ("event_choice", "돌발 이벤트", "카드 제목이 이벤트 제목, 선택지에 번호."),
  ("menhera", "멘헤라", "스트레스가 꽉 차면 카톡 탄막."),
  ("impulse_alert", "돌발 풀매수 알림", "미래가 몰래 사 버림. ※ 값을 넣어 띄운 것."),
  ("tempt", "도박 유혹", "중독도가 높을 때. ※ 선택 상태를 직접 놓은 것."),
  ("night_liq", "청산당한 밤", "그날 청산당했으면 밤에 뜨는 장면. ※ 선택 상태를 직접 놓은 것."),
 ]),
 ("돈: 대출 · 상환 · 놀거리", [
  ("loan_open", "김사장 대출 (열림)", "이번 주 한도 · 빌린 돈은 다음 주 납부로."),
  ("bank", "은행", "이자 미리 내기 · 원금 상환."),
  ("repay", "빚 갚기", ""),
  ("casino", "카지노", ""),
  ("casino_round", "카지노 — 한 판", ""),
  ("lotto", "복권소", ""),
  ("park", "한강공원", ""),
 ]),
 ("납부 관문 (7일째 밤)", [
  ("payday_interest", "이자일", "김사장이 옴. 이자 내기."),
  ("gate_short", "원금 분납 — 모자람", "가진 만큼만 내기 · 급매 · 미납."),
  ("gate_ready", "원금 분납 — 낼 수 있음", ""),
  ("gate_relic", "통과 보상 유물", "납부를 통과하면 유물 하나."),
  ("chapter_card", "장 카드 (2장 시작)", "주가 바뀌면 그 주의 판 분위기."),
  ("gate_miss_warning", "미납 경고", "한 번 더 미납하면 원양어선. ※ 값을 넣어 띄운 것."),
 ]),
 ("엔딩", [
  ("end_true", "진엔딩", "빚 0 + 호감 60↑."),
  ("end_scoreboard", "엔딩 점수판", ""),
  ("part2_start", "2부 시작", "축하 치킨 뒤 김사장의 차용증."),
  ("end_lonely", "돈은 갚았는데", "빚 0 + 호감 60 미만."),
  ("end_rich", "갚고도 FLEX", ""),
  ("end_gamble_clear", "도박으로 갚음", ""),
  ("end_sea", "혼자 원양어선", ""),
  ("end_duo", "둘이 같이 원양어선", ""),
  ("end_gall", "갤 운영자에게 팔려 감", ""),
  ("end_heist", "털고 튐", ""),
  ("end_heist_fail", "금고 앞에서", ""),
  ("end_bad2", "도박 중독", ""),
  ("end_bad2_loop", "편의점 무한루프", ""),
  ("end_bad3", "과로", "체력이 없어진 지금 규칙에선 도달할 수 없음(도감 정리 대상)."),
  ("end_bad4_run", "미래 가출", ""),
  ("end_bad4_sell", "미래 폭주 (전량 매도)", ""),
 ]),
 ("미래 표정", [
  ("faces_1", "스탠딩 1", "base · excited · smug · shy · pout · annoyed · tired · pajama."),
  ("faces_2", "스탠딩 2", "crying · crying_comic · shocked · dizzy · mental · yami · flex · love."),
 ]),
]

def main():
    src, ver = sys.argv[1], sys.argv[2]
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    out = os.path.join(root, 'docs', 'screens'); os.makedirs(out, exist_ok=True)
    have = {}
    for f in glob.glob(os.path.join(src, '[0-9][0-9]_*.png')):
        have[re.sub(r'^\d+_', '', os.path.basename(f)[:-4])] = f
    for f in glob.glob(os.path.join(out, '*.jpg')): os.remove(f)
    known = set(); n = 0; missing = []
    L = [f"# 화면 전체 ({ver})", "",
         f"> 배포본을 화면 없는 브라우저(1280×720)로 열어 캡처 모드(`?kwShots=1`)로 찍은 것. 캡처 모드는 저장을 쓰지 않고 늘 같은 새 판으로 돈다.",
         "> ※ 표시는 실제 게임 흐름으로 가기 어려워 같은 화면 코드에 값만 넣어 띄운 화면. 화면 구성 설명과 공통 규칙은 `UIUX.md`.",
         "> 다시 만들기: `KW_PLAYWRIGHT=<playwright 경로> node tools/screens/capture.js \"<배포 주소>/?kwShots=1\" 8765 <폴더>` → `/status` 가 done 이면 `python3 tools/screens/make_doc.py <폴더> <커밋>`.", ""]
    toc = []; body = []
    for title, items in SECTIONS:
        got = [(k, t, c) for k, t, c in items if k in have]
        known.update(k for k, _, _ in items)
        missing += [t for k, t, _ in items if k not in have]
        if not got: continue
        toc.append(f"- [{title}](#{re.sub(r'[^0-9a-z가-힣]+', '-', title.lower()).strip('-')}) — {len(got)}장")
        body += [f"## {title}", ""]
        for k, t, c in got:
            im = Image.open(have[k]).convert('RGB')
            im.save(os.path.join(out, k + '.jpg'), quality=74, optimize=True); n += 1
            body += [f"### {t}", "", f"![{t}](screens/{k}.jpg)", ""]
            if c: body += [c, ""]
    extra = sorted(set(have) - known)
    if extra:
        body += ["## 그 밖", ""]
        for k in extra:
            Image.open(have[k]).convert('RGB').save(os.path.join(out, k + '.jpg'), quality=74, optimize=True); n += 1
            body += [f"### {k}", "", f"![{k}](screens/{k}.jpg)", ""]
    L += [f"모두 {n}장.", ""] + toc + [""]
    if missing: L += ["**이번에 못 찍은 화면**: " + " · ".join(missing), ""]
    open(os.path.join(root, 'docs', 'SCREENS.md'), 'w', encoding='utf-8').write("\n".join(L + body))
    size = sum(os.path.getsize(f) for f in glob.glob(os.path.join(out, '*.jpg')))
    print(n, '장', round(size / 1e6, 1), 'MB', '못 찍음', len(missing), '그 밖', extra)

if __name__ == '__main__': main()
