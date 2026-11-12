# 개발용 도구 (게임은 이 폴더를 쓰지 않는다)

| 파일 | 하는 일 | 돌리는 법 |
|---|---|---|
| `rules-test.js` | 규칙이 기획서대로 도는지 11가지 확인 (브라우저 없이) | `node tools/rules-test.js` |
| `sim.js` | 봇 8종으로 한 판씩 굴려 균형을 봄 (알바만 · 묻어 두기 · 뉴스 · 공부 · 과감 · 주식만 · 무지성) | `node tools/sim.js . 300` · 값을 바꿔 보려면 뒤에 `house_price=30000000` 처럼 |
| `check.js` | 화면으로 한 판을 끝까지 몰며 주요 화면을 찍고, 글자 넘침 · 겹침 · 작은 글자 · 오류를 모음 | `node tools/check.js . evidence/check 5 study` · 뒤쪽 화면까지 빨리 가려면 앞에 `BOOST=2.2` |
| `rt.js` | 실제 시간 · 실제 클릭으로 첫 이틀(연타 · 화면 버튼 · 저장/이어하기 · 창 크기) | `node tools/rt.js` |
| `shot.js` | 한 장 찍기 | `node tools/shot.js index.html out.png --query "scene=figures"` |

창은 뜨지 않는다. `check.js` 의 봇은 사람 흉내가 아니라 "끝까지 가는지"만 본다 — 재미와 난이도는 사람이 해 봐야 안다.
