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
