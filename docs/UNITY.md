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
      ArtCatalog.cs         그림 키 → 스프라이트 표 (장면 bg·표정·NPC·CG·유품/꽝 아이콘, Resources.Load + 캐시)
      GameController.Art.cs 무대 그림: 배경·CG·미래 스탠딩 표정·NPC/김사장 초상 고르기 (§9)
      GameController.cs     메인 루프 + 이벤트 재생기(say 클릭 대기, 아침 결산, 장면 스크립트 opening/clear)
      GameController.Screens.cs  HUD · pending 별 행동 패널 · 폰(증권/카톡/주갤/정보) · 엔딩+스코어보드
      GameController.Demo.cs     `-kwShots <폴더>` 스크린샷·화면 경로 재생 검증
  Resources/
    Data/*.json             web/src/data 복사본 (런타임 로드, 수정 금지 — 원본은 web/)
    Fonts/Pretendard-*.ttf  한글 폰트 (SIL OFL 1.1 원문 = OFL.txt)
    Art/                    그림 67장 (docs/ART.md). Editor/ArtImporter.cs 가 스프라이트로 가져옴
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
# 스크린샷 데모: 화면 22장(오프닝 CG·집 낮/밤·장소 NPC·유품 상점/뽑기·표정·엔딩 3종 포함) + 봇 3판을 화면 경로로 재생하며 pending 화면별 1장 → 끝나면 종료
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
- **그림**: §9 대로 연결됨. 남은 자리: 지도(map)·바다(sea) 배경 그림 없음 → 색 패널. 상점 꾸미기(props)·옷(outfit)은 그림에 반영 안 됨(미래는 늘 후드). 배경 dim/blur·캐릭터 등장 애니메이션 없음.
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
3. 연출: 이벤트별 애니메이션(숫자 팝업·청산 재·카드/슬롯/사다리/경마), 스탠딩 등장/흔들림, 지도·바다 배경, 이펙트(하트·반짝이 — 배경 제거 때 지워짐, docs/ART.md).
4. 폰 완성(차트·뉴스 피드·글 상세·개추·안 읽음), 튜토리얼(TUT_FLOW 코치마크), 엔딩 기록.
5. UI 를 USS/UXML 로 분리, 이모지 폰트 폴백, WebGL 빌드 확인 (Resources 로드라 그대로 될 것).

## 9. 그림 연결 (Assets/Resources/Art → 무대)

**로드 방식**: `Assets/Art` 를 `Assets/Resources/Art` 로 옮김(git mv, .meta 그대로라 GUID 유지). 데이터·폰트도 Resources 라 같은 방식이고, 67장 규모라 Addressables 를 들일 이유가 없음. `ArtCatalog.Load("Backgrounds/room_day")` 식으로 읽고 캐시.

**무대 레이어** (1280×960 무대, 1920×1080 기준): 배경(cover) → 미래(왼쪽, 높이 900, 바닥 붙임) → NPC/김사장(오른쪽, 높이 800) → CG(전체, 켜지면 스탠딩 숨김) → 장소 이름(반투명 검정 판) → 토스트(오른쪽 아래, 대사창 위) → 대사창 → 폰. 대사창·폰이 캐릭터 위에 그려져 글자를 가리지 않음.

| 무엇 | 언제 | 그림 |
|---|---|---|
| 배경 | 집(home·멘헤라·돌발·유혹·이자일·사채) | 아침·점심 `room_day`, 저녁 `room_night` (scene 이벤트 night 플래그·이자일 밤도) |
| 배경 | 장소 화면(loc) + 그 장소 안의 화면(work·casino·race·scratch·lotto·shop·relicShop·repay·brokerTrade) | `locations.json` bg (S.visit 장소). jobs·cafe·store·ware → `work`, boutique → `shop` |
| 배경 | 지도·길거리 만남 | 그림 없음 → 색 패널 (placeholder) |
| NPC | 장소 화면 | `locations.json` npc (broker·bank·dealer·work·pc·shop·lotto·race) |
| NPC | 길거리 만남 | `sources.json` npc (taxi·cousin·pckid·hench·suit …) / sim `npc` 이벤트 / NPC 대사 화자(이름 → npcs.json 키) |
| 김사장 | 사채 화면·김사장 대사(그냥) | `kim_base` |
| 김사장 | 이자일(S.phase=payday) | `kim_menace` |
| 김사장 | 클리어 장면(scenes.clear) | `kim_farewell` |
| CG | 오프닝 김사장 등장 ~ 퇴장 | `opening_visit` |
| CG | 오프닝 규칙 카드 뒤 ~ 첫 유품 고르기 | `opening_box` |
| CG | 엔딩 화면(스코어보드 왼쪽 무대 전체) | `ending_clear` / `ending_bad1` / `ending_bad2` (endInfo.kind) |
| 유품 | HUD 유품 슬롯(7개 + 나머지 수, 툴팁=이름) · 유품 고르기 · 유품 상점 진열 · 방금 뽑기 결과 · 획득 토스트 | `Icons/Relics/<id>` |
| 꽝 | 뽑기 꽝 토스트 · 방금 뽑기 결과 | `Icons/Junk/<RELIC_JUNK 순서>` |

**미래 표정 규칙** (GameController.Art.cs, web `moodFace` + 이벤트 face 키를 스프라이트 11종으로)

1. 평소(이벤트 재생 끝 + 3초 뒤) = 상태 표정, 위에서부터 먼저 맞는 것:
   기절 중 → `dizzy` · 멘헤라(stress ≥ menLine 70, 긍정일기장 90) → `mental` · stress ≥ 55 → `crying` · 불안(stress ≥ 40) 또는 체력 < HP_LOW → `tired` · 그 외 → `base`
2. sim 이벤트 face 키 (say·bubble·face·scene·tip) → 표:
   neutral·shy → base, happy·flex → excited, smug → smug, sad·cry → crying, panic → shocked, tired → tired, angry → annoyed, menhera → mental.
   재생이 끝난 뒤 3초 유지하고 1)로 돌아감.
3. 강한 연출 (그 재생 묶음 동안 2)의 face 키에 안 덮임): 큰 수익 `fx flex` → excited · 큰 손실 `fx crack` → shocked · 청산 `fx ash` → crying_comic · 기절 → dizzy.
4. 그 밖: 김사장 대사(face 지정 없음) → annoyed · 주갤 반응 토스트(app=gall, 내 글 정산) → annoyed · 카지노/경마 이김·즉석 복권 당첨·유품 획득 → smug · 쇼핑(bought) → excited · 멘헤라 폭탄 → mental · 아침 결산(밤잠 뒤) → pajama.
5. 지도 화면엔 미래를 안 띄움(web 과 같음). 지도에서 미래가 말하면 다시 나타남.
