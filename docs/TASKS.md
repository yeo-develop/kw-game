# 작업 분담

> 기획서 '작업 분담' 탭과 같은 내용이다. 기획서: https://claude.ai/code/artifact/aae47e1a-5808-451b-9053-9da62cdf5d02

기준일 2026-10-08.

이 문서는 MVP(D+1~D+14)를 8주(마일스톤 4개 × 2주), 45개 태스크로 나눈 2인 분담표다. 담당 A는 시스템·LLM, 담당 B는 화면·콘텐츠를 맡고, 이벤트 데이터 시트·플레이테스트·시연 빌드는 A+B가 함께 한다. 예상 일수 합계는 A 34일, B 35일이다.

## 마일스톤

검증 순서 4단계를 2주씩 마일스톤 M1~M4로 쓴다(총 8주). 1인 가용 일수는 마일스톤마다 10일(2주 × 주 5일)이고, 담당 일수는 A+B 태스크를 반씩 나눠 더한 값이다.

| 마일스톤 | 기간 | 목표 | 데모 기준 | 1인 가용(일) | A(일) | B(일) |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | 1~2주 | 한글 IME를 확정하고, 그래픽 없이 텍스트 화면에서 리플레이 시세·매매 AI·LLM 대화를 잇는다. | Boot 씬 텍스트 화면에서 리플레이 MNQ가 흐르고 미래가 매매하며, 한글 자유 입력으로 5턴 대화가 된다. | 10 | 8 | 6.5 |
| M2 | 3~4주 | 14일치를 배속으로 돌리는 일관성·반복 표현 회귀 테스트 세트를 만들고 관계 수치를 조정한다. | 14일 배속 실행이 두 번 모두 같은 결과를 내고 반복 표현률·3축 추이 리포트가 나오며, 타이틀→지도→장면→폰 이동이 된다. | 10 | 10 | 9 |
| M3 | 5~6주 | 프롤로그·축소 신호·규모 확인 이벤트와 갤·카톡 UI를 붙이고, 5명이 시간 당기기로 14일을 플레이한다. | 새 게임에서 프롤로그→축소 신호 3개→갤 검색→진짜 규모 확인까지 시간 당기기로 도달하고, 5명의 플레이 기록이 남는다. | 10 | 10 | 10 |
| M4 | 7~8주 | 표정 레이어·미니게임·데이트를 붙이고 시연 빌드를 만든다. | mac·windows 빌드로 D+1~D+14를 끊김 없이 시연하고, 카페 피크타임·편의점 데이트 결과가 수치에 반영된다. | 10 | 6 | 9.5 |

모든 마일스톤에서 A·B 모두 가용 10일 안이다. M4는 A가 6일로 가장 가볍다. 남는 시간은 플레이테스트 이슈 수정과 B의 미니게임 연동 지원에 쓴다.

## 태스크

열 순서는 ID · 태스크 · 담당 · 의존 · 예상(일) · 완료 기준 · 폴더다. 완료 기준은 모두 `./unity test edit` 통과를 전제로 한다.

### M1 (1~2주)

