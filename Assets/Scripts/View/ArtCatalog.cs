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

        /// 장면 bg 키(scene 이벤트·locations.json bg·jobs.json bg·endings.json bg) → Backgrounds 파일. 없는 키(map·sea 등)는 null = 색 패널.
        static readonly Dictionary<string, string> BG = new Dictionary<string, string>
        {
            ["broker"] = "broker", ["bank"] = "bank", ["casino"] = "casino", ["pc"] = "pc", ["lotto"] = "lotto", ["race"] = "race",
            ["boutique"] = "shop", ["shop"] = "shop",
            ["jobs"] = "work", ["work"] = "work", ["cafe"] = "work", ["store"] = "work", ["ware"] = "work", ["mart"] = "work",
        };
        public static Sprite Background(string bg, bool night)
        {
            if (bg == "room") return Load("Backgrounds/" + (night ? "room_night" : "room_day"));
            return bg != null && BG.TryGetValue(bg, out var f) ? Load("Backgrounds/" + f) : null;
        }

        /// sim 표정 키(web FACES: neutral·happy·smug·sad·panic·tired·angry·menhera·flex·cry·shy) → 미래 스탠딩 이름
        static readonly Dictionary<string, string> FACE = new Dictionary<string, string>
        {
            ["neutral"] = "base", ["shy"] = "base", ["happy"] = "excited", ["flex"] = "excited", ["smug"] = "smug",
            ["sad"] = "crying", ["cry"] = "crying", ["panic"] = "shocked", ["tired"] = "tired", ["angry"] = "annoyed", ["menhera"] = "mental",
        };
        public static string FaceSprite(string face) => face != null && FACE.TryGetValue(face, out var f) ? f : null;
        public static Sprite Mirai(string sprite) => Load("Characters/Mirai/mirai_" + (sprite ?? "base"));

        /// npcs.json 키 또는 kim_base·kim_menace·kim_farewell
        public static Sprite Npc(string key) => key == null ? null : Load("Characters/NPC/" + key);
        public static Sprite Cg(string key) => key == null ? null : Load("CG/" + key);
        public static Sprite Relic(string id) => id == null ? null : Load("Icons/Relics/" + id);

        /// RELIC_JUNK 순서 그대로
        static readonly string[] JUNK = { "key", "pen", "lotto_slip", "pouch", "sock", "whitepaper", "calculator", "toad" };
        public static Sprite Junk(int i) => i >= 0 && i < JUNK.Length ? Load("Icons/Junk/" + JUNK[i]) : null;
    }
}
