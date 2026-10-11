# 롱잡고알바감 — Unity 이식 (1차 초안)

> 웹 sim(`web/src/sim`, 기준 커밋 **4ff230c** — 처음 이식은 996af67, v3.3b 리밸런스 재동기화)을 C#으로 옮기고, 같은 JSON 데이터와 골든 벡터로 비트 단위까지 맞춘 뒤, 전체 루프가 도는 최소 화면을 붙인 상태다.
> 구조·규격은 `docs/ARCHITECTURE.md`, 작업 기록은 `docs/UNITY_PROGRESS.md` 참고.

## 1. 폴더 구조

```
Assets/
  Scripts/
    Sim/                    KwGame.Sim (asmdef: noEngineReferences, 참조 = Newtonsoft.Json.dll 하나) — 순수 C#, dotnet 에서도 빌드됨
      Rng.cs                mulberry32(uint) · Float · Gauss(Irwin–Hall 12) · PExp/PLog(사칙연산) · MathK(RoundHalfUp·Round1k) · Fnv1a
      JsFmt.cs              JS 숫자 문자열 흉내: toFixed(정확한 이진값 기준) · toLocaleString("ko-KR") · String(number)
      GameData.cs           data/*.json 합치기(파일 이름순, 키 순서 유지) + 타입 테이블(Rules·Ticker·Job·Source·Aug…)
      GameState.cs          상태 스키마(JS 필드 이름 그대로) · OMap(삽입 순서 맵 = JS 객체 키 순서) · Pending(모든 종류 필드 합집합)
      GameSim.*.cs          sim 본체 — 한 클래스 partial 파일로 나눔 (JS 의 st() = 인스턴스 S)
        Core      core·fmt·state.js (이벤트·난수 래퍼·포맷·상태 읽기·HUD 스냅샷)
        Market    market.js        Effects  effects.js + talk.js     Tips  tips.js        Gall  gall.js
        Trade     trade.js         Games    games.js                 Places places.js    Flow  flow.js
        Api       api.js + query.js (Create · Apply · Query)
      SimCommand.cs         명령 = JSON 객체 그대로 (k·id 처럼 문자열/숫자 겸용 필드 때문에 JObject 래핑)
      Digest.cs             digest.js (골든 비교용 숫자 요약 + FNV 해시)
      Bots.cs               web/tools/bots.mjs (헤드리스 봇 5전략, 봇 LCG 도 JS double 연산 그대로)
    View/                   KwGame.View (UI Toolkit, 코드로 화면 생성)
      Ui.cs                 스타일 도우미 · 이모지 제거(표시용) · 점수 막대(테마 없는 슬라이더)
      GameController.cs     메인 루프 + 이벤트 재생기(say 클릭 대기, 아침 결산, 장면 스크립트 opening/clear)
      GameController.Screens.cs  HUD · pending 별 행동 패널 · 폰(증권/카톡/주갤/정보) · 엔딩+스코어보드
      GameController.Demo.cs     `-kwShots <폴더>` 스크린샷·화면 경로 재생 검증
  Resources/
    Data/*.json             web/src/data 복사본 (런타임 로드, 수정 금지 — 원본은 web/)
    Fonts/Pretendard-*.ttf  한글 폰트 (SIL OFL 1.1 원문 = OFL.txt)
  Scenes/Main.unity         카메라 + GameController (빌드 설정 1번). Boot.unity 는 비활성으로 남김
  Tests/EditMode/
    GoldenTests.cs          RNG 규격값 · 반올림/포맷 · 골든 24 · 봇 명령열 24
    Golden/{data,vectors}   4ff230c 고정 픽스처 (REF.txt)
  Editor/BuildCli.cs        Init · Build* · SyncData · MakeMainScene (메뉴 KwGame/…)
dotnet/SimHarness/          Unity 없이 sim 검증하는 콘솔 (Unity 번들 dotnet 8 사용)
```

## 2. 데이터 동기화 (JSON 단일 원본 = `web/src/data`)

