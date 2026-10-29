# 롱잡고알바감 — LLM 연동 (Claude Haiku 5.5)

> 원칙: **"LLM 이 사실을 정하고 게임은 표출한다"** — 단, 시세에 영향을 주는 값(언제·방향·크기·진짜/가짜)은 게임이 정하고, LLM 은 그 틀 안에서 종목·사건·이야기·문구를 고른다.
> 모델: `claude-haiku-5-5` (Claude Haiku 5.5, 입력 $0.10 / 출력 $0.50 per MTok). 서버: Cloudflare Worker `server/llm-worker` (키는 Worker secret 에만).
> 진행 기록: `docs/LLM_PROGRESS.md`.

## 1. 한눈에

| | 무엇 | 누가 정함 | 실패하면 |
|---|---|---|---|
| A. 뉴스 디렉터 | 칸 끝 뉴스 (다음 칸 시세 충격) | 게임: 언제(32%)·방향·진짜/가짜(30%)·출처 등급·고를 수 있는 종목/세기 목록·실제 크기 / LLM: 종목·세기·사건·스토리 아크·헤드라인·기사·출처 | sim 내장 생성기 (같은 방향·가짜 여부·종목 목록 안에서) |
| B. 연출 문구 | 집 대사·미래 카톡·주갤 글/댓글 | LLM (화면 전용, sim 상태 안 바뀜) | strings.json 원래 문구 |
| C. 서버 | `POST /news` `/line` `/gall`, `GET /health` | Worker (요청 검증·한도·구조화 출력·후검증) | `{ok:false, error}` 즉시 |

배포 URL: **https://kw-game-llm.kw-game-llm-worker.workers.dev** (workers.dev, 계정 서브도메인 `kw-game-llm-worker`).

## 2. 지금 뉴스가 도는 방식 (바뀌지 않은 부분)

- 칸 G 가 끝날 때(`marketTick` 마지막) `genNews()` 가 굴린 뉴스가 **칸 G+1 시세 계획에 충격**으로 들어가고, **칸 G+1 끝에 결과와 함께** 피드·토스트로 보인다. 즉 뉴스는 "왜 움직였나" 설명이지 사전 신호가 아니다.
- 가짜(30%)는 충격이 없고, LLM 모드가 아니면 화면에도 안 나온다(지금 그대로).
- **LLM 모드에서만 추가된 것:** 가짜 기사는 G+1 칸 끝에 `[오보] … 정정 보도` 로 피드·토스트에 나온다 (충격 없음, 게임 난수 안 씀). LLM 이 심은 "가짜 티" 는 여기서 읽을 수 있다.
- 뉴스를 칸 시작에 미리 보여 주는 식(진짜 사전 신호)으로 바꾸는 건 밸런스 변경이라 하지 않았다 — 원하면 별도 결정.
- **v4 (docs/V4.md §8.1):** 칸 시작 속보로 미리 보여 줌 + 한 칸 앞서 묻기(`NewsReqNext`, `S.nfactN`) + 요청에 `ch`·`part`·`kim`, /line 에 `ch`·`aff`·`kim`·`ready`·`prom` (전부 선택 필드라 v4 가 아닌 클라이언트는 그대로).

## 3. 프로토콜 (sim ↔ 호스트 ↔ 워커)

```
칸 G 시작 (명령 처리 직후)                         칸 G 동안 (플레이어 행동)              칸 G 끝 (marketTick)
 host: q = query newsReq  ──POST /news──▶ worker ──▶ Claude ──▶ {ok, fact}
                                    host: apply {t:"newsFact", ...fact}  → sim 검증 → S.nfact
                                                                                   genNews(): S.nfact(칸 G) 있으면 사용, 없으면 내장
```

