# 개발용 도구 (게임은 이 폴더를 쓰지 않는다)

| 파일 | 하는 일 | 돌리는 법 |
|---|---|---|
| `rules-test.js` | 규칙이 기획서대로 도는지 36가지 확인 (브라우저 없이) | `node tools/rules-test.js` |
| `sim.js` | 봇 10종으로 한 판씩 굴려 균형을 봄 (알바만 · 묻어 두기 · 뉴스 · 공부 · 과감 · 주식만 · 무지성) | `node tools/sim.js . 300` · 값을 바꿔 보려면 뒤에 `house_price=30000000` 처럼 |
| `check.js` | 화면으로 한 판을 끝까지 몰며 주요 화면을 찍고, 글자 넘침 · 겹침 · 작은 글자 · 오류를 모음 | `node tools/check.js . evidence/check 5 study` · 뒤쪽 화면까지 빨리 가려면 앞에 `BOOST=2.2` |
| `rt.js` | 실제 시간 · 실제 클릭으로 첫 이틀(연타로 창이 넘어가지 않는지 · 아침에 뜨는 창 수 · 화면 버튼 · 저장/이어하기 · 확인 창의 키 · 창 크기) | `node tools/rt.js` |
| `worst.js` | 글이 가장 많은 날의 주식 · 코인 탭 넘침, 도장, 효과 줄이기, 창이 몰리는 때(퀘스트 여러 개 · 건너뛰기 · 같은 알림) | `node tools/worst.js` |
| `zones.js` | 구역 다섯 개의 겹침 · 간격 · 머리줄 · 창 크기별 비율 | `node tools/zones.js` |
| `textcount.js` | 화면 네 곳의 보이는 글자 수 (옛 판 폴더를 주면 줄어든 비율) | `node tools/textcount.js . <옛 판 폴더>` |
| `shot.js` | 한 장 찍기 | `node tools/shot.js index.html out.png --query "scene=figures"` |

창은 뜨지 않는다. `check.js` 의 봇은 사람 흉내가 아니라 "끝까지 가는지"만 본다 — 재미와 난이도는 사람이 해 봐야 안다.

알려진 한계: 화면은 1280×720 을 통째로 늘리고 줄인다. 800×450 처럼 작은 창에서는 배치는 그대로지만 글자가 9px 안팎으로 작아져 읽기 어렵다.