| 방법 | 내용 |
|---|---|
| `./unity sync-data` | 작업 트리 `web/src/data/*.json` → `Assets/Resources/Data` (Unity 안 띄움, 즉시) |
| `./unity sync-data <ref>` | 특정 커밋의 데이터로 (`git archive`) |
| 에디터 메뉴 **KwGame → Sync Data (web → Resources)** | 같은 복사 + AssetDatabase.Refresh (`./unity exec KwGame.EditorTools.BuildCli.SyncData` 도 가능) |
| `./unity sync-golden [ref]` (인자 없으면 4ff230c) | 테스트 픽스처(data + vectors)를 `Assets/Tests/EditMode/Golden` 로 교체 |

런타임은 `Resources.LoadAll<TextAsset>("Data")` → `GameData.Load` (파일 이름순 병합, `tools/load-data.mjs` 와 같음).
테스트는 픽스처만 본다 → web 이 바뀌어도 테스트는 안 깨짐. 기준을 옮길 때만 `sync-golden <새 ref>`.

## 3. 테스트

```
./unity simtest            # 1초 내외. Unity 없이 RNG 값 + 골든 24 + 봇 명령열 24 (dotnet/SimHarness)
./unity simtest steady     # 이름 필터
GOLDEN_ROOT=<폴더> ./unity simtest   # 다른 data/vectors 폴더로 (예: 작업 트리 벡터)
./unity test edit          # Unity EditMode (현재 54 passed: 기존 2 + 규격 4 + 골든 24 + 봇 24)
```

골든 테스트는 digest 문자열 전체를 비교하고, 다르면 첫 차이 항목을 찍는다 (`digest[i]: 기대 · 실제`).
에디터가 프로젝트를 열고 있으면 `./unity test/build` 는 거부된다 (simtest 는 상관없음).

## 4. 빌드 · 실행 · 스크린샷

```
./unity init               # Main 씬 생성 + 빌드 설정 (재실행 안전)
./unity build mac          # Builds/Mac/롱잡고알바감.app (≈73MB)
./unity run                # 실행
# 스크린샷 데모: 화면 12장 + 봇 3판을 화면 경로로 재생하며 pending 화면별 1장 → 끝나면 종료
Builds/Mac/롱잡고알바감.app/Contents/MacOS/롱잡고알바감 -screen-width 1920 -screen-height 1080 -screen-fullscreen 0 -kwShots <폴더>
```

화면 기술: **UI Toolkit (코드 생성)**. 이유 — 메뉴·선택지가 전부 데이터/pending 에 따라 바뀌어서 프리팹보다 코드 + flex 레이아웃이 빠르고, PanelSettings 하나로 1920×1080 기준 스케일(ScaleWithScreenSize)이 끝난다. 테마 스타일시트 없이 인라인 스타일만 쓴다 (나중에 USS 로 뺄 것).

## 5. 이식 현황

### 끝난 것 (웹과 비트 단위 일치 확인)
- sim 전부: 난수 v2, 시세·뉴스·청산 경로, 정보(팁)·출처 기록, 주갤(글·댓글·찌라시·내 글 정산)·카톡 질문·형나믿지 DM, 주식·코인(펀딩비·청산·유품 효과), 알바 판 굴리기(4종 setup), 카지노 4종·경마·즉석 복권·빚또, 은행·상점·유품(상자·뽑기·진열장)·사채·길거리 정보, 하루 흐름(아침·칸 시작/끝·이자일·멘헤라·돌발 매수·도박 유혹·몰래 카지노·금단·기절·엔딩 3종·스코어보드·계속하기), 디버그 명령, query(난수 되돌림).
- 골든 벡터 24/24 (hash·이벤트 수·digest 전체), 봇 5전략이 벡터 명령열 24개를 그대로 재생성.
- 화면 경로 검증: 봇 3판(2,321 명령)을 GameController.Send → 이벤트 재생 → 렌더 로 돌려도 해시가 골든과 같고 예외 0.

