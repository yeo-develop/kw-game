using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using KwGame.Sim;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.View
{
    /// 메인 루프 (web/src/view/main.js 대응): pending → 화면 → 명령 → 이벤트 재생 → pending …
    /// 화면은 UI Toolkit 을 코드로 만든다 (UXML/프리팹 없이 데이터 따라 메뉴가 바뀌는 구조라 flex 레이아웃이 편함).
    public partial class GameController : MonoBehaviour
    {
        public int seed = 0;            // 0 = 랜덤
        public bool autoSkipDialog;     // 데모·스크린샷용

        GameData D; GameSim G; GameState S => G.S;
        UIDocument doc; VisualElement root;
        VisualElement hudBar, stage, dlg, panel, panelBody, toastCol, modal, phone;
        Label stageTitle, dlgName, dlgText, panelTitle;
        bool playing, waiting, clicked; int waitFrame;
        bool phoneOpen; string phoneTab = "stock";
        float mgScore = 0.7f; double stakeFrac = 0.1;
        Font font, fontBold;

        static readonly Dictionary<string, Color> BG = new Dictionary<string, Color>
        {
            ["room"] = new Color32(0x2b, 0x24, 0x3a, 0xff), ["map"] = new Color32(0x1e, 0x33, 0x2a, 0xff), ["broker"] = new Color32(0x1d, 0x2a, 0x4a, 0xff),
            ["bank"] = new Color32(0x22, 0x30, 0x40, 0xff), ["casino"] = new Color32(0x45, 0x12, 0x22, 0xff), ["cafe"] = new Color32(0x3a, 0x2a, 0x1e, 0xff),
            ["store"] = new Color32(0x1f, 0x3a, 0x3a, 0xff), ["ware"] = new Color32(0x33, 0x2e, 0x24, 0xff), ["mart"] = new Color32(0x2e, 0x36, 0x1e, 0xff),
            ["pc"] = new Color32(0x18, 0x18, 0x30, 0xff), ["shop"] = new Color32(0x3a, 0x1e, 0x36, 0xff), ["lotto"] = new Color32(0x3a, 0x33, 0x14, 0xff),
            ["race"] = new Color32(0x1e, 0x3a, 0x1a, 0xff), ["sea"] = new Color32(0x10, 0x22, 0x3a, 0xff), ["gall"] = new Color32(0x22, 0x22, 0x22, 0xff),
        };

        // ---------- 시작 ----------
        void Start()
        {
            Application.targetFrameRate = 60;
            D = LoadData();
            font = Resources.Load<Font>("Fonts/Pretendard-Regular");
            fontBold = Resources.Load<Font>("Fonts/Pretendard-Bold");
            BuildUi();
            NewGame(seed != 0 ? seed : UnityEngine.Random.Range(1, 1000000));
            var shots = ArgValue("-kwShots");
            if (shots != null) StartCoroutine(DemoShots(shots));
        }

        public static GameData LoadData()
        {
            var assets = Resources.LoadAll<TextAsset>("Data");
            return GameData.Load(assets.Select(a => new KeyValuePair<string, string>(a.name + ".json", a.text)));
        }

        void NewGame(int sd)
        {
            G = GameSim.Create(D, sd);
            G.Hud = true;
            phoneOpen = false;
            RenderAll();
        }

        public void Send(SimCommand c)
        {
            if (playing) return;
            var evs = G.Apply(c);
            StartCoroutine(Play(evs));
        }
        void Send(string t, params object[] kv) => Send(new SimCommand(t, kv));

        // ---------- 이벤트 재생 (events.js) ----------
        IEnumerator Play(List<SimEvent> evs)
        {
            playing = true; FacePlayBegin();
            panel.SetEnabled(false); panel.style.opacity = 0.45f;
            foreach (var e in evs)
            {
                if (e.h != null) RenderHud(e.h);
                switch (e.t)
                {
                    case "say": yield return Say(e.Str("who"), e.Str("name"), e.Str("text"), e.Str("face")); break;
                    case "hideDlg": dlg.style.display = DisplayStyle.None; break;
                    case "scene": SetScene(e.Str("bg"), e.Str("face"), e["night"] is bool nt && nt); break;
                    case "face": SetFace(e.Str("f")); break;
                    case "kim": ShowKim(e["on"] is bool on && on); break;
                    case "npc": stageTitle.text = Ui.Clean(e.Str("kind") != null && D.NPC_NAME.TryGetValue(e.Str("kind"), out var nn) ? nn : LocTitle()); ShowNpc(e.Str("kind")); break;
                    case "toast": Toast(e.Str("text"), e.Str("kind")); if (e.Str("app") == "gall") HoldFace("annoyed"); break;
                    case "bubble": Toast("미래: " + e.Str("text"), "bubble"); SetFace(e.Str("face")); break;
                    case "tip": if (e.Str("bubble") != null) { Toast("미래: " + e.Str("bubble"), "bubble"); SetFace(e.Str("face")); } break;
                    case "casino": Toast($"{e.Str("txt")}  ({G.sgnWon(e.Num("net"))})", e.Num("net") > 0 ? "good" : "liq"); if (e.Num("net") > 0) HoldFace("smug"); yield return new WaitForSeconds(autoSkipDialog ? 0 : 0.35f); break;
                    case "race": { var H = S.pending?.H; string w = H != null && (int)e.Num("win") < H.Count ? H[(int)e.Num("win")].name : "?"; Toast($"1등: {w}  ({G.sgnWon(e.Num("net"))})", e.Num("net") > 0 ? "good" : "liq"); if (e.Num("net") > 0) HoldFace("smug"); break; }
                    case "scratch": Toast(e["prize"] is object[] pz ? $"당첨! {G.won(Convert.ToDouble(pz[1]))}" : "꽝", e["prize"] != null ? "good" : ""); if (e["prize"] != null) HoldFace("smug"); break;
                    case "lottoDraw": Toast($"빚또 추첨: {string.Join("·", (List<int>)e["win"])} → {G.won(e.Num("tot"))}", "news"); break;
                    case "fx":
                        switch (e.Str("k"))
                        {
                            case "big": Toast(e.Str("text") + " " + (e.Str("small") ?? ""), "big"); break;
                            case "flex": HoldFace("excited", true); break;
                            case "crack": HoldFace("shocked", true); break;
                            case "ash": HoldFace("crying_comic", true); break;
                        }
                        break;
                    case "relic": { var a = D.AUGS.FirstOrDefault(x => x.id == e.Str("id")); if (a != null) { Toast($"유품 획득: {a.name}", "good", ArtCatalog.Relic(a.id)); HoldFace("smug"); } break; }
                    case "gacha": if (e["junk"] != null) Toast("꽝: " + e.Str("text"), "", ArtCatalog.Junk((int)e.Num("junk"))); break;
                    case "bought": SetFace("happy"); break;
                    case "menhera": Toast("카톡 " + ((string[])e["msgs"]).Length + "개 폭탄", "liq"); SetFace("menhera"); break;
                    case "addictEv": if (e.Str("k") == "secret") Toast($"몰래 카지노 {G.sgnWon(e.Num("amt"))}", "liq"); break;
                    case "faint": Toast("기절!", "liq"); HoldFace("dizzy", true); break;
                    case "morning": yield return Morning(e); break;
                    case "opening": yield return PlayScene("opening"); break;
                    case "ending": if (e.Str("kind") == "clear") yield return PlayScene("clear"); break;
                    case "error": Debug.LogWarning("[sim] " + e.Str("msg")); break;
                }
            }
            dlg.style.display = DisplayStyle.None;
            playing = false; FacePlayEnd();
            panel.SetEnabled(true); panel.style.opacity = 1f;
            RenderAll();
        }

        IEnumerator Say(string who, string name, string text, string face)
        {
            dlg.style.display = DisplayStyle.Flex;
            dlgName.text = Ui.Clean(who == "m" ? "미래" : who == "me" ? "나" : who == "kim" ? "김사장" : who == "npc" ? name : "");
            dlgName.style.display = dlgName.text == "" ? DisplayStyle.None : DisplayStyle.Flex;
            dlgText.text = Ui.Clean(text);
            dlgText.style.unityFontStyleAndWeight = who == "nar" ? FontStyle.Italic : FontStyle.Normal;
            if (face != null) SetFace(face);
            SpeakerArt(who, name, face);
            yield return WaitClick();
        }
        IEnumerator WaitClick()
        {
            if (autoSkipDialog) { yield return null; yield break; }
            waiting = true; clicked = false; waitFrame = Time.frameCount;
            while (!clicked) yield return null;
            waiting = false;
        }
        void Update()
        {
            FaceTick();
            if (!waiting) return;
            if (Time.frameCount <= waitFrame) return;
            if (Input.GetMouseButtonDown(0) || Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return)) clicked = true;
        }

        IEnumerator PlayScene(string key)
        {
            var steps = D.J["SCENES"]?[key] as JArray;
            if (steps == null) yield break;
            sceneKey = key;
            foreach (JObject st in steps)
            {
                if (st["say"] != null) yield return Say((string)st["say"], (string)st["name"], (string)st["text"], (string)st["face"]);
                else switch ((string)st["do"])
                {
                    case "scene": SetScene((string)st["bg"], (string)st["face"], (bool?)st["night"] == true); break;
                    case "face": SetFace((string)st["f"]); break;
                    case "kim": ShowKim((bool?)st["on"] == true); break;
                    case "hideDlg": dlg.style.display = DisplayStyle.None; break;
                    case "rules": yield return RulesCard(); if (key == "opening") ShowCg("opening_box"); break;   // 규칙 뒤 = 유품 상자 장면
                }
            }
            sceneKey = null;
            dlg.style.display = DisplayStyle.None;
        }

        IEnumerator Morning(SimEvent e)
        {
            modal.Clear();
            modal.style.display = DisplayStyle.Flex;
            HoldFace("pajama");   // 밤잠 자고 일어난 아침
            var card = Card(900);
            card.Add(Ui.Label($"☀ {e.Num("month")}개월차 {e.Num("day")}일 아침", 40, Ui.Gold, true));
            card.Add(Ui.Label(e["paid"] is bool p && p ? "이번 달 이자 냄" : $"이자일까지 D-{e.Num("dd")} · 이자 {G.won(e.Num("due"))}", 26, Ui.Dim));
            var Y = e["Y"] as List<Dictionary<string, object>>;
            if (Y != null && Y.Count > 0)
            {
                card.Add(Ui.Label("어제 결산", 28, Ui.Text, true));
                foreach (var y in Y.Take(8)) card.Add(Ui.Label($"· {y["label"]}  {G.sgnWon(Convert.ToDouble(y["amt"]))}", 22, Convert.ToDouble(y["amt"]) >= 0 ? Ui.Good : Ui.Bad));
                card.Add(Ui.Label($"합계 {G.sgnWon(e.Num("net"))} ({e.Str("netConv")})", 24, Ui.Text, true));
            }
            if (!string.IsNullOrEmpty(e.Str("ev"))) card.Add(Ui.Label("오늘의 사건: " + e.Str("ev"), 24, Ui.Gold));
            card.Add(Ui.Label("미래: " + e.Str("mline"), 24, Ui.Accent));
            card.Add(Ui.Label("(클릭해서 계속)", 20, Ui.Dim));
            modal.Add(card);
            yield return WaitClick();
            modal.style.display = DisplayStyle.None;
        }

        static string ArgValue(string name)
        {
            var a = Environment.GetCommandLineArgs();
            int i = Array.IndexOf(a, name);
            return i >= 0 && i + 1 < a.Length ? a[i + 1] : null;
        }
    }
}
