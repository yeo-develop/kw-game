# web/ 진행 기록 (v3.3 1단계: 구조 정리)

- [시작] 디렉터리 생성. 기준: scratchpad/v32 (bd91519). 구 빌드 + 미니게임 고정 점수(mg=1) 베이스라인 실행 중.
- [sim 1차] src/sim/*.js (core, rng, num, fmt, state, market, effects, tips, gall, talk, trade, games, places, flow, api, query, ids, index) + src/data/*.json (추출 + strings/endings/scenes/rules) 작성. Node 헤드리스 스모크(엔딩까지) 통과. build.mjs 작성. 다음: view (src/view/*) — v3.2 view 코드를 이벤트/pending 기반으로 이식.
- [베이스라인] 구 빌드(v3.2 + mg=1 고정 점수 훅) = scratchpad/v33work/serve/old.html, 봇 = scratchpad/proto/play33.js (클릭 재시도). 결과 scratchpad/v33work/runs/oldA·oldB.
- [view 1차] src/view/{index.html,style.css,base,art,ui,fx,phone,phone2,tut,minigames,panels,panels2,events,main}.js 완성 → build.mjs 로 번들 OK. Playwright 봇 0 에러로 엔딩까지.
- [회귀 1차] 구(v3.2+mg) vs 신 (같은 봇, 클릭 재시도): work·gamble 6/6 동일. invest·random 일부 차이 → 원인: v3.2 가 '물타기 질문' 글 반응 팁의 작성자(=적중률)를 연출 난수(fx, 파티클과 공유)로 뽑음 → 재현 불가. 실험 중(xO/xN: 작성자를 T%4 로 고정해 비교).
- [도구] tools/sim-cli.mjs + tools/bots.mjs (헤드리스, ~5ms/판), tests/golden/gen.mjs + tests/run-golden.mjs (FNV-1a 상태 해시, 실수=IEEE 비트) 작성 — 벡터는 PRNG 교체 후 다시 생성 예정.
- [회귀 확정] 원인 확인: '물타기 질문' 반응 팁 작성자를 양쪽 다 T%4 로 고정하면 invest·random 6/6 동일 → 차이의 유일한 원인. (최종 1단계 비교 runs/newF·newFX 실행)
- [PRNG 교체] 기본 rngv=2: mulberry32 uint + gauss=Irwin–Hall(12) + sq=x*x + pexp/plog 사칙연산 구현 + 펀딩비 원 단위 + 물타기 팁 작성자 게임 난수. ?rng=v1 / createGame(seed,{rngv:1}) = v3.2 호환. 골든 20개 재생성·통과, sim-cli 200판×4 = 3.4s. prototype/index.html 빌드.
- 다음: v2 Playwright 4전략×3시드 + tut 런, 스크린샷(shots_v33a), docs/ARCHITECTURE.md.
- [검증] 1단계 최종: newF(원본 코드) vs 구 = 8/12 동일(차이 4 = 물타기 작성자 버그), newFX(작성자 T%4 고정) vs oldX = 12/12 동일. 스크린샷 shots_v33a (new/v32 집·주갤·지도 튜토리얼) OK. smoke33 (디버그·도움말·메뉴·폰 키보드·50배·리서치·사채·상점·멘헤라·이자일·이어하기) 에러 0. docs/ARCHITECTURE.md 작성.
- [완료] v2 Playwright 4전략×3시드(실제 미니게임) 에러 0 · tut 런 2개(work 7, invest 8) 에러 0 (코치 33/37단계) · 골든 20/20 · sim-cli 200판×4 · check-sim OK. 다음 = 2단계(concept_v33 §2) — sim 에 먼저, 골든 재생성.

# v3.3 2단계 (기능·밸런스) — concept_v33 §2
- [2단계 시작] 기준 792320b. 베이스라인 sim-cli 100판: work 0% clear(loop 100), invest gall 99%, gamble 0% clear, random 1%. 계획: sim(3칸·체력·호감도 삭제·유품 상점·엔딩3+스코어보드·중독도·베팅상한 폐지·청산 70~90%·돌발 매수) → data → bots(steady) → 밸런스 → view(체력바·유품 상점·피하기 미니게임·경마 결승·엔딩/계속하기) → 골든·Playwright·스크린샷 → 문서.
- [sim 2단계 1차] 하루 3칸(STOCK_SLOTS [0,1], 시세 vol×1.155·drift×4/3·펀딩 0.0027) · 체력(hp, HP_* 규칙, 기절=오늘 남은 칸+다음 날, 응급실 10만) · 호감도/캔들 삭제 · 유품(구 증강: pending relic/relicShop, 명령 pickRelic·relicReroll·gachaRelic·buyRelic·relicDone, 신규 유품 ginseng) · 엔딩 clear/bad1/bad2 + scoreboard + continue · 도박 중독도(addict, ADD_* 규칙, 몰래 카지노·유혹 pending tempt·금단) · 베팅 상한 삭제 · 청산 70~90% 손실 · 돌발 매수(pending impulse) · 새 알바 mart(피하기, setup.drops). check-sim OK.
- [밸런스] 일당 상향(cafe/store 15+27만, ware 20+31만, mart 17+29만) · 리포트 출처 acc 0.8/0.78 mag 8~14% · 중독도: 판돈 비율² 가중, 본전 생각(bigloss), 칸당 −3·밤 −3, 김사장 홀짝도 도박 · 슬롯 777 50배 · 홀짝 49.5% · 빚또 1등 4천만(3개 10만). sim-cli: steady 100%(≤5개월 72%, 평균 5.0), work 100%(≤5개월 18%, 6.4), gamble 3.0%(3000판) 나머지 bad2, random(36개월) bad1 51/bad2 42/clear 4. 봇: steady 추가, gamble 은 빈털터리면 알바. 다음: 골든 재생성 → view.
- [view 2단계] HUD 체력바(#hHp)·중독 배지·유품 칩, 유품 고르기(부모님 유품 상자)·유품 상점(뽑기 캡슐/진열장), 피하기 미니게임 mgMart(←→·A/D·버튼·드래그, 체력→이동속도), 경마 결승(1등 흔들림·빛남·레인 하이라이트), 기절·돌발 매수·몰래 카지노 연출, 엔딩 스코어보드 + 정식 엔딩 컷신(SCENES.clear) → 계속하기(continue), 엔딩 기록(localStorage longjab_records), 튜토리얼 데이터(체력·3칸·유품·유혹·돌발 TIPS). 저장 키 longjab_v34.
- [Playwright] scratchpad/proto/play33b.js(+batch33b.sh, steady·CONT=1 계속하기 검증) 4전략×3시드+invest 2: 에러 0, clear 런은 계속하기 후 400스텝 에러 0. 스크린샷 shots33b.js → shots_v33b/ (집·체력 HUD, 유품 상점 뽑기, 피하기, 경마 결승, 엔딩 3종, 유혹·몰래 카지노, 돌발 매수). 다음: 튜토리얼 런, 골든 재생성, docs.
- [완료] 골든 24개(5전략×4 + 앞부분 4) 재생성·24/24 통과 · check-sim OK · build OK · Playwright 14런(4전략×3 + invest 2, CONT=1) + 튜토리얼 4런(work 7·steady 8·gamble 9·random 10) 콘솔 에러 0 · 스크린샷 shots_v33b 18장 · docs/ARCHITECTURE.md §2~5·8·10·13 갱신. 최종 sim-cli: steady 100%(≤5개월 72%), work 100%(≤5개월 18%), gamble 3.0%(3000판, 나머지 bad2), random(36개월) bad1 51/bad2 42/clear 4.

# v3.3b 밸런스 — "알바만으론 빚을 못 갚는다" (사용자 결정, 구 피드백 "알바만 빡세게 해도 클리어 가능" 대체)
- [기준] 996af67: work 100% 클리어(모든 실력), steady 100%(≤5개월 72%). 봇 실력 MG="lo,hi" 환경변수 (tools/bots.mjs) 추가.
- [data] jobs: 일당 카페·편의점 15+27만 → 1+9만, 상하차 20+31만 → 1.2+11만, 마트 17+29만 → 1.1+10만 (실력 비중 ↑, 0.7점 한 달 수입 ≈ 이자). sources: 박대리·리서치 mag [0.08,0.14] → [0.2,0.3] (적중률 그대로). rules: GRIND_PAY 1.15 신설 (목장갑 +30% → +15%, 안 그러면 목장갑 판은 알바만으로 클리어).
- [sim 코드 변경 — C# 이식 반영 필요] games.js workResult · places.js locOpts(work): 목장갑 배율 상수 1.3 → R().GRIND_PAY. 그 외 sim 로직 변경 없음.
- [봇] steady: 1개월차 1일 아침에 사채 300+100만 종잣돈 (알바로는 시드가 안 모이므로). work/invest/gamble/random 로직 그대로.
- [텍스트] 유품 목장갑 설명·aug.grind '+15%', 일하기 장소 힌트 '일당 1~12만 · 이자 막는 용도', 튜토리얼 job 단계·도움말 loc-work·규칙 요약(scenes)에 '알바만 하면 이자 막는 정도, 원금은 정보로', 도박 클리어 엔딩 문구 '주식도 알바도 아니고 도박으로'.
- [결과] sim-cli 24개월: work MG 0.6~0.8 클리어 0%·bad1 0%·빚 3,042만(제자리), 0.8~1.0 0%·1,673만, 0.2~0.4 bad1 84%. steady 0.6~0.8 100%(≤5개월 66.0%, ≤8 93.3%), 0.3~0.5 94%(≤5 53.7%, 미클리어 6%). gamble 3000판 2.6% (seed 3001~6000: 3.2%), 나머지 bad2. invest 100%(≤5 66%). random bad1 70/bad2 28/clear 1. 표 = docs/ARCHITECTURE.md §13.
- [검증] 골든 24개 재생성 → 24/24 통과 · check-sim OK · build OK · Playwright 4전략×1시드(seed 11, CONT=1) 콘솔 에러 0 (결과 scratchpad/proto/runs33c: gamble bad2 3개월, random bad1 12개월, work bad1 25개월 = 실제 미니게임 난이도 상승으로 제자리걸음 끝 표류, steady bad1 44개월 — play33b 의 steady 는 사채 종잣돈 없이 알바+리포트만 하므로 시드가 안 모여 못 갚음 = 의도대로).
