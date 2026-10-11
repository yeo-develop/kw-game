# LLM 연동 진행 기록 (Claude Haiku 5.5 · `claude-haiku-5-5`)

- [0 시작] ARCHITECTURE·UNITY·PROGRESS 문서, market.js(genNews)·flow.js(marketTick)·C# Market/Flow/Api, 데이터(tickers·strings) 확인. 기준선: run-golden 24/24 · check-sim OK · `./unity simtest` 24/24 + 봇 24/24.
- [발견] 현재 뉴스는 칸 끝(G)에 굴려서 다음 칸(G+1) 시세에 충격으로 들어가고, G+1 칸 끝에 "결과와 함께" 피드·토스트로 보인다(사전 신호 아님). 가짜(fake 30%)는 충격도 없고 **화면에도 안 나온다** — '오보 정정'은 지금 sim 에 없음. → LLM 모드에서만 가짜 기사를 G+1 칸 끝에 "[오보]"로 보여 주기로 함(시세 영향 없음, 게임 난수 소비 없음).
- [설계 확정] 요청은 이벤트가 아닌 query(`newsReq`) — 이벤트 수·digest 불변. 뉴스 난수 = `seed ^ (G+1)·0x9E3779B1` mulberry32 (S.rng·S.fx 안 씀). 명령 `llmMode`(기본 꺼짐 = 기존 동작 그대로) · `newsFact`(검증). LLM 모드에선 WHEN·방향·가짜를 요청 값으로, 크기는 세기 3등분 + 게임 난수. 가드레일: 최근 6개 중 2번 나온 종목 제외, 세기 횟수 균형(최소+1 초과 세기 제외).
- [JS sim] web/src/sim/news.js 신설, market.js genNews(LLM 모드 분기 + nlog 기록), api.js 명령 2개, query.js Q.newsReq, state.js 필드 4개(llm·nfact·nlog·nstr, digest 밖), flow.js 뉴스 표시(LLM 기사 본문 줄, 가짜 = [오보]), strings 3개. 골든 24/24 그대로 · check-sim OK · build OK.
- [픽스처] web/tests/llm/{gen,run,common}.mjs + bots.mjs opt.inject. invest seed 31 3개월: 명령 491 · 요청 20 · 사실 27(거부 9 포함) · hash e0d022d7.
- [C# sim] GameSim.Llm.cs(news.js 이식) · LlmFixture.cs · Market/Api/Flow/State 반영. `./unity sync-llm` 추가, SimHarness 에 LLM 픽스처 검사 → 첫 실행에 JS 와 일치(요청 JSON·nlog·피드 문구·해시).
- [워커] server/llm-worker (TS, @anthropic-ai/sdk 0.133 messages.parse + zodOutputFormat, effort low, 공용 시스템 프롬프트 캐시, Durable Object 한도, 후검증·금지어). `npx wrangler deploy` — 계정에 workers.dev 서브도메인이 없어 wrangler 가 `kw-game-llm-worker` 로 등록함. URL https://kw-game-llm.kw-game-llm-worker.workers.dev. curl: /health hasKey=false, /news → 503 no_key, 잘못된 본문 400, 없는 경로 404.
- [워커 로컬] `wrangler dev` + 가짜 키: Anthropic 401 → bad_key(0.2초), 기기 분당 한도 3 으로 4번째 → 429 rate_limited (DO 동작 확인). `CLOUDFLARE_INCLUDE_PROCESS_ENV=true` 로 키를 파일 없이 넘기는 것 확인 → tools/llm-smoke.mjs 에 사용.
- [Unity view] LlmClient.cs(설정·UnityWebRequest) · GameController.Llm.cs(뉴스 요청·사실 적용, 집 대사 1.5초 규칙, 카톡, 주갤 [실시간] 글) · 타이틀 토글 · 폰 뉴스 탭. `./unity test edit` 58 passed (LlmTests 4 추가) · `./unity build mac` 성공.
- [빌드 실행] `-kwShots`: 첫 판 LLM 모드로 실제 워커 호출 22회 전부 no_key → 내장 문구/뉴스로 정상 진행(뉴스 요청 2칸 → sim 내장 생성기), 화면 재생 3판 해시 = 골든(3cffe9b9 · afe6518a · b4e43de7), 예외 0, 스크린샷 19_phone_news 추가.
- [밸런스] 봇 300판 × steady·invest·random × (끔·폴백·탐욕 LLM): 클리어율·호재 50%·가짜 30%·평균 충격 ~9% 유지, 탐욕 LLM 종목 쏠림 상한 ~30% (docs/LLM.md §3.3).
- [스모크] tools/llm-smoke.mjs: 키 없음 → 배포 워커 no_key 확인 후 "건너뜀"(exit 0). 실제 Claude 응답 검증은 사용자가 키를 넣은 뒤.
- [남은 것] 키 등록(`cd server/llm-worker && npx wrangler secret put ANTHROPIC_API_KEY`) → `node tools/llm-smoke.mjs` → 실제 응답으로 프롬프트 다듬기, 토큰 수 실측(wrangler tail).