| ID | 태스크 | 담당 | 의존 | 예상(일) | 완료 기준 | 폴더 |
| --- | --- | --- | --- | --- | --- | --- |
| T01 | 프로젝트 골격: 폴더·asmdef·네임스페이스 정리 | B | - | 0.5 | ./unity compile 성공 + ./unity test edit 통과(SmokeTests 포함) | Assets/Scripts |
| T02 | 한글 IME 검증 (Win·Mac, TMP InputField 대 UI Toolkit TextField) | B | - | 1.5 | Win·Mac 각각 조합 중 글자 유실·엔터 시 끝 글자 누락 0건, 선택안을 PR 본문에 기록 | Assets/Scripts/UI/Input |
| T03 | MarketFeed 리플레이: QQQ 분봉 CSV → 합성 MNQ | A | T01 | 2 | CSV 1일치 로드 후 MNQ 분봉 390개 생성, 변환 테스트 통과 | Assets/Scripts/Market/Replay |
| T04 | GameStateEngine 계좌: 지갑 4종·증거금·청산 판정 | A | T03 | 2 | 증거금 부족·청산 경계값 테스트 통과, 수치 원본이 엔진 한 곳뿐 | Assets/Scripts/Core/GameState |
| T05 | 미래 매매 AI (규칙 기반: 멘탈·수면·연승·잔고 → 계약 수·손절선 삭제 확률) | A | T04 | 1.5 | 고정 시드로 같은 매매 로그 재현 테스트 통과 | Assets/Scripts/Core/Trading |
| T06 | LlmClient (UnityWebRequest) + BYOK 키 로컬 저장 | A | T01 | 1 | 키 없을 때 오류 코드 반환, 키가 빌드·로그에 남지 않음 | Assets/Scripts/Llm/Client |
| T07 | LlmOrchestrator 1차: 프롬프트 조립·모델 라우팅·JSON 검증·재생성 | A | T06 | 1.5 | 깨진 JSON·목록 밖 감정 코드·금지 표현 샘플이 테스트에서 교체 또는 재생성됨 | Assets/Scripts/Llm/Orchestrator |
| T08 | DialogueView 텍스트 전용: 타자기 출력 + 자유 입력창 | B | T02 | 1.5 | T02에서 고른 입력 방식으로 한글 3문장 입력·전송 성공 | Assets/Scripts/UI/Dialogue |
| T09 | M1 통합: 텍스트 화면에서 리플레이 시세 → 매매 AI → LLM 대화 | B | T05, T07, T08 | 1 | Boot 씬에서 시세 진행 후 미래와 5턴 대화, 콘솔 오류 0 | Assets/Scenes/Boot.unity |
| T10 | SceneDirector: 장면 전환·배경·표정 레이어 슬롯·이벤트컷 (Addressables) | B | T01 | 2 | Boot → 장면 → 지도 전환 시 오류 0, 표정 슬롯에 임시 이미지 교체 | Assets/Scripts/Scenes/Director |

### M2 (3~4주)

| ID | 태스크 | 담당 | 의존 | 예상(일) | 완료 기준 | 폴더 |
| --- | --- | --- | --- | --- | --- | --- |
| T11 | SaveSystem: persistentDataPath JSON, 버전 필드 | A | T04 | 1 | 저장 → 로드 왕복 테스트에서 상태 동일 | Assets/Scripts/Core/Save |
| T12 | 지연 시뮬레이션: 마지막 저장 이후 분봉 재생 + 사건 로그 | A | T05, T11 | 2 | ./unity test edit 통과 + 14일 리플레이 결정론 테스트 존재 | Assets/Scripts/Core/Simulation |
| T13 | 관계 3축 + 행동 태그 분류 + 연애 상태(허니문·익숙해짐·위기) | A | T07 | 2 | 상태 전이 조건별 테스트 통과, 시작값 신뢰 20·설렘 60·편안함 15, `ScaleRevealed` 플래그 포함(규모 확인 전후 분기용) | Assets/Scripts/Core/Relationship |
| T14 | 구조화 기억(사실 테이블)·기억 회수·반복 금지 목록 | A | T07, T11 | 1.5 | 3일 전 사실을 회수 조건에서 프롬프트에 넣는 테스트 통과 | Assets/Scripts/Llm/Memory |
| T15 | 14일 배속 회귀 테스트 세트(일관성·반복 표현) + 관계 수치 조정 | A | T12, T13, T14 | 2 | 14일 배속 실행 리포트에 반복 표현률·3축 추이 출력, 조정값 데이터 시트 반영 | Assets/Tests/EditMode/Regression |
| T16 | S06 장면(메인): 대사창·행동 버튼·관찰 클릭·개입 창 표시 | B | T08, T10 | 2 | 관찰 클릭과 개입 창이 엔진 이벤트로 열리고 닫힘 | Assets/Scripts/UI/Scene |
| T17 | S01 타이틀·S02 시작 설정·S05 지도·S22 이동 불가 안내 | B | T10 | 2 | 새로 시작 → 이름 입력 → 지도까지 끊김 없이 진행, 투자 권유 아님 고지 표시 | Assets/Scripts/UI/Screens |
| T18 | S03 설정: BYOK 키 입력 + 시간 당기기·미니게임 바로 실행 디버그 메뉴 | B | T06, T12 | 1.5 | 시간 당기기 24시간으로 지연 시뮬 실행, 키 저장 후 재시작 시 유지 | Assets/Scripts/UI/Settings |
| T19 | PhoneUI 셸 S07: 6앱 아이콘·라우팅·알림 배지 (UI Toolkit) | B | T10 | 1.5 | 6앱 열기·홈 복귀 동작, 폰 영역 좌표가 명세와 일치 | Assets/Scripts/UI/Phone |
| T20 | ChartRenderer S10: MNQ·BTC 캔들·평단·손절선 (Painter2D), 손익 금액 숨김 | B | T03, T19, T13 | 2 | 리플레이 하루치 캔들 표시, 규모 확인 전 손익 금액 가림 | Assets/Scripts/UI/Phone/Chart |
| T43 | 약속 시스템: 약속 시트(C20·C21) + 지킴 판정(±30분, 미리 알리기, 동시 3개) | A | T13 | 1.5 | 약속 시트 생성·지킴·어김 판정 경계값(±30분, 미리 알리기, 동시 3개 상한) 테스트 통과 | Assets/Scripts/Core/Promise |

