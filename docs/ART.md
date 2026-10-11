# 아트 에셋 (v1, 2026-10-11)

## 어디에 있나
- **게임용 (git):** `Assets/Art/` — 캐릭터·아이콘은 배경 제거한 투명 PNG, 배경·CG는 JPG. `Assets/Editor/ArtImporter.cs`가 전부 스프라이트로 가져오고, 캐릭터 피벗은 발끝(아래 가운데).
- **원본 (git 아님):** 로컬 `art/` (gitignore) + R2 `serin-assets/kw-game/art-src/` (같은 폴더 구조, webp). 다시 받기: `npx wrangler r2 object get serin-assets/kw-game/art-src/<경로> --file <경로> --remote`.
- 탈락작은 각 폴더 `rejects/`, 고르기 전 후보는 `cg/candidates/`, 첫 시안은 `mirai/raw/`·`mirai/base_candidates/`.

## 목록 (67장)
| 구분 | Assets/Art | 크기 | 파일 |
|---|---|---|---|
| 미래 스탠딩 11 | Characters/Mirai | 높이 1080 PNG | base, excited, mental(멘헤라), crying, crying_comic(오열), annoyed, shocked, smug, tired, pajama, dizzy(기절) — `mirai_` 접두 |
| 김사장·NPC 16 | Characters/NPC | 높이 1080 PNG | kim_base, kim_menace, kim_farewell + data/npcs.json 키(broker, dealer, race, lotto, pc, bank, shop, work, taxi, cousin, pckid, hench, suit) |
| 배경 10 | Backgrounds | 1216×832 JPG | room_day, room_night + 장소 키(broker, bank, casino, work, pc, shop, lotto, race) |
| CG 5 | CG | 1216×832 JPG | opening_visit(김사장 방문), opening_box(유품 상자), ending_clear, ending_bad1(끌려감), ending_bad2(도박) |
| 유품 17 | Icons/Relics | 256 PNG | data/augments.json AUGS id와 같은 이름 |
| 꽝 8 | Icons/Junk | 256 PNG | key, pen, lotto_slip, pouch, sock, whitepaper, calculator, toad (RELIC_JUNK 순서) |

배경 제거 때 하트·반짝이·소용돌이 같은 효과 그림도 같이 지워진다(신남·기절 등). 필요하면 유니티 파티클/UI로 다시 얹는다.

## 다시 뽑을 때 (NovelAI V4.5 Full)
- Base Prompt·UC는 사용자 설정(아티스트 믹스) 그대로. 장면은 Character Prompt 칸에 쓴다.
- 미래 일관성: Precise Reference에 `art/mirai/base_candidates/1_seed160692796.webp`(사용자가 프린트 정리한 버전) → **Character만, Strength 0.6, Fidelity 0.6.** "Character & Style"·강도 1이면 색이 타고 참조 포즈를 복사한다. 참조 켜면 장당 5 Anlas.
- 미래 공통 태그: `girl, dark grey hair, blue eyes, medium hair, messy hair, 1.3::ahoge::, hair between eyes, fang, mole under left eye, -0.75::loli::, flat chest, cowboy shot, standing, plain black hoodie, hood down, grey track pants, … white background, simple background, -2::phone, smartphone, holding object, text on clothes, print hoodie::` (폰은 일관성이 안 잡혀서 뺌)
- 두 사람 이상 나오는 CG는 캐릭터 칸을 나누고(+ → Female/Male) 미래 참조는 끈다. 참조를 켜면 모든 인물이 미래처럼 그려진다.
- 아이콘: 정사각 1024, `no humans, still life, game item icon, single object centered, <물건>, simple white background, soft shadow, -2::text, letters, people, character::`. 헷갈리는 물건은 `1.5::…::`로 강조하고 잘못 나온 물건을 음수 태그로.
- 생성물은 `~/Downloads`에 자동 저장된다.

## 게임용 파일 다시 만들기
```
swiftc -O tools/art/cutout.swift -o /tmp/cutout   # macOS Vision 전경 마스크
python3 tools/art/export.py                       # art/ → Assets/Art
```
