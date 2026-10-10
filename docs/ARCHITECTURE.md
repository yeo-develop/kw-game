# 롱잡고알바감 — 구조 문서 (v3.3 2단계, 유니티 C# 이식 기준)

> 웹 프로토타입(`web/`)을 **규칙(sim) · 콘텐츠(data) · 화면(view)** 세 층으로 나눴다.
> sim 은 브라우저 없이 Node 에서도 돌고(`tools/sim-cli.mjs`), 같은 명령열이면 같은 결과가 나온다(골든 벡터).
> 유니티는 sim 을 C# 으로 옮기고, data 는 같은 JSON 을 쓰고, view 만 새로 만든다.

## 1. 층과 디렉터리

```
web/
  build.mjs                 의존성 없는 번들러 → prototype/index.html (데이터 JSON 인라인, 단일 파일)
  PROGRESS.md               작업 기록
  src/
    sim/   규칙 (ES 모듈, DOM·타이머·await·HTML·Math.random 없음 — tools/check-sim.mjs 로 검사)
      core.js      현재 상태 바인딩(bind/st) · 이벤트 버퍼(emit) · 데이터 테이블 D
      rng.js       난수 (§5)               num.js   clamp · roundHalfUp · round1k
      fmt.js       숫자·문구 포맷 (won/man/pct… · T(key,vars) 템플릿 · conv 돈 환산)
      state.js     상태 스키마(newState) + 읽기 계산(holdVal·interestDue·mental…) + HUD 스냅샷
      market.js    시세 계획/적용 · 뉴스 · 청산 경로 판정        tips.js   정보(팁) 시스템
      effects.js   체력·중독도·멘탈·현금·빚 변화, 카톡·피드·토스트 기록
      gall.js      주갤 글·댓글·찌라시·내 글 반응, 미래 카톡 질문, 형나믿지 DM
      talk.js      대사·연출 이벤트 헬퍼 + react(도박·투자 결과 반응)
      trade.js     주식·코인 매매         games.js  알바(미니게임 판)·카지노·경마·즉석 복권·빚또
      places.js    장소 메뉴 · 게임방 · 은행 · 상점(꾸미기·유품 뽑기/구매) · 증권사 리포트 · 사채 · 길거리 정보
      flow.js      하루 흐름 단계(step) · 아침 · 칸 시작/끝 · 이자일 · 유품 고르기 · 멘헤라·돌발 매수 · 중독 사건·유혹 · 기절 · 엔딩·스코어보드·계속하기
      api.js       createGame · apply (명령 처리)        query.js  view 용 읽기 전용 계산
      digest.js    골든용 상태 요약·해시                  ids.js    한글 ID(데이터 키) 모음 — sim 의 유일한 한글 리터럴
      index.js     공개 API
    data/  콘텐츠 JSON (§7) — 한글 문구는 전부 여기
    view/  화면 (클래식 스크립트, 같은 전역 스코프 · 빌드 순서는 build.mjs VIEW_JS)
      index.html · style.css   뼈대 · 스타일 (v3.2 그대로)
      base.js      DOM 유틸 · sim 연결(S, send, q) · 연출용 난수
      art.js       미래·김사장·NPC·배경 SVG       ui.js   장면·대사창·선택지·패널·사이드 메뉴·모달
      fx.js        HUD(스냅샷 기반)·수치 연출·디버그   events.js  sim 이벤트 재생기 · 장면 스크립트 실행기
      phone.js/phone2.js  폰(카톡·주갤·개미증권·뉴스) — 상태 변경은 명령으로
      tut.js       튜토리얼 코치마크·도움말·미니게임 설명 카드
      minigames.js 알바 미니게임 4종 (카페·편의점·상하차·마트 피하기 — 입력·연출 → 0~1 점수)
      panels.js/panels2.js  카지노·경마·복권·빚또·상환·상점·사채·유품(고르기·뽑기 상점)·아침 결산 화면
      main.js      메인 루프(pending → 화면 → 명령) · 엔딩 · 타이틀 · 키 입력 · window.__G(테스트 창구)
  tools/
    load-data.mjs  data/*.json 합치기 (Node)      bots.mjs   헤드리스 봇 전략 5종 (steady·work·invest·gamble·random)
    sim-cli.mjs    수백 판 시뮬 리포트 (--n --strat --maxMonth --rules '{"KEY":값}')   check-sim.mjs  sim 순수성 검사
  tests/
    golden/gen.mjs · golden/vectors/*.json (24개)   run-golden.mjs  검증
```

**규칙:** view 는 상태를 직접 바꾸지 않는다. `send(명령)` → `SIM.apply` → 이벤트 재생. 계산이 필요하면 `q("이름", …)`(= `SIM.query`, 난수 상태를 되돌리는 읽기 전용 호출).
예외: 안 읽음 수 초기화(`read`)·튜토리얼 진행(`guide`·`tutSeen`)도 명령으로 보낸다.

## 2. 실행 흐름 (pending · flow)