- 요청은 **이벤트가 아니라 읽기 전용 query** (`SIM.query(S, SIM.Q.newsReq)` / C# `G.NewsReq()`) — 이벤트 수·상태 해시가 안 바뀌어서 골든 벡터가 그대로다.
- 요청 값은 상태 + 시드에서만 나오는 **뉴스 난수**(`seed ^ (G+1)·0x9E3779B1` 로 시작하는 mulberry32, `S.rng`·`S.fx` 안 건드림) 로 만든다 → 같은 상태면 늘 같은 요청 → 칸 시작에 미리 보낼 수 있다.
- 명령 (어느 pending 에서나 받음):

| 명령 | 필드 | 설명 |
|---|---|---|
| `llmMode` | `on` | LLM 뉴스 모드 켜기/끄기. 끄면 받아 둔 사실(`S.nfact`)도 버림. **안 보내면(기본) 예전과 바이트 단위로 같음** |
| `newsFact` | `slotId, dir, ticker, strength, event, headline, body, source, arcId?, arcStep?` | 검증 통과 → `S.nfact`, 실패 → `error` 이벤트(`msg:"newsFact"`), 상태 그대로 |

### 3.1 newsReq (sim → 호스트 → 워커 /news 본문 그대로)

```json
{ "slotId": 15, "month": 1, "day": 6, "slot": 0,
  "dir": 1, "fake": true, "tier": 0,
  "tickers": [{"k":"BAT","name":"킹배터리","type":"stock"}, {"k":"MKT","name":"시장 전체","type":"market"}],
  "strengths": ["strong"],
  "recent": [{"slotId":12,"tk":"MKT","dir":1,"h":"…","fake":true,"arc":null,"step":null}],
  "arcs": [{"id":"arc1","tk":"TOK","step":2,"h":"…","slotId":11}] }
```

- `null` = LLM 모드 꺼짐 또는 이번 칸엔 뉴스가 없음(뉴스 난수 ≥ 0.32).
- `dir`: 뉴스 난수 < p⁺ 면 +1. p⁺ = 후보 종목들(NEWS 표)의 호재 헤드라인 비율 평균 → 기존 생성기의 전체 호재 비율과 같다.
- `fake`: 뉴스 난수 < 0.3. `tier`: 0 찌라시·갤 / 1 인터넷 매체 / 2 경제지 (가짜일 때 티를 얼마나 숨길지).
- `type`: stock · coin · meme · market.

### 3.2 검증 (sim, JS `web/src/sim/news.js` = C# `GameSim.Llm.cs`)

- `slotId` = 지금 칸, `dir` = 요청 방향, `ticker` ∈ `tickers[].k`, `strength` ∈ `strengths`.
- 문구 정리: 제어문자·특수 공백(U+00A0, U+2000–200F, U+2028–202F, U+205F, U+3000, U+FEFF)·`<>{}`·백틱·역슬래시 → 공백, 공백 연속 → 하나, 앞뒤 공백 제거. 비거나 길이 초과면 **거부**(자르지 않음).
  한도: headline 60 · body 300 · source 20 · event 60 (UTF-16 길이).
- `arcId`: `^[a-z0-9_-]{1,24}$` 아니면 없음. `arcStep`: 1~5 정수 아니면 1.
- 늦게 온 사실(칸이 지남)은 `slotId` 가 안 맞아 거부 → 그 칸은 이미 내장 생성기로 굴렀다.

### 3.3 크기·밸런스 가드레일

- 크기: 종목 종류별 기존 구간을 세기로 3등분, 그 안에서 게임 난수 `u` → `lo + w·(s + u)/3` (s = weak 0 · mid 1 · strong 2).
  주식 5~12% · 코인 7~16% · 시장 2~4% · 밈 40%(고정).
- **세기 균형:** LLM 이 고른 세기 횟수(`S.nstr`)가 가장 적은 것보다 2 이상 많아지면 그 세기는 `strengths` 에서 빠짐 → 오래 보면 세 구간 균등 = 기존 크기 분포와 같음.
- **종목 쏠림 방지:** 최근 6개 뉴스에 2번 나온 종목은 `tickers` 에서 빠짐 (다 빠지면 전체).
- 응답이 없을 때(LLM 모드): 요청의 `dir`·`fake`·`tickers` 를 지키는 내장 생성기(종목 = 목록에서 게임 난수, 헤드라인 = NEWS 표에서 같은 방향).
- 확인 (봇 300판 × 3전략, 12개월, `scratchpad bal.mjs`):

| 전략 | 모드 | 클리어 | 뉴스 호재 | 가짜 | 평균 충격 크기 | 가장 많은 종목 |
|---|---|---|---|---|---|---|
| steady | 끔 | 98.7% | 50.3% | 29.7% | 8.78% | 17% |
| steady | LLM(무응답 → 폴백) | 98.3% | 49.7% | 30.5% | 8.71% | 17% |
| steady | LLM(탐욕: 늘 첫 종목·최강) | 98.3% | 50.1% | 30.6% | 8.99% | 31% (가드레일 상한) |
| invest | 끔 / 폴백 / 탐욕 | 99.0 / 98.7 / 98.7% | 50.3 / 50.1 / 50.3% | 29.1 / 30.4 / 30.5% | 9.14 / 9.01 / 8.99% | 17 / 17 / 31% |
| random | 끔 / 폴백 / 탐욕 | 0.3 / 1.0 / 0.7% | 50.0 / 50.2 / 50.2% | 29.9 / 30.3 / 30.1% | 8.98 / 8.96 / 8.97% | 17 / 17 / 30% |

### 3.4 상태에 추가된 필드 (digest 밖 → 해시 영향 없음, `version` 34 그대로)

| 필드 | 뜻 |
|---|---|
| `llm` | LLM 뉴스 모드 |
| `nfact` | 받아 둔 사실 `{slotId, tk, s, h, body, src, ev, arc, step}` (genNews 때 소비) |
| `nlog` | 최근 뉴스 12개 `{slotId, tk, dir, h, fake, arc, step}` (요청의 recent·arcs·쏠림 가드레일) — LLM 모드가 아니어도 쌓임(난수 안 씀) |
| `nstr` | LLM 이 고른 세기 횟수 [weak, mid, strong] |
| `news` 에 추가 | LLM 사실이면 `llm:1, body, src, ev, arc, step` |

## 4. 워커 (`server/llm-worker`)

```
src/index.ts     라우터 · 입력 검증 · 한도 · Claude 호출(구조화 출력) · 에러 → {ok:false}
src/prompts.ts   공용 시스템 프롬프트(SHARED: 세계관·문체·금지·인물 시트·종목·작업별 규칙) + 작업 지시 3개
src/validate.ts  입력 스키마(zod) · 출력 스키마 · 후검증(sim 과 같은 정리·길이, 목록 대조, 금지어)
src/quota.ts     Durable Object 카운터 (요청 한도)
test/validate.test.ts   npm test (SDK·네트워크 없이)
wrangler.toml    MODEL·한도 vars, DO 바인딩
```

### 4.1 엔드포인트

| | 요청 본문 | 성공 응답 |
|---|---|---|
| `POST /news` | newsReq (§3.1) | `{ok:true, fact:{slotId, dir, ticker, strength, event, headline, body, source, arcId?, arcStep?}}` → 호스트가 `t:"newsFact"` 붙여 그대로 명령 |
| `POST /line` | `{month, day, slot, debt, cash, hold, todayPnl, interest, dday, paid, hp, stress, addict, mood, relics[], recent[]}` | `{ok:true, line, kakao}` (80자 · 60자) |
| `POST /gall` | `{month, day, slot, debt, cash, todayPnl, fame, topic, recent[]}` | `{ok:true, post:{title, body, comments:[{au, x}]}}` (40 · 200 · 댓글 2~4개 60자, au ∈ 고닉 6 + ㅇㅇ) |
| `GET /health` | | `{ok:true, hasKey, model}` |

실패 = `{ok:false, error, message?}`: `no_key`(503) · `bad_request`/`bad_json`(400) · `too_large`(413, 본문 6KB 초과) · `rate_limited`(429, minute/daily) · `bad_key` · `refusal` · `truncated` · `bad_output` · `policy`(후검증 탈락) · `upstream`(502) · `upstream_rate_limited`(503) · `timeout`(504) · `not_found`(404).

### 4.2 Claude 호출

- 공식 SDK `@anthropic-ai/sdk` 0.133 `client.messages.parse()` + `output_config.format = zodOutputFormat(스키마)` (구조화 출력, `parsed_output`).
- `model: claude-haiku-5-5`, `output_config.effort: "low"` (생각은 기본 adaptive — 지연 줄이려 low), `temperature`/`top_p`/`top_k` 안 보냄(Haiku 5.5 는 400).
- `system = [SHARED + cache_control: ephemeral, 작업 지시]`, 요청마다 바뀌는 건 user 메시지(JSON) 에만 → 공용 프리픽스 캐시. SHARED ≈ 2,700자(대략 2천+ 토큰) > 최소 캐시 512 토큰. 구조화 출력 스키마는 엔드포인트별로 고정(동적 enum 안 씀 → 스키마 컴파일 캐시도 유지).
- `maxRetries: 0`, 타임아웃 news 12초 · line 6초 · gall 10초. 에러는 SDK 타입 순서대로(Authentication → RateLimit → ConnectionTimeout → Connection → APIError).
- `stop_reason` 이 `refusal`·`max_tokens` 면 버림. 로그엔 토큰 수·캐시 읽기/쓰기만 (키·본문 안 찍음).

### 4.3 콘텐츠 정책

- 프롬프트: 야갤 말투·가벼운 욕 OK / 실존 인물·실제 기업·실제 언론사 금지 / 실제 집단 혐오·멸칭 금지 / 성적 묘사·자해·실제 범죄 방법 금지 / 실제 투자 조언처럼 보이는 문장 금지. 회사·코인·매체는 전부 가상.
- 서버 후검증(`validate.ts`): 길이·정리(sim 과 같은 규칙), 목록 밖 값, 금지어 정규식(링크·전화번호, 실제 집단 멸칭, 성적 표현, 자해) → 하나라도 걸리면 응답 전체를 버림(`policy`) → 게임은 내장 문구.
- 마지막으로 sim 이 한 번 더 검증(§3.2).

### 4.4 요청 한도 — 왜 Durable Object 인가

- 키 3개를 동시에 셈: `dev:<기기 id>`(분 30 · 하루 600), `ip:<IP>`(분 60 · 하루 1,500), `global`(하루 10,000). 하루 = UTC. 값은 `wrangler.toml [vars]`.
- KV 는 결과적 일관성이라 같은 키를 동시에 올리면 덮어써지고, 무료 플랜 쓰기가 하루 1,000번이라 "요청마다 +1" 카운터로 못 쓴다. Durable Object(SQLite 백엔드, 무료 플랜 가능)는 키마다 인스턴스 하나가 요청을 순서대로 처리해 정확히 센다.
- 기기 id 는 클라이언트가 만든 무작위 값(PlayerPrefs) 이라 위조 가능 → IP 한도와 전체 한도가 뒤를 받친다. 전체 한도 10,000 회/일 ≈ 최악 $3/일.

## 5. 클라이언트

### 5.1 Unity (`Assets/Scripts/View`)

- `LlmClient.cs` — `LlmSettings`(URL·켜기·기기 id, PlayerPrefs) + `LlmClient.Post`(UnityWebRequest 코루틴, 자체 타임아웃 후 Abort, 실패면 null).
- `GameController.Llm.cs`
  - 새 게임: 설정이 켜져 있으면 `llmMode on` 명령.
  - 명령 처리 직후마다(`Send` → `LlmTick`, 이벤트 재생 전): `G.NewsReq()` 가 새 칸이면 `/news` (12초). 답이 오면 `newsFact` 명령을 바로 적용(sim 이 검증; 칸이 지났으면 거부 → 내장 뉴스).
  - 새 칸 + 집이면 `/line` (6초): 집 화면이 뜬 뒤 **1.5초 안에** 온 대사만 바꿔 끼움(늦으면 원래 대사 유지), 카톡 한 줄은 카톡 탭 미래 방 + 토스트.
  - 새 뉴스가 피드에 떴거나 오늘 손익이 ±30만 원 이상이면 `/gall` (10초): 주갤 탭 위에 `[실시간]` 글 + 댓글.
  - 폰에 "뉴스" 탭 추가(LLM 기사 본문·출처 줄 포함).
- 설정 UI: 타이틀 화면 버튼 **"AI 뉴스·대사 (Claude): 켜짐/꺼짐"**. 게임 중 바꾸면 `llmMode` 명령도 같이 보냄.
- 기본: URL(`LlmSettings.DefaultUrl` = 위 배포 URL) 이 있으면 켜짐. 명령줄: `-kwLlmOff` · `-kwLlmOn` · `-kwLlmUrl <url>`.
- `-kwShots` 데모: 첫 판은 설정대로 LLM 모드로 돌고(실제 워커 호출), 집에서 15칸 쉬며 뉴스 요청을 만든 뒤 `[shot] llm: … sent/ok/failed/last` 를 찍는다. 화면 재생 3판은 llmMode 를 안 켜므로 골든 해시 그대로.

### 5.2 웹 프로토타입

- 화면은 그대로. 호스트가 `newsReq` 를 묻지도 답하지도 않고 `llmMode` 도 안 보냄 → 예전과 완전히 같다. (sim 쪽 코드·문구 3개만 추가됨)

## 6. 테스트

| 명령 | 내용 |
|---|---|
| `node web/tests/run-golden.mjs` | 골든 24/24 — **LLM 모드가 아니면 바이트 단위로 예전과 같음** (gen.mjs 다시 안 돌림) |
| `node web/tests/llm/gen.mjs` | 녹화 응답 픽스처 생성: invest 봇(seed 31, 3개월)이 도는 동안 칸마다 newsReq 를 보고 미리 써 둔 응답 6종을 newsFact 로 끼움. 일부러 틀린 응답(목록 밖 종목·방향·글자 수·지난 칸)·무응답·제어문자/꺾쇠/중괄호 섞인 헤드라인·모드 껐다 켜기 포함 |
| `node web/tests/llm/run.mjs` | JS 재생 → 해시·이벤트 수·거부 수·요청 20개(JSON 전체)·nlog·nstr·뉴스 피드 문구 비교 |
| `./unity sync-llm` | 픽스처 + 그때의 data → `Assets/Tests/EditMode/Llm` |
| `./unity simtest` | 골든 24 + 봇 24 + **LLM 픽스처** (C#) |
| `./unity test edit` | 58개: 기존 54 + `LlmTests` 4 (픽스처 JS=C#, 모드 꺼짐이면 요청 없음·사실 거부, 검증 규칙, 문구 정리) |
| `cd server/llm-worker && npm test` | 워커 후검증 단위 테스트 |
| `node tools/llm-smoke.mjs` | 실제 호출 스모크: `ANTHROPIC_API_KEY` 가 환경에 있으면 로컬 `wrangler dev`(키는 프로세스 환경으로만), 없으면 배포 워커. 워커에 키가 없으면 no_key 확인 후 "건너뜀" |

## 7. 키 넣기 · 켜고 끄기

```bash
cd server/llm-worker
npx wrangler secret put ANTHROPIC_API_KEY     # 프롬프트에 키 붙여넣기 (저장소·클라이언트엔 절대 안 넣음)
curl https://kw-game-llm.kw-game-llm-worker.workers.dev/health    # → "hasKey": true
node ../../tools/llm-smoke.mjs                 # /news·/line 실제 응답 스키마 검사
```

- 다시 배포: `cd server/llm-worker && npx wrangler deploy` (secret 은 유지됨). 모델·한도 바꾸기: `wrangler.toml [vars]`.
- 끄기: 게임 타이틀의 버튼, 또는 실행 인자 `-kwLlmOff`. 서버 쪽에서 막으려면 `npx wrangler secret delete ANTHROPIC_API_KEY` (→ 모든 요청 no_key → 게임은 내장 문구).
- 로그 보기: `npx wrangler tail` (토큰 수·캐시 적중만 찍힘).

## 8. 비용 추정 (Haiku 5.5: 입력 $0.10 · 출력 $0.50 · 캐시 읽기 ×0.1 · 캐시 쓰기 ×1.25, per MTok)

한 판 ≈ 5개월(착실 클리어 평균) × 7일 × 3칸 = **약 105칸**.

| 호출 | 횟수/판 | 입력 (캐시 읽기 + 그 외) | 출력 (생각 low + JSON) | 1회 비용 |
|---|---|---|---|---|
| /news | 105 × 32% ≈ 34 | ~2,500 캐시 + ~700 | ~450 | ≈ $0.00030 |
| /line | 집에서 시작하는 칸 ≈ 105 | ~2,500 캐시 + ~300 | ~250 | ≈ $0.00016 |
| /gall | 뉴스·큰 손익 칸 ≈ 40 | ~2,500 캐시 + ~250 | ~400 | ≈ $0.00023 |

- 한 판 ≈ 34×0.00030 + 105×0.00016 + 40×0.00023 ≈ **$0.04** (캐시 쓰기는 5분 넘게 쉬었다 올 때만 ≈ $0.0003/번). 넉넉히 잡아 **판당 $0.05~0.10**.
- 토큰 수는 한국어 기준 어림값 — 키를 넣은 뒤 `npx wrangler tail` 의 `in/out/cr/cw` 로 실제 값을 확인할 것.
- 상한: 기기당 하루 600회(≈ $0.15), 전체 하루 10,000회(≈ $3).

## 9. 남은 것 · 주의

- 실제 Claude 응답으로는 아직 못 돌려 봄(키 없음) — 키 넣은 뒤 `node tools/llm-smoke.mjs` 로 확인. 프롬프트 품질(웃김·티 심기) 은 실제 응답을 보며 다듬을 것.
- 웹 프로토타입 view 는 LLM 을 안 씀(의도). 저장/이어하기는 Unity 에 아직 없음 — 생기면 `llm/nfact/nlog/nstr` 도 같이 저장.
- 칸 도중 유품(멍멍코인 잠금 해제)으로 종목 후보가 바뀌면 그 칸 요청의 방향이 달라질 수 있음 → 받은 사실이 거부되고 내장 뉴스(정상 폴백).