### M3 (5~6주)

| ID | 태스크 | 담당 | 의존 | 예상(일) | 완료 기준 | 폴더 |
| --- | --- | --- | --- | --- | --- | --- |
| T22 | 개입 창 + 설득 판정 P 공식 | A | T05, T13 | 1.5 | P = clamp(20 + 0.5×신뢰 + 방식 보정 − 멘탈 페널티, 5, 85) 경계값 테스트 통과 | Assets/Scripts/Core/Intervention |
| T23 | 이벤트 데이터 시트: 프롤로그 대사·3조항·도움 방식·축소 신호 8개·규모 확인 대사 | A+B | T13 | 2 | 시트 → ScriptableObject 임포트 테스트 통과, 신호 8개·반응 5종 대사 모두 채움 | Assets/Data/Events, Assets/Scripts/Data |
| T24 | S23 프롤로그 장면: 폰 엎기 연출·도움 약속 3조항 카드·도움 방식 3종 버튼 | B | T16, T23, T43 | 2 | 첫 접속 → 프롤로그 → 통화 예약 → 실제 시각 합류까지 진행 | Assets/Scripts/Scenes/Prologue |
| T25 | 프롤로그 상태 반영: 도움 방식 시작·설득 보정 + 약속 조항 위반 기록 | A | T13, T23 | 1 | 방식 3종별 시작 수치 테스트, '끊어' 입력 시 신뢰 −5·숨기기 +1 | Assets/Scripts/Core/Promise |
| T26 | 축소 신호 8개 트리거 엔진 + 어긋남 노트 데이터 | A | T12, T23 | 1.5 | 14일 리플레이에서 신호별 발생 조건 테스트 통과, 3개 누적 시 갤 검색 해금 이벤트 | Assets/Scripts/Core/Events |
| T27 | S11 메모 앱: 어긋남 노트(미래가 한 말 / 내가 본 것) + 3조항 고정 | B | T19, T26 | 1 | 신호 발생 시 토스트 → 메모 앱 해당 줄로 이동 | Assets/Scripts/UI/Phone/Memo |
| T28 | S09 갤 화면 + 닉네임 검색 (힌트 단어 2개 판정) | B | T19, T26 | 2 | 힌트 2개 포함 검색 시 「롱잡고알바감」 글 노출 → S19 진입 | Assets/Scripts/UI/Phone/Gall |
| T29 | MessageBacklog: 생활 리듬별 답장 스케줄 + 쌓인 카톡·갤 글 (하루 상한) | A | T12, T14 | 2 | 미래 수면 시간대에 답장 없음, 하루 상한 초과 생성 0건 테스트 | Assets/Scripts/Llm/Backlog |
| T30 | S08 카톡 UI + S04 리캡의 쌓인 카톡 | B | T19, T29 | 2 | 12시간 당긴 뒤 리캡에 실제 시각 순 카톡 표시, 항목 클릭 시 카톡 열림 | Assets/Scripts/UI/Phone/Kakao |
| T31 | 진짜 규모 확인 판정: 발견 방식 3종(갤·직접·자동 D+14) + 반응 5종 수치 + D+9 판정 | A | T13, T26 | 1.5 | 방식별 진입 조건과 반응 5종 수치 변화 테스트 통과 | Assets/Scripts/Core/Events |
| T32 | S19 진짜 규모 확인 장면 + 반응 5종 선택 + S20 엔딩0 | B | T16, T31 | 1.5 | 3방식 모두 S19 진입, '헤어지자'가 D+9 안이면 엔딩0 표시 | Assets/Scripts/UI/Screens |
| T33 | 플레이테스트: 5명이 시간 당기기로 14일 플레이 | A+B | T18, T24~T32 | 1 | 5명 완주 기록과 이슈 목록(우선순위 표시) 작성 | docs/playtest |
| T34 | MiniGameResult 계약 + Additive Scene 로더 + 엔진 반영 | A | T04, T13 | 1 | 더미 미니게임 결과가 멘탈·팁·3축에 반영되는 테스트 통과 | Assets/Scripts/MiniGames/Common |