- `S.pending` = 플레이어 입력을 기다리는 지점 `{t: 종류, …}`. view 는 pending 종류마다 화면을 띄우고 명령 하나를 돌려준다.
- `S.flow` = 남은 단계 이름 큐. `apply` 는 명령을 처리한 뒤 `run()`: pending 이 없으면 flow 앞에서 단계를 꺼내 실행, 단계가 pending 을 세우면 멈춤.
- 하루 = 3칸 (`RULES.SLOTS` = 3: 0 아침 · 1 점심 · 2 저녁). 주식은 `RULES.STOCK_SLOTS` [0,1] 칸에만, 코인은 언제나. 시세는 칸마다 1번 움직인다.

```
loopTop:  [needMorning → (중독도 100 + 빈털터리면 배드2) → morning] [디버그 유품] → loopTop2
loopTop2: phase=home · slotStart(시세 계획·고래·찌라시 구독·카톡 질문 만료/생성·형나믿지·갤 찌라시·내 글 정산·중독 사건) · save → home
home:     [기절 중이면 입력 없이 AFTER_SLOT] [중독도 80↑ 30% → pending tempt] 집 대사(칸마다 1번, 게임 난수) → pending home
(칸을 쓴 행동 뒤 = AFTER_SLOT) endCheck → faintCheck → menCheck → endSlot → endCheck → menCheck → loopTop
endSlot:  [도박 안 한 칸이면 중독도 −ADD_SLOT_DECAY] → [저녁: 빚또 추첨 → (7일째 + 빚 > 0) 이자일 pending] → market → advance
market:   펀딩비 → 시세 적용 → 청산(증거금 70~90% 손실) → 정보 결과 → 뉴스·알림 → 갤 시황 글 → 큰 손익 반응 → 최대 자산 기록 → 다음 뉴스
advance:  칸+1, 하루 넘김(밤잠 체력 +HP_SLEEP · 도박 안 한 날 중독도 −ADD_DECAY, 60↑면 금단 멘탈↓) · 달 넘김, needMorning
이자일:   choose(현금/정리/대출/김사장 홀짝) → [repay 선택] → 빚 0 이면 정식 엔딩 → paydayMsg  (3개월 강제 정산 없음 · 유품 보상 없음)
menCheck: 멘헤라(스트레스 ≥ 70, posi 90)면 IMPULSE_P 확률로 돌발 매수(pending impulse), 아니면 카톡 탄막(pending menhera)
faintCheck: 체력 0 → 기절(S.faint = 다음 날 마지막 칸 T) · 응급실비 · 그때까지 home 은 입력 없이 지나감
endCheck: 빚 ≤ 0 (그리고 아직 안 깸) → clear · 빚 > DEBT_CAP → bad1/bad2(중독도 ≥ 60)
```

pending 종류: `start · relic · home · map · loc · encounter · loan · work · casino · race · scratch · lotto · repay · shop · relicShop · brokerTrade · menhera · impulse · tempt · payday · ending`.

엔딩 판정: 이자일에 낼 방법이 전부 막힘(현금·정리·대출 한도·내기) 또는 빚 > 5,000만 → 중독도 ≥ `ADD_SECRET`(60)이면 **bad2**, 아니면 **bad1**. 중독도 100 + 현금·평가·대출 여지 다 바닥인 채로 아침 → **bad2**. 빚 0 → **clear** (컷신 뒤 `continue` 로 자유 모드).

## 3. 명령 (view → sim) · `apply(state, {t, …})`

