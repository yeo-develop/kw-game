# 아트 에셋 (v1, 2026-10-11)

## 어디에 있나
- **게임용 (git):** `Assets/Resources/Art/` — 캐릭터·아이콘은 배경 제거한 투명 PNG, 배경·CG는 JPG. `Assets/Editor/ArtImporter.cs`가 전부 스프라이트로 가져오고, 캐릭터 피벗은 발끝(아래 가운데). 런타임은 `Resources.Load` (View/ArtCatalog.cs) — 화면 어디에 무엇이 붙는지는 docs/UNITY.md §9.
- **원본 (git 아님):** 로컬 `art/` (gitignore) + R2 `serin-assets/kw-game/art-src/` (같은 폴더 구조, webp). 다시 받기: `npx wrangler r2 object get serin-assets/kw-game/art-src/<경로> --file <경로> --remote`.
- 탈락작은 각 폴더 `rejects/`, 고르기 전 후보는 `cg/candidates/`, 첫 시안은 `mirai/raw/`·`mirai/base_candidates/`.

## 목록 (90장)
| 구분 | Assets/Resources/Art | 크기 | 파일 |
|---|---|---|---|
| 미래 스탠딩 16 | Characters/Mirai | 높이 1080 PNG | base, excited, mental(멘헤라·지뢰계, 10-22 다시 그림), yami(최상위 멘헤라·스트레스 90+), crying, crying_comic(오열), annoyed, pout(삐짐), shy, flex(선글라스), love(하트눈·큰 수익), shocked, smug, tired, pajama, dizzy(기절) — `mirai_` 접두 |
| 김사장·NPC 18 | Characters/NPC | 높이 1080 PNG | kim_base, kim_menace, kim_farewell + data/npcs.json 키(broker, dealer, race, lotto, pc, bank, shop, work, taxi, cousin, pckid, hench, suit, imo(포차 이모), pharm(약사)) |
| 배경 19 | Backgrounds | 1216×832 JPG | room_day, room_night + 장소 키(broker, bank, casino, work, pc, shop, lotto, race, park, bar, hosp) + 알바(cafe, store, ware, mart) + 엔딩(sea, gall) |
| CG 11 | CG | 1216×832 JPG | opening_visit(김사장 방문), opening_box(유품 상자), ending_clear, ending_bad1(끌려감), ending_bad2(도박), ending_bad3(과로·병원), ending_bad4(멘헤라) + 변형 ending_clear_gamble, ending_clear_rich, ending_bad1_gall, ending_bad2_loop |
| 유품 17 | Icons/Relics | 256 PNG | data/augments.json AUGS id와 같은 이름 |
| 꽝 8 | Icons/Junk | 256 PNG | key, pen, lotto_slip, pouch, sock, whitepaper, calculator, toad (RELIC_JUNK 순서) |

새 표정·엔딩 그림이 없으면 조용히 예전 그림으로 대체 (View/ArtCatalog.cs `FaceSprite`·`EndingCg`). 아직 안 그린 선택 그림:
- 엔딩 변형 CG `ending_bad4_sell`·`ending_bad4_run`·`ending_bad1_sea`·`ending_bad2_casino` — 넣으면 자동으로 씀 (없으면 `ending_<kind>`).

isnet-anime는 반짝이·땀방울 같은 효과 그림도 대부분 남긴다. 하트·오라처럼 큰 효과는 지우므로 love·mental·yami는 `clean_cutout(src, keep_fx=True)`(배경색과 다른 픽셀도 남김)로 잘랐다. Remove BG의 `generated`는 하트·오라·얇은 소품(국자)을 지우고, 가끔 얼굴을 다시 그린다(flex 선글라스가 사라짐). 그래서 `export.py`의 `FX`(love·mental·yami·imo)는 `generated` 뒤에 원본의 효과 픽셀을 다시 깔고(`clean.add_fx`), flex는 `masked` 결과를 `nobg/`에 둔다. 버린 결과는 `art/nobg/raw/`.

## 다시 뽑을 때 (NovelAI V4.5 Full)
- Base Prompt·UC는 사용자 설정(아티스트 믹스) 그대로. 장면은 Character Prompt 칸에 쓴다.
- 미래 일관성: Precise Reference에 `art/mirai/base_candidates/1_seed160692796.webp`(사용자가 프린트 정리한 버전) → **Character만, Strength 0.6, Fidelity 0.6.** "Character & Style"·강도 1이면 색이 타고 참조 포즈를 복사한다. 참조 켜면 장당 5 Anlas.
- 미래 공통 태그: `girl, dark grey hair, blue eyes, medium hair, messy hair, 1.3::ahoge::, hair between eyes, fang, mole under left eye, -0.75::loli::, flat chest, cowboy shot, standing, plain black hoodie, hood down, grey track pants, … white background, simple background, -2::phone, smartphone, holding object, text on clothes, print hoodie::` (폰은 일관성이 안 잡혀서 뺌)
- 두 사람 이상 나오는 CG는 캐릭터 칸을 나누고(+ → Female/Male) 미래 참조는 끈다. 참조를 켜면 모든 인물이 미래처럼 그려진다.
- 아이콘: 정사각 1024, `no humans, still life, game item icon, single object centered, <물건>, simple white background, soft shadow, -2::text, letters, people, character::`. 헷갈리는 물건은 `1.5::…::`로 강조하고 잘못 나온 물건을 음수 태그로.
- 생성물은 `~/Downloads`에 자동 저장된다.

## 게임용 파일 다시 만들기
```
python3 -m venv /tmp/artvenv && /tmp/artvenv/bin/pip install "rembg[cpu]" numpy pillow
swiftc -O tools/art/cutout.swift -o /tmp/cutout   # 아이콘용 macOS Vision 전경 마스크
/tmp/artvenv/bin/python tools/art/export.py       # art/ → Assets/Resources/Art
```
- 캐릭터: **NovelAI Director Tools → Remove BG**(장당 65 Anlas)의 `generated` 결과를 `art/nobg/<이름>.png`로 두면 그걸 쓴다(머리카락 사이까지 가장 깨끗, 현재 27장 전부). 없으면 애니 전용 분할 모델 **isnet-anime**(rembg, 첫 실행 때 176MB 자동 다운로드) + 가장자리 흰색 언믹스 (`tools/art/clean.py`). macOS Vision은 머리카락 사이 흰 빈틈을 못 지워서 캐릭터에는 쓰지 않는다.
- 아이콘: macOS Vision (물건은 이쪽이 그림자까지 깔끔).
```
```