### M4 (7~8주)

| ID | 태스크 | 담당 | 의존 | 예상(일) | 완료 기준 | 폴더 |
| --- | --- | --- | --- | --- | --- | --- |
| T21 | LLM 비용·모델 비교: usage 로그 + Sonnet 5.5 대 Haiku 4.5 품질 비교 | A | T15 | 0.5 | 턴당 토큰 비용 로그 출력, 모델 결정 1줄 기록 | Assets/Scripts/Llm |
| T35 | MarketFeed 라이브: 업비트 BTC 공개 REST + 실패 시 캐시 | A | T01 | 1 | 오프라인에서도 마지막 캐시로 분봉 반환, 파서 테스트 통과 | Assets/Scripts/Market/Upbit |
| T36 | 장면 화면 감정 8종 표정 레이어 (b 착장) + 감정 코드 매핑 | B | T07, T10 | 1.5 | LLM 감정 코드 8종이 각각 다른 표정으로 표시, 목록 밖 코드는 기본 표정 | Assets/Scripts/Scenes/Director, Assets/Art/Characters |
| T37 | 카페 피크타임 미니게임 S16·S17 (흘긋 시스템 포함) | B | T34, T13 | 3 | 3분 1판 완주 → 등급·팁·멘탈 결과 화면, 하루 3판 제한, 규모 확인 전 흘긋에서 금액 미표시 | Assets/Scripts/MiniGames/Cafe |
| T38 | 편의점 조합 데이트 S18 + S06-c 데이트 비트 | B | T34, T16 | 2 | 예산 1만원·90초 조합 후 데이트 장면 복귀, 결과가 3축에 반영 | Assets/Scripts/MiniGames/Convenience |
| T39 | 플레이테스트 이슈 수정 (시스템·LLM 쪽) | A | T33 | 1.5 | P0·P1 이슈 0건 + ./unity test edit 통과 | Assets/Scripts |
| T40 | 시연 빌드: mac·windows 빌드 + 시연 체크리스트 | A+B | T35~T39, T41~T45 | 1 | ./unity build mac·windows 성공, 체크리스트대로 D+1~D+14 시연 통과. 체크리스트에 계좌 잔고 전환(T41)·복기(T42)·익명 댓글(T45) 확인 포함 | Builds |
| T41 | S12 계좌 앱: 규모 확인 전 '말한 잔고' ↔ 후 실제 잔고 전환 | B | T19, T31 | 1 | 규모 확인 전에는 '말한 잔고', 후에는 실제 잔고 표시 | Assets/Scripts/UI/Phone/Account |
| T42 | S14 복기 모드: 30배속 재생·매매 마커 질문·1회 제한(C29) | A | T20, T12 | 1.5 | 30배속 재생, 매매 마커 질문 동작, 1회 제한(C29) 테스트 통과. 화면은 T19·T20 컴포넌트를 재사용하고 S14 씬 연결은 B가 한다 | Assets/Scripts/Core/Simulation |
| T44 | S15 2주 결산 카드 + S13 사진첩 + S21 일시정지 | B | T19, T11 | 1.5 | D+14에 결산 카드 표시, 사진첩 저장·로드 유지, 일시정지 후 재개 | Assets/Scripts/UI/Screens, Assets/Scripts/UI/Phone/Album |
| T45 | 갤 익명 댓글: 응원·현실 댓글 효과, 7일 5개 초과 의심 | A | T28, T31 | 1 | 댓글 종류별 수치 효과 테스트, 7일 안 6번째 댓글에서 의심 판정 | Assets/Scripts/Core/Events |