| 명령 | 필드 | 받는 pending | 설명 |
|---|---|---|---|
| `start` | | start | 오프닝(이벤트 `opening`) → 부모님 유품 고르기 |
| `pickRelic` / `relicReroll` | `i` | relic | 유품 고르기(0~2) / 상자 더 뒤지기 1회 |
| `rest` · `map` · `loanOpen` | | home | 쉬기(칸 소모, 체력 +HP_REST · 저녁이면 +HP_REST_EVE) · 지도 · 사채 창 |
| `borrow` / `loanDone` | `amt`(50만·100만·300만) | loan | 사채(선이자) / 닫기 |
| `goTo` | `loc` (`home`·broker·bank·casino·work·pc·shop·lotto·race) | map | 장소 이동 (25% 길거리 정보 → encounter) |
| `encounter` | `ask` | encounter | 길거리 정보 물어보기/무시 |
| `act` / `leave` | `k` (`l-…`, 알바 `l-cafe·l-store·l-ware·l-mart`, 상점 `l-shop·l-relic`) | loc | 장소 행동 / 나가기 (행동했으면 칸 소모) |
| `mgSetup` / `mgResult` | `practice` / `score`(0~1) | work | 미니게임 판 굴리기(난수, `setup.hp·hpm`) / 점수 제출 (체력 30↓면 점수×hpMult) |
| `bet` / `casinoLeave` | `stake`(≤ 현금), `choice` | casino | 한 판 (최대 3판, **상한 없음**) / 일어나기 |
| `raceBet` / `raceLeave` | `i`, `stake`(≤ 현금) | race | 단승식 / 안 건다 |
| `scratchBuy` · `scratchReveal` · `scratchDone` | | scratch | 한 장 사기 · 6칸 다 긁음(정산) · 그만 |
| `lottoBuy` / `lottoDone` | `k` | lotto | 자동 k장 / 됐어 |
| `repay` | `amt` (0 = 취소) | repay | 원금 상환 |
| `shopBuy` / `shopDone` | `id` | shop | 꾸미기 사기·갈아입기 / 다 샀다 |
| `gachaRelic` · `buyRelic` / `relicDone` | · `id` | relicShop | 수상한 물건 뽑기(GACHA_PRICE, 꽝 있음) · 진열장 유품 사기(RELIC_PRICE[등급]) / 끝 (뭐라도 샀으면 칸 소모) |
| `brokerClose` | | brokerTrade | 창구 거래 끝 (그 사이 매매했으면 칸 소모) |
| `reply` | `i` | menhera · impulse | 멘헤라 받아치기 / 돌발 매수 막기 |
| `tempt` | `k` (go·no) | tempt | 도박 유혹: 딱 한 판(현금 반 홀짝, 칸 소모) / 참기 |
| `payday` | `k` (pay·sell·loan·bet / odd·even / repayAll·repayHalf·keep) | payday | 이자일 선택 (김사장 홀짝도 도박 = 중독도↑) |
| `continue` | | ending (clear 만) | 정식 엔딩 뒤 빚 없는 자유 모드로 이어 하기 |
| 폰: `buy` · `sell` · `open` · `close` · `closeCoins` · `report` · `kqReply` · `post` · `upvote` | `tk, amt, where` · `tk, frac, where` · `tk, dir, lev, amt` · `id` · · `paid` · `i` · `k` · `id` | home·map·loc·brokerTrade | 칸 소모 없음 (코인 25배↑ 진입 = 중독도↑) |
| `read` | `what`(kakao·gall·news), `room`, `mine` | 어디서나 | 안 읽음 0 (폰 화면이 보고 있을 때) |
| `guide` / `tutSeen` | `seg`, `reset` / `k` | 어디서나 | 첫날 가이드 단계 · 본 팁 기록 |
| `debug` | `k` (cash·pay·men·zero·aug·hp·addict) | 어디서나 | 디버그 패널 |

잘못된 명령은 상태를 안 바꾸고 `error` 이벤트를 낸다.

## 4. 이벤트 (sim → view)

모든 이벤트는 `{t, …}`. view 설정 `SIM.configure({hud:true})` 면 이벤트마다 그 시점 HUD 스냅샷 `h`(phase·날짜·현금·빚·체력·스트레스·중독도·평가액·유품·기절) 가 붙는다 — view 는 재생 중 HUD 를 이 값으로 그려 "돈이 결과 나올 때 바뀌는" 연출을 유지한다.

| 이벤트 | 필드 | view 처리 |
|---|---|---|
| `say` | `who`(m·me·kim·nar·npc), `name`, `text`, `face` | 대사창 (클릭까지 대기) |
| `hideDlg` · `bubble` · `face` · `scene` · `npc` · `kim` · `hideUi` | | 장면 조작 |
| `fx` | `k`(ash·flex·crack·big), `amt`, `text`… | 청산 재·FLEX·화면 깨짐·큰 글씨 |
| `hp` · `addict` · `ment` · `cash` · `debt` · `repaid` · `augfx` | `d, why` / `d, v` / `m` / `d` / `a` / `id,text` | 떠오르는 숫자·체력바 핑·중독 문턱(30/60/80) 큰 글씨·유품 칩 |
| `relic` | `id, how`(pick·gacha·buy) | 유품 칩 핑 |
| `gacha` | `id` 또는 `junk, text` | 뽑기 캡슐 연출 (상점 패널) |
| `addictEv` | `k`(secret·tempt), `amt` | 몰래 카지노 손익 연출 |
| `impulse` | `tk, amt` | 돌발 풀매수 폰 화면 연출 |
| `faint` · `faintSlot` | | 기절 암전 · 기절 중 칸 넘김 |
| `toast` | `text, kind, app, room` | 상단 한 줄 알림 |
| `kakao` · `feed` · `post` | | 폰 배지 갱신 |
| `tip` | `id, via, bubble, face` | 정보 받음 말풍선 · 튜토리얼 팁 대기열 |
| `tut` | `k` | 튜토리얼 팁 즉시 표시 |
| `morning` | 어제 결산·사건·개념글·카톡 한 줄·`hp`·`addict` | 아침 결산 화면 (클릭까지 대기) |
| `lottoDraw` | `win, rows, tot, conv` | 빚또 추첨 모달 |
| `menhera` | `msgs` | 카톡 탄막 |
| `stake` · `casino` · `race` · `scratch` · `panelEnd` | 판 결과 (`show`: 구슬 수·카드·릴·사다리) | 패널 연출 (경마: 1등 말 흔들림·빛남) / 닫기 |
| `bought` · `outfit` | | 옷·방 다시 그리기 |
| `trade` · `report` · `posted` | 결과 | 폰 메시지 |
| `tick` · `tickFloat` | | 칸 끝 |
| `opening` | | 장면 스크립트 `SCENES.opening` 실행 |
| `ending` | `kind`(clear·bad1·bad2), `variant`, `sb`(스코어보드) | (clear 면 `SCENES.clear` 컷신) → 엔딩 화면 + 스코어보드 (`S.endInfo`) · 기록 저장 |
| `continued` | | 자유 모드 시작 |
| `save` | | localStorage 저장 (칸 시작) |
| `error` | `msg` | 콘솔 경고 |

