# 올린 판 (s.nolss.uk 와 같은 파일)

| 파일 | 내용 | 올린 주소 | 다시 만들기 (게임 폴더에서) |
|---|---|---|---|
| `seoul-station.html` | 게임 한 장 (글꼴 · js 를 다 넣음, 1.1MB) — 브라우저로 바로 열림 | https://s.nolss.uk/seoul-station | `python3 tools/build-web.py . <폴더>` → `<폴더>/one/index.html` |
| `screens.html` | 모든 화면 모음 111장 (와이어프레임 검사용, 5MB) | https://s.nolss.uk/seoul-station-screens | `node tools/screens.js . <폴더>` → `<폴더>/index.html` |

2026-11-17 판 (커밋 `c0c5ff4` 의 어려워진 미니게임 · `0ac2998` 의 화면 모음 도구). 소스를 고치면 이 두 파일은 위 명령으로 다시 만들어 바꿔 넣는다.