### 담당별 합계

| 담당 | 단독 태스크(일) | 공동 몫(일) | 합계(일) | 태스크 수 |
| --- | --- | --- | --- | --- |
| A | 32 | 2 | 34 | 단독 22 + 공동 3 |
| B | 33 | 2 | 35 | 단독 20 + 공동 3 |

차이는 1일로 큰 쪽(B) 기준 2.9%다. 20% 기준 안이다.

## MVP 범위 매핑

MVP 범위 항목은 모두 하나 이상의 태스크에 걸려 있다.

| MVP 항목 | 태스크 |
| --- | --- |
| MarketFeed (QQQ 분봉 CSV→합성 MNQ, 업비트 BTC) | T03, T35 |
| GameStateEngine (지갑 4종·증거금·청산·지연 시뮬레이션) | T04, T12 |
| 미래 매매 AI (규칙 기반) | T05 |
| 관계 3축 + 연애 상태 (허니문·익숙해짐·위기) | T13 |
| LLM 파이프라인 + JSON 검증 + 구조화 기억 | T06, T07, T14 |
| 프롤로그 장면 (도움 약속 3조항·도움 방식 3종) | T23, T24, T25 |
| 축소 신호 8개 + 어긋남 노트 | T23, T26, T27 |
| 진짜 규모 확인 장면 + 반응 5종 | T23, T31, T32 |
| 갤 화면 + 닉네임 검색 | T28 |
| 카톡 UI + 생활 리듬별 답장 + 쌓인 카톡 | T29, T30 |
| 장면 화면 + 감정 8종 레이어 | T16, T36 |
| 편의점 데이트 | T38 |
| 카페 피크타임 | T37 |
| BYOK 설정 | T06, T18 |
| 시간 당기기 디버그 메뉴 | T18 |
| 한글 IME 검증 (M1 최우선) | T02 |
| 세이브 | T11 |
| 개입 창 + 설득 판정 P 공식 | T16, T22 |
| 미니게임 Additive Scene + MiniGameResult | T34 |
| 계좌 앱 (말한 잔고↔실제 잔고) | T41 |
| 복기 모드 | T42 |
| 약속 시스템 | T43 |
| 2주 결산·사진첩·일시정지 | T44 |
| 갤 익명 댓글 | T45 |


## 크리티컬 패스

마일스톤을 넘는 의존 중 밀리면 데모가 무너지는 경로다.