스코어보드 `sb` = `{kind, profit(투자 실현+평가), gnet(도박 순손익), earned(알바), maxAsset(최대 현금+평가), repaid(갚은 빚), debt, days, month, day, gW/gN(도박 승/판), iW/iN(투자 승/청산·매도), liq, fame, rank, addict, interest, faint, impulse}`.

## 5. 상태 스키마 (`S`, JSON 직렬화 가능, 저장 = 이 JSON)

| 필드 | 뜻 |
|---|---|
| `version` (34) · `rngv` (2) · `seed` · `rng` · `fx` | 상태 버전 · 난수 규격 · 시드 · 게임 난수 상태(uint32) · 연출 난수 상태(uint32) |
| `month` · `day` · `slot` · `phase` | 1~ · 1~7 · 0~2(아침·점심·저녁) · opening/home/morning/payday/ending |
| `cash` · `debt` (원, 정수) · `hp` · `stress` · `addict` · `galFame` | 돈 · 체력 0~100 · 스트레스 0~100 · 도박 중독도 0~100 · 갤 명성 |
| `pending` · `flow` · `visit` | 입력 대기 · 남은 단계 · 지금 방문 중인 장소 `{key, used}` |
| `mk` | 시세 `{reg, 종목: {p, tr, hist[40]}}` · `mplan` 이번 칸 계획 · `shocks` 칸별 숨은 충격 · `news` 다음 뉴스 |
| `hold` · `cps` · `pid` | 주식 `{tk:{q,cost,t0,bday}}` · 코인 포지션 `[{id,tk,dir,lev,margin,entry,mult,t0,bonus}]` |
| `tips` · `srcStat` · `rsch` · `whale` · `repT` | 정보 · 출처별 [맞음,전체] · 오늘 리포트 횟수 · 고래 힌트 · 박대리 받은 칸 |
| `posts` · `gid` · `wrote` · `gNew` · `gReact` | 주갤 글(최대 70) · id 카운터(글·팁 공용) · 오늘 쓴 글 수 · 안 읽음 |
| `kk` · `kun` · `kq` · `feed` · `fUnread` | 카톡 방 3개 · 안 읽음 · 미래 질문 · 뉴스 알림 |
| `augs` · `relicOffer` · `outfit` · `owned` · `props` | 보유 유품 id (필드 이름은 구 '증강' 그대로) · 오늘 진열장 `{d, ids[3]}` · 옷 · 산 옷 · 방 소품 |
| `faint` · `gday` · `gT` · `temptT` | 기절 끝나는 칸 T(−1 = 아님) · 마지막으로 도박한 날·칸 · 유혹 뜬 칸 |
| `cleared` · `resume` · `endSeen` | 정식 엔딩 봄(자유 모드) · 엔딩 직전 flow (continue 로 이어감) · 이번 판 본 엔딩 |
| `today` · `yday` · `eqh` · `realized` · `invIn` | 오늘/어제 기록 · 투자 손익 곡선 |
| `st` | 통계 (work·gamble·invest·liq·earned·borrowed·decor·maxDebt·menOk·menBad·bigWin·interest·repaid·race·lotto·pc·g{게임별} · gN·gW·gnet·iN·iW·maxAsset·minDebt·faint·gacha·impulse·tempt·secret) |
| `paidMonth` · `insUsed` · `kimpDay` · `kimBig` · `menKey` · `menCool` · `startT` · `hl` · `lotto` · `workStreak` · `lastJob` · `needMorning` | 규칙 보조 |
| `tg` · `tgT` · `tutSeen` · `optTut` | 첫날 가이드 단계 · 본 팁 |
| `ending` · `endInfo` | 엔딩 종류 · 엔딩 화면 데이터(문구·스코어보드 포함) |

호감도(`aff`)·호감도 캔들(`candles`·`cur`)·3개월 정산(`final`)·테이블 리밋은 v3.3 2단계에서 삭제.

## 6. 난수 규격 (rngv 2 — C# 이식 기준)

두 줄기: `S.rng` = **게임 규칙** 난수(시세·뉴스·팁·도박·미니게임 판·증강·이벤트…), `S.fx` = **연출 선택** 난수(대사 고르기·갤 글 문구·돈 환산 드립). 둘 다 상태에 저장. 파티클 위치 같은 순수 화면 연출은 view 자체 난수(상태 밖).
`fx` 는 결과(돈·빚·시세)에 영향을 주면 안 된다 (v3.2 에서 어긴 곳 1개를 v2 에서 고침 — §11).

