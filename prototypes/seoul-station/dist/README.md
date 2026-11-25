# 빌드해 둔 판

| 파일 | 내용 | 다시 만들기 (게임 폴더에서) |
|---|---|---|
| `seoul-station.html` | 게임 한 장 (글꼴 · js 를 다 넣음, 1.4MB) — 브라우저로 바로 열림 | `python3 tools/build-web.py . <폴더>` → `<폴더>/one/index.html` |
| `screens.html` | 게임 화면 모음 (화면 검토용) | `node tools/screens.js . <폴더>` → `<폴더>/index.html` |

이 폴더의 로컬 빌드에는 서울역 프롤로그와 네 단계 시작 안내가 들어 있다. 소스를 고치면 위 명령으로 두 파일을 다시 만든다.

2026-11-24에 공개한 게임은 커밋 `7a6477b`(작은 화면의 첫날 배치 · 저장 안정화 · 특성 카드)로 만들었다. 공개 주소는 [서울역 상태창](https://s.nolss.uk/seoul-station) · [게임 화면 모음](https://s.nolss.uk/seoul-station-screens)이다. 그 전에 올라가 있던 판은 이 폴더의 예전 커밋에 그대로 있다(2026-11-22 의 프롤로그 · 행동 UI 개편 판은 `b8aed99`, 2026-11-21 의 iteration 6 은 `7a3a81d`, 2026-11-20 의 iteration 5 는 `1539d97`, 2026-11-17 판은 `a4426d4`).