1. T02 IME → T08 DialogueView → T16 S06 장면 → T24 프롤로그. IME 결론이 M1에 안 나면 M3 프롤로그와 자유 입력 전체가 밀린다.
2. T03 → T04 → T05 → T12 지연 시뮬레이션 → T26 축소 신호 → T31 규모 확인 판정 → T32 S19 → T33 플레이테스트. M1~M3를 잇는 가장 긴 사슬(약 13일)이고 대부분 A 쪽이다.
3. T07 → T13 관계 3축 → T23 데이터 시트 → T24·T25·T26. T24는 T13 → T43 약속 시스템에도 묶인다. M3 이벤트가 모두 M2 말 결과에 묶인다. 대사 시트는 M2 중에 미리 쓰기 시작한다.
4. T12 지연 시뮬레이션 → T18 시간 당기기 → T33 플레이테스트. 시간 당기기가 없으면 5명이 14일을 플레이할 수 없다.
5. T13 → T34 MiniGameResult → T37 카페 피크타임(3일) → T40 시연 빌드. T34가 M3 안에 끝나야 B가 M4 첫날 미니게임을 시작한다.

## 폴더 구조와 어셈블리

```
Assets/
  Scripts/
    Core/        GameState, Trading, Relationship, Intervention, Promise, Events, Simulation, Save
    Market/      Replay(QQQ→MNQ), Upbit
    Llm/         Client, Orchestrator, Memory, Backlog
    Data/        ScriptableObject 정의, 시트 임포터
    UI/          Input, Dialogue, Scene, Screens, Settings, Phone/{Kakao,Gall,Chart,Memo,Account,Album}
    Scenes/      Director, Prologue
    MiniGames/   Common(MiniGameResult, 로더), Cafe, Convenience
  Data/          시트 원본 CSV, ScriptableObject 에셋 (Events, Balance)
  Scenes/        Boot.unity, Main.unity, MiniGame_Cafe.unity, MiniGame_Convenience.unity
  Art/           Characters, Backgrounds, UI
  Editor/        BuildCli.cs (기존)
  Tests/EditMode/ (기존 EditModeTests.asmdef)
docs/            TASKS.md, playtest/
```

어셈블리는 `Scripts` 아래 폴더마다 하나씩 둔다. `KwGame.Core`는 다른 게임 어셈블리를 참조하지 않고, 시세 타입·`MiniGameResult`·이벤트 인터페이스를 여기서 정의한다. `KwGame.Market`·`KwGame.Llm`·`KwGame.Data`는 Core만 참조하고, `KwGame.UI`는 이 넷을, `KwGame.Scenes`·`KwGame.MiniGames`는 Core·UI·Data를 참조한다. Core에서 UI로 가는 역참조는 금지하고 C# 이벤트로 넘긴다. 기존 `EditModeTests.asmdef`(autoReferenced false)에는 Core·Market·Llm·Data 참조를 더한다. 이렇게 나누면 A의 로직 어셈블리는 UI 없이 테스트되고, 출시 때 서버로 옮길 범위(Core·Market·Llm)가 그대로 경계가 된다.

## 협업 규칙

- main은 보호한다. 직접 push는 막고 PR 머지만 받는다.
- 이 규칙은 M1 시작부터 적용한다. M1 시작 전에 GitHub에서 main 브랜치 보호를 설정한다.
- 브랜치는 `feat/T번호-요약`이다. 예: `feat/T12-delay-sim`. 수정은 `fix/T번호-요약`.
- PR 리뷰는 상대 담당이 한다. A+B 태스크는 PR을 올리지 않은 쪽이 승인한다.
- PR 전에 `./unity test edit`를 통과시키고, 결과 줄(passed·failed 수)을 PR 본문에 붙인다.
- 씬(.unity) 파일은 B 한 사람만 고친다. A는 씬 대신 프리팹·ScriptableObject로 붙인다.
- 작업 단위는 프리팹이다. 같은 프리팹을 두 사람이 같은 날 고치지 않는다.
- .meta 파일은 에셋과 같이 커밋한다. .meta가 빠진 PR은 반려한다.
