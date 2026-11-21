# 빌드해 둔 판

| 파일 | 내용 | 다시 만들기 (게임 폴더에서) |
|---|---|---|
| `seoul-station.html` | 게임 한 장 (글꼴 · js 를 다 넣음, 1.4MB) — 브라우저로 바로 열림 | `python3 tools/build-web.py . <폴더>` → `<폴더>/one/index.html` |
| `screens.html` | 게임 화면 모음 (화면 검토용) | `node tools/screens.js . <폴더>` → `<폴더>/index.html` |

이 폴더의 로컬 빌드에는 서울역 프롤로그와 네 단계 시작 안내가 들어 있다. 소스를 고치면 위 명령으로 두 파일을 다시 만든다.

2026-11-21 공개한 iteration 6의 소스는 커밋 `4da8dfd`에 있다. 공개 주소는 [서울역 상태창](https://s.nolss.uk/seoul-station)과 [게임 화면 모음](https://s.nolss.uk/seoul-station-screens)이다.
