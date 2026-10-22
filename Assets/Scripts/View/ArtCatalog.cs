using System.Collections.Generic;
using UnityEngine;

namespace KwGame.View
{
    /// 그림 키 → 스프라이트 (Assets/Resources/Art, docs/ART.md). sim 이 쓰는 키(장면 bg·표정·NPC·유품 id)를 파일 이름으로 바꾸는 얇은 표.
    /// Resources 를 쓰는 이유: 데이터(JSON)·폰트도 이미 Resources 로드라 같은 방식이고, 67장(≈수십 MB)이라 Addressables 를 들일 규모가 아님.
    public static class ArtCatalog
    {
        static readonly Dictionary<string, Sprite> cache = new Dictionary<string, Sprite>();

        public static Sprite Load(string path)
        {
            if (path == null) return null;
            if (cache.TryGetValue(path, out var s)) return s;
            s = Resources.Load<Sprite>("Art/" + path);
            if (s == null) Debug.LogWarning("[art] 없음: Art/" + path);
            cache[path] = s;
            return s;
        }

        /// 장면 bg 키(scene 이벤트·locations.json bg·jobs.json bg·endings.json bg) → Backgrounds 파일. 없는 키(map 등)는 null = 색 패널.
        static readonly Dictionary<string, string> BG = new Dictionary<string, string>
        {
            ["broker"] = "broker", ["bank"] = "bank", ["casino"] = "casino", ["pc"] = "pc", ["lotto"] = "lotto", ["race"] = "race",
            ["boutique"] = "shop", ["shop"] = "shop",
            ["jobs"] = "work", ["work"] = "work", ["cafe"] = "cafe", ["store"] = "store", ["ware"] = "ware", ["mart"] = "mart",
            ["park"] = "park", ["bar"] = "bar", ["hosp"] = "hosp", ["sea"] = "sea", ["gall"] = "gall",
        };
        public static Sprite Background(string bg, bool night)
        {
            if (bg == "room") return Load("Backgrounds/" + (night ? "room_night" : "room_day"));
            return bg != null && BG.TryGetValue(bg, out var f) ? Load("Backgrounds/" + f) : null;
        }

        /// sim 표정 키(web FACES: neutral·happy·smug·sad·panic·tired·angry·menhera·flex·cry·shy + yami·pout·love) → 미래 스탠딩 이름
        static readonly Dictionary<string, string> FACE = new Dictionary<string, string>
        {
            ["neutral"] = "base", ["happy"] = "excited", ["smug"] = "smug",
            ["sad"] = "crying", ["cry"] = "crying", ["panic"] = "shocked", ["tired"] = "tired", ["angry"] = "annoyed", ["menhera"] = "mental",
        };
        /// 전용 스탠딩이 생긴 표정: (전용 그림, 그림 없을 때 예전 대체). 그림이 빠져도 게임이 돌게 조용히 확인하고 대체로
        static readonly Dictionary<string, (string own, string old)> FACE2 = new Dictionary<string, (string, string)>
        {
            ["shy"] = ("shy", "base"), ["flex"] = ("flex", "excited"), ["yami"] = ("yami", "mental"), ["pout"] = ("pout", "annoyed"), ["love"] = ("love", "excited"),
        };
        public static string FaceSprite(string face) => FaceSprite(face, s => Has("Characters/Mirai/mirai_" + s));
        /// 테스트용: has = 스탠딩 그림이 있나
        public static string FaceSprite(string face, System.Func<string, bool> has)
        {
            if (face == null) return null;
            if (FACE2.TryGetValue(face, out var f2)) return has(f2.own) ? f2.own : f2.old;
            return FACE.TryGetValue(face, out var f) ? f : null;
        }
        /// 경고 없이 있나만 확인 (없을 수 있는 새 그림: 표정·엔딩 변형 CG). 결과는 Load 캐시와 같이 씀
        public static bool Has(string path)
        {
            if (!cache.TryGetValue(path, out var s)) cache[path] = s = Resources.Load<Sprite>("Art/" + path);
            return s != null;
        }
        public static Sprite Mirai(string sprite) => Load("Characters/Mirai/mirai_" + (sprite ?? "base"));

        /// npcs.json 키 또는 kim_base·kim_menace·kim_farewell
        public static Sprite Npc(string key) => key == null ? null : Load("Characters/NPC/" + key);
        public static Sprite Cg(string key) => key == null ? null : Load("CG/" + key);
        /// 엔딩 CG: 변형 그림(ending_<kind>_<variant>)이 있으면 그것, 없으면 ending_<kind>
        public static string EndingCg(string kind, string variant) => EndingCg(kind, variant, k => Has("CG/" + k));
        public static string EndingCg(string kind, string variant, System.Func<string, bool> has)
        {
            if (kind == null) return null;
            string v = string.IsNullOrEmpty(variant) ? null : "ending_" + kind + "_" + variant;
            return v != null && has(v) ? v : "ending_" + kind;
        }
        /// 미니게임 그림 (Icons/Minigame/<키>). player(나)처럼 일부러 안 그린 키도 있어서 없으면 경고 없이 null → 색 도형으로 그림
        public static Sprite Minigame(string key)
        {
            string path = "Icons/Minigame/" + key;
            if (!cache.TryGetValue(path, out var s)) cache[path] = s = Resources.Load<Sprite>("Art/" + path);
            return s;
        }
        public static Sprite Relic(string id) => id == null ? null : Load("Icons/Relics/" + id);

        /// RELIC_JUNK 순서 그대로
        static readonly string[] JUNK = { "key", "pen", "lotto_slip", "pouch", "sock", "whitepaper", "calculator", "toad" };
        public static Sprite Junk(int i) => i >= 0 && i < JUNK.Length ? Load("Icons/Junk/" + JUNK[i]) : null;
    }
}
