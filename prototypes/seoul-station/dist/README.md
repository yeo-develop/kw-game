# 빌드해 둔 판

| 파일 | 내용 | 다시 만들기 (게임 폴더에서) |
|---|---|---|
| `seoul-station.html` | 게임 한 장 (글꼴 · js 를 다 넣음, 1.4MB) — 브라우저로 바로 열림 | `python3 tools/build-web.py . <폴더>` → `<폴더>/one/index.html` |
| `screens.html` | 모든 화면 모음 170장 (화면 검토용, 7.8MB) | `node tools/screens.js . <폴더>` → `<폴더>/index.html` |

2026-11-21 판 — iteration 6 (2026-11-21 피드백: 알바 열 가지 · 신용 보고서 · 종목 열여섯 · 세상 사건 스무 가지 · 돌발 사건 서른다섯), 소스는 커밋 `4da8dfd`. 소스를 고치면 이 두 파일은 위 명령으로 다시 만들어 바꿔 넣는다.

올린 주소도 이 판이다 (2026-11-21 올림 — 올라간 파일이 이 두 파일과 바이트까지 같다): https://s.nolss.uk/seoul-station · https://s.nolss.uk/seoul-station-screens — 그 전에 올라가 있던 판은 이 폴더의 예전 커밋에 그대로 있다(2026-11-20 의 iteration 5 는 `1539d97`, 2026-11-17 판은 `a4426d4`).