### 자리만 잡아 둔 것 (placeholder)
- **미니게임**: 실제 게임 대신 점수 막대/버튼으로 0~1 점수 제출 (`mgSetup` 판 데이터는 sim 이 정상 생성 — `P.setup.orders/u/drops/w`).
- **그림**: 캐릭터·배경은 색 패널 + 이름/표정 텍스트. 김사장·NPC 는 라벨.
- **연출**: 떠오르는 숫자·청산 재·화면 깨짐·카드/릴/사다리/경마 애니메이션 없음 → 결과는 토스트 한 줄. 이벤트 `h`(HUD 스냅샷)로 HUD 는 재생 시점 값으로 갱신됨.
- **폰**: 증권(사기 10%/50%·전부 팔기, 코인 롱/숏 x1·x10·최대 10%, 청산), 카톡(질문 답장·최근 대화), 주갤(글쓰기 5종·최근 글), 정보 수첩만. 차트·뉴스 피드·글 상세·개추 없음.
- **튜토리얼**(TUT_FLOW·코치마크·도움말), **저장/이어하기**(OMap 은 아직 JSON 직렬화 변환기 없음), **기록(엔딩 기록)**, 사운드 없음.
- **이모지**: 번들 폰트(Pretendard)에 이모지가 없어 표시할 때 지움 (`Ui.Clean`). 이모지 폰트(예: Noto Emoji 흑백) 폴백 추가 필요.

## 6. 이식하면서 맞춘 JS 동작 (다시 손댈 때 주의)
- 돈·수치는 전부 `double` (JS number 와 같은 연산 순서). 반올림은 `MathK.RoundHalfUp` 하나 (`Math.Round` 금지).
- 연출 난수 `S.fx` 소비 순서가 digest 에 들어가므로 **문구 생성도 같은 순서로 평가**해야 함 (객체 리터럴 필드 순서, `conv()` 가 쓰이지 않아도 호출되는 곳 등).
- 갤 반응 글은 "최근 댓글과 같은 문장 제외" 필터가 있어 문구 문자열(toFixed·천 단위 쉼표)이 결과에 영향 → `JsFmt` 로 정확히 흉내.
- JS `str.replace("{x}", …)` 는 **첫 번째만** 바꿈 (`replace1`), 정규식 `/g` 만 전부.
- JS `for…of` 는 도중에 바뀌는 배열을 인덱스로 따라감 (`gallTick` 의 내 글 정산 — 스냅샷 쓰면 틀림).
- JS 객체 키 순서 = 삽입 순서 → `OMap`, 데이터 테이블은 JSON 순서 리스트(`TKList`·`JOBList`·`SRCList`·`LOCList`·`GNKeys`).
- digest 정렬은 ordinal (`st.gN` < `st.gacha`).

## 7. 웹 리밸런스(v3.3b, 4ff230c) 재동기화 — 완료
- sim 코드: 목장갑 배율 `R().GRIND_PAY` (`Rules.GRIND_PAY`, 데이터에 없으면 1.3).
- 봇: steady 1개월 1일 아침 사채 300+100만 종잣돈 · 미니게임 점수 `mgLo + br()·(mgHi − mgLo)` (`Bots.Run(..., mgLo: 0.6, mgHi: 0.8)` 파라미터 = bots.mjs 의 MG 환경변수).
- 픽스처 `./unity sync-golden 4ff230c`, 런타임 데이터 `./unity sync-data` (작업 트리 data = 4ff230c 와 동일).
- 다음에 기준을 옮길 때: `./unity sync-golden <커밋>` → `./unity sync-data` → sim/봇 diff 반영 (`git diff <이전> <새> -- web/src/sim web/tools/bots.mjs`) → `./unity simtest` · `./unity test edit`.

## 8. 다음 단계
1. 저장/이어하기: GameState JSON 직렬화(OMap 변환기) + 웹 저장 포맷(`longjab_v34`)과 호환 여부 결정.
2. 미니게임 4종(카페 주문·편의점·상하차·마트 피하기)을 `setup` 데이터 그대로 써서 구현 → 0~1 점수.
3. 연출: 이벤트별 애니메이션(숫자 팝업·청산 재·카드/슬롯/사다리/경마), 캐릭터 스프라이트(FACES 표정).
4. 폰 완성(차트·뉴스 피드·글 상세·개추·안 읽음), 튜토리얼(TUT_FLOW 코치마크), 엔딩 기록.
5. UI 를 USS/UXML 로 분리, 이모지 폰트 폴백, WebGL 빌드 확인 (Resources 로드라 그대로 될 것).