**mulberry32** (상태 uint32 `a`, 출력 uint32):
```
a = a + 0x6D2B79F5                       (mod 2^32)
t = (a ^ (a >> 15)) * (a | 1)            (mod 2^32, >> 는 논리 시프트)
t = (t + ((t ^ (t >> 7)) * (t | 61))) ^ t
out = t ^ (t >> 14)
```
C#: `uint a; a += 0x6D2B79F5u; uint t = (a ^ (a >> 15)) * (a | 1u); t = (t + ((t ^ (t >> 7)) * (t | 61u))) ^ t; return t ^ (t >> 14);` (`unchecked`).
JS 는 `Math.imul`·`|0`·`>>>0` 로 같은 값 (`sim/rng.js m32`). 상태 초기값: `rng = seed >>> 0`, `fx = (seed ^ 0x2545F491) >>> 0`.

| 파생 | 정의 (전부 IEEE-754 double 사칙연산 → C# 과 비트 단위 동일) |
|---|---|
| `rnd()` | `out / 4294967296.0` (0 ≤ x < 1, 정확) |
| `pick(arr)` | `arr[floor(rnd() * arr.length)]` |
| `gauss()` | `rnd()` 12번 합 − 6 (Irwin–Hall, 합이 정확히 표현됨) |
| `sq(x)` | `x * x` |
| `pexp(x)` | k = floor(x/ln2 + 0.5), r = x − k·ln2, e^r = 테일러 20항(term = term·r/i), ×2 또는 ÷2 를 |k|번 |
| `plog(x)` | x = m·2^e (m∈[1,2), ÷2·×2 반복), s=(m−1)/(m+1), 2·Σ_{i<30} s^(2i+1)/(2i+1) + e·ln2 |
| `ln2` 상수 | `0.6931471805599453` |

**테스트 값** (C# 구현이 그대로 나와야 함):

| 입력 | 결과 |
|---|---|
| seed 1 → out 5개 | 2693262067, 11749833, 2265367787, 4213581821, 4159151403 (상태 567894474) |
| seed 42 → out 5개 | 2581720956, 1925393290, 3661312704, 2876485805, 750819978 |
| seed 20261011 → out 5개 | 1488163886, 3496767163, 2460547021, 1222184908, 208299103 |
| seed 1: rnd ×3 | 0.6270739405881613, 0.002735721180215478, 0.5274470399599522 |
| 이어서 gauss ×3 | 0.7189959576353431, −1.496482246555388, 0.45057579781860113 (rng 상태 2711589972) |
| pexp(−0.5) · pexp(0.1) · pexp(2.5) | 0.6065306597126336 (`3fe368b2fc6f960c`) · 1.1051709180756473 (`3ff1aec7b35a00d2`) · 12.182493960703477 (`40285d6fd931e0bd`) |
| plog(0.5) · plog(1.1) · plog(1000) | −0.6931471805599453 (`bfe62e42fefa39ef`) · 0.09531017980432493 (`3fb8663f793c46cc`) · 6.907755278982137 (`401ba18a998fffa0`) |
| fnv1a("abc") · fnv1a("") | `1a47e90b` · `811c9dc5` |

**rngv 1 (v3.2 호환, 웹 회귀 비교 전용):** 같은 mulberry32(상태 int32) + Box–Muller(Math.log·cos·sqrt) + Math.pow·exp·log + 펀딩비 실수 + 물타기 반응 팁 작성자를 fx 로. JS 엔진 수학 함수 의존이라 C# 이식 대상 아님. 웹: `?rng=v1`, Node: `createGame(seed, {rngv: 1})`.

UI 전용 계산(`liqOdds` 청산 확률 표시)은 Math.exp·hypot 를 써도 됨 (상태에 안 들어감).

## 7. 반올림·돈

- 돈(현금·빚·일당·판돈·배당·보험금·수수료·펀딩비)은 **원 단위 정수**.
- 반올림은 `roundHalfUp(x) = floor(x + 0.5)` 하나 (−2.5 → −2, 2.5 → 3). 1000원 단위는 `round1k(x) = roundHalfUp(x/1000)*1000` (이자).
- **C# 주의:** `Math.Round` 기본값은 은행가 반올림(2.5 → 2) → 쓰지 말 것. `Math.Floor(x + 0.5)` 사용. `(int)` 캐스트는 0 쪽 버림이라 음수에서 다름.
- 내림이 필요한 곳은 `Math.floor` 그대로 (판돈 10,000원 단위·주문 1,000원 단위), 부족분 대납은 `Math.ceil`.
- 주식 수량(`q`)·시세(`p`)·평가액은 실수(double). 사칙연산만 쓰므로 C# double 과 같은 비트.

## 8. 데이터 파일 (`web/src/data/*.json`, 빌드 때 합쳐 인라인 · 최상위 키가 겹치면 안 됨)

| 파일 | 테이블 | 쓰는 곳 |
|---|---|---|
| rules.json | RULES(빚·이자·한도·수수료·펀딩비·청산 손실 LIQ_LOSS·복권 값·체력 HP_*·중독 ADD_*·돌발 매수 IMPULSE_*·유품 가격 GACHA_*/RELIC_*…), SLOT_NAME/IC/CLOCK(3칸), CAS_TITLE, SCRATCH_SYM | sim 전반 |
| tickers.json | TK(종목 7), NEWS | market |
| augments.json | AUGS(유품 17: 구 증강 16 리스킨 + 산삼주), TIER(수상함·골동품·가보), RELIC_JUNK(뽑기 꽝) | flow·places·view |
| jobs.json · items.json | JOBS(알바 4: base·var·hp) · ITEMS(꾸미기 9), DECOR_END | games·places·엔딩 |
| locations.json · npcs.json | LOCS(장소 8, 지도 좌표·영업 칸), GREET · NPCS(외형) | places·view |
| sources.json | SRC(정보 출처 15: 적중률·크기·시차), TIER_NM, TIP_REACT | tips |
| gall.json | GAL·GR_T·HOT(반응 글), GN(고닉), FAME·RANKS, TIPT·CM·TIP_RES·MYCM(글·댓글), GW(글쓰기) | gall |
| lines.json | ML(미래 대사), MEN_SETS(멘헤라), IMPULSE(돌발 매수 받아치기), MORNING_EV, PC_EV, KQ(카톡 질문), KIM_DM, HY_TALK | talk·flow·gall |
| casino.json | SLOT_SYM, RK·SU(카드), HORSES, SC_PRIZE, LOTTO_PRIZE | games |
| conv.json | CONV (돈 환산: 삼각김밥·국밥…) | fmt.conv |
| strings.json | STR (sim 이 내는 문구 템플릿, `{변수}`) | sim 전부 |
| endings.json | ENDINGS (clear·bad1·bad2: 태그·제목·배경 + 변형 hv·bgv·noCharV — gamble/gall·sea/loop·casino) | flow.ending |
| scenes.json | SCENES(장면 스크립트: opening·clear 컷신), RULES_TEXT | view 장면 실행기 |
| tutorial.json | TUT_FLOW(첫날 가이드 28단계), TUT_SEGS, TIPS(화면별 도움말 + tempt·impulse), GLOSS(용어집), MGHOW(미니게임 설명 4종) | view tut |
| kakao.json · art.json | KROOM(카톡 방) · FACES(표정) | view |

view 템플릿(패널 버튼 이름 같은 UI 크롬)의 한글은 view 에 남겨 둠 — 유니티에선 프리팹/UXML 에 다시 만들 부분.

## 9. 웹 모듈 ↔ 유니티 C# 대응

**asmdef 3개 + 테스트**

| asmdef | 내용 | 설정 |
|---|---|---|
| `KwGame.Sim` (`Assets/Scripts/Sim/`) | sim 전부 (순수 C#) | `noEngineReferences: true`, 참조 없음. JSON 파싱은 System.Text.Json 대신 엔진 독립 파서(예: 작은 자체 파서 또는 Newtonsoft 패키지 `com.unity.nuget.newtonsoft-json`) |
| `KwGame.View` (`Assets/Scripts/View/`) | uGUI(현재 manifest 에 있음) 또는 UI Toolkit 화면, 이벤트 재생기, 미니게임 | 참조: KwGame.Sim, Unity.TextMeshPro(선택) |
| 데이터 | `Assets/StreamingAssets/Data/*.json` (웹과 같은 파일 복사) 또는 `TextAsset`(Resources/Addressables) | 런타임 로드 → `Sim.Data.Load(json…)` |
| `EditModeTests` (이미 있음) | 골든 벡터 테스트 · 난수 테스트 값 · 반올림 | 참조 추가: KwGame.Sim. 벡터는 `web/tests/golden/vectors` 를 `Assets/Tests/EditMode/Golden/` 로 복사(스크립트) |

**파일 단위 대응**

| 웹 (`web/src/sim`) | C# (`KwGame.Sim`) | 메모 |
|---|---|---|
| core.js `bind/st/emit`, `D` | `GameSim` (State·List<SimEvent> 필드) · `GameData` (테이블 클래스) | st() 패턴 → 인스턴스 메서드 |
| rng.js | `Rng` (static: `Next(ref uint)`, `Float`, `Gauss`, `Pick`, `PExp`, `PLog`) | §6 테스트 값으로 단위 테스트 |
| num.js · fmt.js | `MathK.RoundHalfUp` · `Fmt` (won/man/pct, `T(key, vars)` 템플릿) | 숫자 포맷: `ToString("N0", ko-KR)` = JS toLocaleString |
| state.js | `GameState` (직렬화 클래스, 필드명 그대로 camelCase) + `Calc` (holdVal…) | 저장 = JSON 그대로 |
| market.js · tips.js · trade.js | `Market` · `Tips` · `Trade` | |
| effects.js · talk.js · gall.js | `Effects` · `Talk`(이벤트 생성) · `Gall` | 문구는 전부 GameData.STR |
| games.js · places.js | `Games` (Work/Casino/Race/Scratch/Lotto) · `Places` | |
| flow.js · api.js | `Flow` (단계 큐) · `GameSim.Create(seed, opts)` / `Apply(cmd)` | 명령 = `SimCommand {t, …}` (JSON 그대로 파싱 가능하게) |
| query.js | `GameSim` 읽기 메서드 | |
| digest.js | `Digest.Of(state)` · `Fnv1a` | 골든 비교 |

| 웹 (`web/src/view`) | 유니티 |
|---|---|
| main.js 메인 루프(pending → 화면) | `GameController` (MonoBehaviour): `switch(state.pending.t)` → 화면 프리팹 |
| events.js 재생기 | `EventPlayer` (코루틴/async: say 는 클릭 대기, HUD 는 e.h 스냅샷) |
| ui.js · fx.js · art.js | 대사창·선택지·사이드 메뉴·HUD 프리팹 / 파티클 / 스프라이트(SVG 대신 그림) |
| panels*.js · minigames.js | 카지노·경마·복권·상점 패널, 미니게임 씬 (0~1 점수 → `mgResult`) |
| phone*.js | 폰 오버레이 (카톡·주갤·증권·뉴스) |
| tut.js | 코치마크 (TUT_FLOW 데이터 그대로) |

## 10. 골든 벡터 워크플로

1. `node web/tests/golden/gen.mjs` — 헤드리스 봇 5전략 × 시드 4개(전체 판) + 앞부분만 자른 4개 = **24개** 생성 (`vectors/*.json`: `{name, seed, opts, commands[], expected{hash, events, end, month, day, slot, cash, debt, galFame, augs, rng, fx, pending}, digest}`).
2. `node web/tests/run-golden.mjs` — 재생해서 비교 (현재 24/24 통과, ~0.2초). 실패하면 digest 첫 차이 항목을 찍는다.
3. sim 규칙·난수·데이터 수치가 바뀌면: 의도한 변경인지 확인 → gen 다시 실행 → 벡터 diff 를 커밋에 포함.
4. 유니티: EditMode 테스트가 같은 벡터를 읽어 `GameSim.Create` → `Apply` 반복 → `Digest`·해시·수치 비교. **digest 는 숫자만** (실수는 IEEE 비트 16진, 문구 제외) → 포맷 차이 없이 비트 단위 비교. 해시 = FNV-1a 32 (digest 는 ASCII).
5. 디버깅: 앞부분 벡터(`random_7_first20` …)부터 맞추면 어느 단계에서 갈라지는지 빨리 찾는다. 이벤트 수(`events`)도 비교.

## 11. 이식 순서 (제안)

1. `Rng`·`MathK`·`Fnv1a` + §6 테스트 값 단위 테스트.
2. `GameData` 로더 (data JSON 18개) + `Fmt.T`.
3. `GameState` + `Calc`(state.js) + `Market`(시세만) → 시드 고정 시세 비교 (createGame 직후 digest).
4. `Effects`·`Tips`·`Gall`·`Talk`·`Trade`·`Games`·`Places`·`Flow`·`Apply` → 골든 `random_7_first20` → `first60` → `first150` → `first300` → 전체 16개 순서로 통과.
5. view: 이벤트 재생기 + 집/지도/장소 메뉴 → 대사·HUD → 패널·미니게임 → 폰 → 튜토리얼.
6. (완료) 2단계(하루 3칸·체력·유품·엔딩 3종 등, `concept_v33.md` §2) — §13.

## 12. v3.2 → v3.3(1단계)에서 달라진 것

- 구조만 바꿈 (게임 내용·UX 동일). 같은 시드·같은 봇: rngv 1(v3.2 호환)에서 v3.2 와 결과 동일 (아래 1개 예외), rngv 2 는 난수 규격이 달라 결과가 다름(허용된 차이).
- **예외 (v3.2 버그):** '물타기 질문' 내 글에 달리는 고닉 찌라시의 작성자를 v3.2 는 연출 난수(파티클·대사와 공유)로 뽑았는데, 작성자에 따라 적중률·크기가 달라 시세에 영향. 연출 난수 상태가 화면 연출 횟수에 따라 달라져 재현 불가 → v3.3 sim 은 연출 난수를 sim 전용(S.fx)으로 분리(rngv 1)했고, rngv 2 에선 게임 난수로 뽑는다.
- rngv 2 에서 바뀐 규칙 계산: gauss(Box–Muller → Irwin–Hall 12), Math.pow/exp/log → 사칙연산 구현, 코인 펀딩비 원 단위 반올림, 위 작성자 게임 난수.
- 저장 키 `longjab_v33` (v3.2 저장은 이어하기 안 됨 — 상태 구조가 바뀜).
- 안 읽음 수: v3.2 는 '보고 있으면 안 올림', v3.3 는 sim 이 올리고 view 가 `read` 로 0 처리 (화면 결과 같음).
- 김사장 '고소' 카톡(내 글 정산 때)이 1.2초 뒤가 아니라 즉시 기록.
- 글·팁 id(`gid`) 는 연출 난수에 따라 시황 글 수가 달라져 v3.2 와 번호가 다를 수 있음 (규칙 영향 없음).

## 13. v3.3 2단계(기능·밸런스)에서 달라진 것

| 항목 | sim | data | view |
|---|---|---|---|
| 하루 3칸 | `SLOTS` 3, `STOCK_SLOTS` [0,1], `isEve()`, 시세 칸당 1번 (vol ×1.155·drift ×4/3·시장 노이즈 0.0058/0.0092·펀딩 0.0027 → 하루 변동 유지) | rules·tickers·locations(영업 칸) | HUD 점 3개, 문구 '칸' |
| 체력 | `S.hp`, `effects.hp`, 알바 `JOBS.hp`·행동 `HP_COST`, 저녁 잠 +50 · 쉬기 +30(저녁 +45), 30↓ 점수×(0.4~1.0), 0 → `faintCheck` 기절(오늘 남은 칸 + 다음 날, 응급실 10만) | rules HP_* | 체력바 `#hHp`, 기절 연출, 집 메뉴 '일찍 자기' |
| 호감도 삭제 | `aff`·캔들·`block` 엔딩 삭제, 표정·아침 줄·엔딩 대사는 스트레스·체력 기준 | strings·items·lines(aff 제거) | 호감도 캔들 → 체력바 |
| 유품 | pending `relic`(시작 상자) · `relicShop`(뽑기/진열장), 이자 보상 증강 삭제, 새 유품 `ginseng`(체력 소모 −30%) | augments(이름·설명 리스킨, TIER, RELIC_JUNK) | 유품 상자·상점(캡슐 연출) |
| 엔딩 3종 | `clear`(컷신 → `continue` 자유 모드) · `bad1`(끌려감, 변형 gall) · `bad2`(도박 중독, 변형 loop·회상), 3개월 정산 삭제, `scoreboard()` | endings·strings·scenes.clear | 엔딩 화면 + 스코어보드, 기록 localStorage |
| 도박 중독도 | `S.addict`: 판돈 비율² 가중 + 대박·대손실 보너스, 코인 25배↑, 김사장 홀짝 · 도박 안 한 칸 −3, 안 한 날 −3 · 30 조름 / 60 몰래 카지노·금단 / 80 유혹(pending `tempt`) | rules ADD_* · strings add.* | HUD 중독 배지, 문턱 큰 글씨 |
| 베팅 상한 폐지 | casino·race `stake ≤ cash` (`limitOf`·`LIMIT0` 삭제), 사채 한도 단계 유지 | casino | 판돈 UI '상한 없음' |
| 청산 70~90% | 청산 때 `margin × (1 − U(0.7,0.9))` 돌려줌 (보험은 최소 절반) | rules LIQ_LOSS | |
| 돌발 매수 | 멘헤라면 `IMPULSE_P`(40%) → pending `impulse`, 틀리면 현금 90% 풀매수 + 그 칸 ±12~30%(코인 ±20~45%) | lines IMPULSE | 폰 '풀매수' 연출 |
| 피하기 알바 | `JOBS.mart`, `workSetup` 이 `drops[[t,x,kind]]` 굴림 | jobs·tutorial MGHOW | `mgMart` (←→/A·D/버튼/드래그, 체력→속도) |
| 경마 결승 | | | 1등 말 흔들림·빛남·레인 하이라이트 |

밸런스 (`node web/tools/sim-cli.mjs`, 미니게임 점수 0.6~0.8 가정, 2026-10-11):

| 전략 | 판 | 클리어(빚 0) | ≤5개월 | 평균/중앙 클리어 개월 | bad1 | bad2 | 미결 |
|---|---|---|---|---|---|---|---|
| steady (알바 + 증권사 정보 주식) | 300 | 100% | 72.0% | 5.0 / 5 | 0 | 0 | 0 |
| work (알바만) | 300 | 100% | 18.3% | 6.4 / 7 | 0 | 0 | 0 |
| invest (정보 + 코인) | 300 | 99.7% | 56.7% | 5.4 / 5 | 0 | 0 | 0.3% |
| gamble | 3000 | 3.0% | 3.0% | 1.2 / 1 | 0 | 97.0% | 0 |
| random (최대 36개월) | 300 | 4.0% | 1.0% | 12.3 / 13 | 51.0% | 41.7% | 3.3% |

튜닝에 쓴 값: 일당(카페·편의점 15+27만, 상하차 20+31만, 마트 17+29만 × 점수), 증권사·리서치 적중 0.8/0.78·크기 8~14%, 슬롯 777 ×50, 홀짝 49.5%, 빚또 1등 4,000만(3개 10만). 실험은 `--rules '{"KEY":값}'` 로 파일 안 바꾸고 해 볼 수 있다.
