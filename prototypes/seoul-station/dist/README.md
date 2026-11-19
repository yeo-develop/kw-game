# 빌드해 둔 판

| 파일 | 내용 | 다시 만들기 (게임 폴더에서) |
|---|---|---|
| `seoul-station.html` | 게임 한 장 (글꼴 · js 를 다 넣음, 1.3MB) — 브라우저로 바로 열림 | `python3 tools/build-web.py . <폴더>` → `<폴더>/one/index.html` |
| `screens.html` | 모든 화면 모음 137장 (화면 검토용, 6MB) | `node tools/screens.js . <폴더>` → `<폴더>/index.html` |

2026-11-20 판 — iteration 5 (2026-11-19 피드백: 체력의 드라마 · 보증금/전세 · 신용 대출 · 부동산 · 종목 일곱 · 공부 성장 · 가게 · 꿈). 소스를 고치면 이 두 파일은 위 명령으로 다시 만들어 바꿔 넣는다.

올린 주소는 아직 앞선 판(2026-11-17)이다: https://s.nolss.uk/seoul-station · https://s.nolss.uk/seoul-station-screens — 이 두 파일을 그대로 올리면 같아진다.
