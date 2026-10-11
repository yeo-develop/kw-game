using KwGame.Sim;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.View
{
    // 장면 그림: 배경 · CG · 미래 스탠딩(표정) · NPC/김사장 초상. 키 → 파일은 ArtCatalog, 여기는 "지금 무엇을 띄울지"만 고른다.
    //
    // 미래 표정 (docs/UNITY.md §9):
    //  1) 평소(이벤트 재생이 끝나고 몇 초 뒤) = 상태 표정: 기절→dizzy · 멘헤라(stress ≥ menLine)→mental · stress ≥ 55→crying
    //     · 불안(stress ≥ 40) 또는 체력 < HP_LOW→tired · 그 외→base   (web sim moodFace 를 스프라이트 7종에 맞게 늘림)
    //  2) sim 이벤트의 face 키(say·bubble·face·scene)는 ArtCatalog.FACE 표로 바꿔 띄우고, 재생이 끝난 뒤 3초 유지 후 1)로 돌아감
    //  3) 강한 연출(재생 묶음이 끝날 때까지 다른 face 키에 안 덮임): 큰 수익 fx flex→excited · 큰 손실 fx crack→shocked
    //     · 청산 fx ash→crying_comic · 기절→dizzy
    //  4) 그 밖: 김사장 대사(얼굴 지정 없음)·주갤 반응 토스트→annoyed · 소소한 수익(카지노/경마/복권 당첨)·유품 획득→smug
    //     · 아침 결산(밤잠 뒤)→pajama
    public partial class GameController
    {
        const float FACE_HOLD = 3f;
        VisualElement bgEl, cgEl, miraiEl, npcEl;
        string faceNow = "base", npcKey, kimKey, cgKey, sceneKey;
        float faceHold; bool faceStrong, faceSetInPlay, miraiOn = true;

        void BuildStageArt()
        {
            bgEl = new VisualElement(); Ui.Fill(bgEl); Cover(bgEl); bgEl.pickingMode = PickingMode.Ignore; stage.Add(bgEl);
            miraiEl = Figure(); miraiEl.style.left = 20; stage.Add(miraiEl);
            npcEl = Figure(); npcEl.style.right = 10; npcEl.style.height = 800; npcEl.style.width = 800 * 739f / 1080f; stage.Add(npcEl);
            cgEl = new VisualElement(); Ui.Fill(cgEl); Cover(cgEl); cgEl.pickingMode = PickingMode.Ignore; cgEl.style.display = DisplayStyle.None; stage.Add(cgEl);
        }
        static void Cover(VisualElement v) => v.style.backgroundSize = new BackgroundSize(BackgroundSizeType.Cover);
        static VisualElement Figure()
        {
            // 캐릭터 PNG 는 전부 739×1080 (발끝 피벗) → 무대 바닥에 붙여 세움. 대사창은 그 위에 그려져 글자를 가리지 않음.
            var v = new VisualElement(); Ui.Abs(v, null, null, null, 0);
            v.style.height = 900; v.style.width = 900 * 739f / 1080f;
            v.style.backgroundSize = new BackgroundSize(BackgroundSizeType.Contain);
            v.style.backgroundPositionY = new BackgroundPosition(BackgroundPositionKeyword.Bottom);
            v.pickingMode = PickingMode.Ignore;
            return v;
        }
        static void Img(VisualElement v, Sprite s)
        {
            v.style.backgroundImage = s != null ? new StyleBackground(s) : new StyleBackground(StyleKeyword.None);
            v.style.display = s != null ? DisplayStyle.Flex : DisplayStyle.None;
        }

        // ---------- 그리기 ----------
        void DrawStage()
        {
            bool cg = cgKey != null;
            Img(cgEl, cg ? ArtCatalog.Cg(cgKey) : null);
            Img(miraiEl, !cg && miraiOn ? ArtCatalog.Mirai(faceNow) : null);
            Img(npcEl, cg ? null : ArtCatalog.Npc(kimKey ?? npcKey));
            stageTitle.style.display = cg ? DisplayStyle.None : DisplayStyle.Flex;
        }
        void SetBg(string bg, bool night)
        {
            stage.style.backgroundColor = bg != null && BG.TryGetValue(bg, out var c) ? c : BG["room"];
            Img(bgEl, ArtCatalog.Background(bg, night));
        }

        /// 이벤트 없이 화면을 다시 그릴 때: pending 으로 장소·인물을 고름 (web main.js homePrompt/locPrompt 대응)
        void RenderStage()
        {
            var P = S.pending; string bg = "room"; bool night = G.isEve();
            npcKey = null; kimKey = null; cgKey = null; miraiOn = true;
            switch (P?.t)
            {
                case null: case "start": case "home": case "menhera": case "impulse": case "tempt": break;
                case "relic": if (S.phase == "opening") cgKey = "opening_box"; break;
                case "payday": night = true; kimKey = "kim_menace"; break;
                case "loan": kimKey = "kim_base"; break;
                case "map": bg = "map"; miraiOn = false; break;
                case "encounter": bg = "map"; npcKey = D.SRC.TryGetValue(P.id, out var src) ? src.npc : null; break;
                case "ending": cgKey = S.endInfo != null ? "ending_" + S.endInfo.kind : null; toastCol.Clear(); break;
                default:
                    {
                        string key = P.t == "loc" ? P.key : S.visit?.key;
                        if (key != null && D.LOCS.TryGetValue(key, out var L)) { bg = L.bg; npcKey = L.npc; }
                        break;
                    }
            }
            SetBg(bg, night);
            if (Time.realtimeSinceStartup >= faceHold) { faceNow = MoodSprite(); faceStrong = false; }
            DrawStage();
        }

        string MoodSprite()
        {
            var h = G.HudSnapOf();
            if (h.faint) return "dizzy";
            if (h.stress >= G.menLine()) return "mental";
            if (h.stress >= 55) return "crying";
            if (h.stress >= 40 || h.hp < D.RULES.HP_LOW) return "tired";
            return "base";
        }

        // ---------- 이벤트 쪽 ----------
        void SetScene(string bg, string face, bool night = false)
        {
            SetBg(bg, night || (bg == "room" && G.isEve()));
            npcKey = null; kimKey = null; cgKey = null; miraiOn = bg != "map";
            if (face != null) SetFace(face); else DrawStage();
        }
        void SetFace(string f) { var s = ArtCatalog.FaceSprite(f); if (s != null) HoldFace(s); }
        void HoldFace(string sprite, bool strong = false)
        {
            if (faceStrong && !strong) return;
            faceNow = sprite; faceStrong |= strong;
            faceHold = Time.realtimeSinceStartup + FACE_HOLD; faceSetInPlay = true;
            miraiOn = true;
            DrawStage();
        }
        void ShowNpc(string key) { npcKey = key; DrawStage(); }
        void ShowKim(bool on)
        {
            kimKey = !on ? null : sceneKey == "clear" ? "kim_farewell" : S.phase == "payday" || S.pending?.t == "payday" ? "kim_menace" : "kim_base";
            if (sceneKey == "opening") cgKey = on ? "opening_visit" : null;
            DrawStage();
        }
        void ShowCg(string key) { cgKey = key; DrawStage(); }

        /// 대사 화자에 맞춰 인물 띄우기
        void SpeakerArt(string who, string name, string face)
        {
            if (who == "m") { if (!miraiOn) { miraiOn = true; DrawStage(); } }
            else if (who == "kim") { if (kimKey == null) ShowKim(true); if (face == null) HoldFace("annoyed"); }
            else if (who == "npc" && name != null) foreach (var kv in D.NPC_NAME) if (kv.Value == name) { ShowNpc(kv.Key); break; }
        }

        /// 재생 시작/끝 (Play 에서 호출)
        void FacePlayBegin() { faceStrong = false; faceSetInPlay = false; }
        void FacePlayEnd() { if (faceSetInPlay) faceHold = Time.realtimeSinceStartup + FACE_HOLD; faceStrong = false; }
        void FaceTick()
        {
            if (playing || faceHold <= 0 || Time.realtimeSinceStartup < faceHold) return;
            faceHold = 0; faceNow = MoodSprite(); DrawStage();
        }
    }
}
