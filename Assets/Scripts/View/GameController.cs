using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using KwGame.Sim;
using KwGame.Audio;
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
        Label stageTitle, dlgName, dlgHint, panelTitle;
        bool playing, waiting, clicked; int waitFrame;
        bool waitingForDialogue;
        /// 지금 기다림이 "아무 데나 눌러 넘기기"(WaitClick)인가. 버튼을 고르는 기다림(오프닝 다시 보기 카드)은 false — 그 누름은 버튼 것
        bool waitAny;
        int advanceFrame = -1;
        bool phoneOpen; string phoneTab = "stock";
        double stakeFrac = 0.1;
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
            if (Camera.main != null && !FindObjectsByType<AudioListener>().Any(listener => listener.isActiveAndEnabled))
                Camera.main.gameObject.AddComponent<AudioListener>();
            D = LoadData();
            font = Resources.Load<Font>("Fonts/Pretendard-Regular");
            fontBold = Resources.Load<Font>("Fonts/Pretendard-Bold");
            BuildUi();
            LoadPlayPrefs();   // 글자 속도 · 화면 효과 · 읽은 대사 (GameController.Settings.cs) — 이어하기에도 적용
            bool requested = TitleStartup.Consume(out var restored);
            if (ShotMode.On) restored = null;   // 웹 캡처 모드: 저장을 불러오지 않음 (늘 새 판)
            if (restored != null)
            {
                G = new GameSim(D, restored) { Hud = true };
                G.EnableRt();   // 예전(칸 방식) 저장도 실시간으로 이어서
                saveMessage = "저장 데이터를 불러왔습니다.";
                RenderAll();
            }
            else
            {
                int sd = requested && TitleStartup.Seed > 0 ? TitleStartup.Seed : seed != 0 ? seed : UnityEngine.Random.Range(1, 1000000);
                NewGame(sd, requested ? TitleStartup.Diff : "normal");
                if (requested) Send("start");
            }
            var shots = ArgValue("-kwShots");
            if (shots != null) StartCoroutine(DemoShots(shots));
            var fxShots = ArgValue("-kwFxShots");
            if (fxShots != null) StartCoroutine(FxShots(fxShots));
            if (ShotMode.On) StartCoroutine(WebShots());   // 웹 캡처 모드 (GameController.WebShots.cs)
        }

        public static GameData LoadData()
        {
            var assets = Resources.LoadAll<TextAsset>("Data");
            return GameData.Load(assets.Select(a => new KeyValuePair<string, string>(a.name + ".json", a.text)));
        }

        void NewGame(int sd, string diff = "normal")
        {
            G = GameSim.Create(D, sd, new GameSim.Opts { rt = true, diff = diff });
            metaRunStamp = null; lastUnlock = null;
            G.Hud = true;
            phoneOpen = false;
            LlmNewGame();
            RenderAll();
            LlmTick();
        }

        public void Send(SimCommand c)
        {
            if (playing) { onSent = null; return; }   // 재생 중 누른 주문은 버림 — 걸어 둔 결과 콜백이 남아 다음 명령에 "실패"로 뜨지 않게
            int coinsBefore = S.cps.Count;
            var evs = G.Apply(c);
            int closedCoins = c.t == "closeCoins" ? coinsBefore - S.cps.Count : 0;
            var cb = onSent; onSent = null; cb?.Invoke(evs);   // 주문 결과 메시지 (GameController.Chart.cs)
            LlmTick();   // 새 칸이면 뉴스·대사 요청을 재생 전에 미리 (GameController.Llm.cs)
            StartCoroutine(Play(evs, closedCoins));
        }
        void Send(string t, params object[] kv) => Send(new SimCommand(t, kv));

        // ---------- 이벤트 재생 (events.js) ----------
        IEnumerator Play(List<SimEvent> evs, int closedCoins = 0)
        {
            playing = true; FacePlayBegin();
            MinigameSync();                            // 알바 결과 카드도 바로 걷음
            RenderPlan();                              // 재생 중 계획판은 새 칸으로 (안 눌리게 — DlgSync)
            LayoutForMode(); RenderDesk(); RenderMini();   // 알바 뒤 정산 · 밤 대사 동안에도 상태 띠가 보이게 (예전엔 알바 화면 배치가 남아 숨겨짐)
            panel.style.display = DisplayStyle.None;   // 이벤트 재생 중엔 지난 선택지를 아예 걷음 (반투명으로 남아 보이던 문제)
            saveControls.SetEnabled(false);
            foreach (var e in evs)
            {
                SoundEventAdapter.Play(e, closedCoins);
                if (e.h != null) RenderHud(e.h);
                if (DeskActive && DeskEvent(e)) continue;   // 데스크가 다 보여 준 사건 (GameController.Desk.cs)
                switch (e.t)
                {
                    case "say": yield return Say(e.Str("who"), e.Str("name"), e.Str("text"), e.Str("face")); break;
                    case "hideDlg": HideDialogue(); break;
                    case "scene": SetScene(e.Str("bg"), e.Str("face"), e["night"] is bool nt && nt); break;
                    case "face": SetFace(e.Str("f")); break;
                    case "kim": ShowKim(e["on"] is bool on && on); break;
                    case "kakao": KakaoNotify(e.Str("room")); PlaceAlerts(); break;   // 카톡 팝업이 퀵메뉴를 가리지 않게 (GameController.Screens.cs)
                    case "npc": stageTitle.text = Ui.Clean(e.Str("kind") != null && D.NPC_NAME.TryGetValue(e.Str("kind"), out var nn) ? nn : LocTitle()); ShowNpc(e.Str("kind")); break;
                    case "toast" when e.Str("kind") == "kim" && e.Str("app") == "kakao": break;   // 김사장 카톡은 카톡 알림창으로 (KakaoNotify)
                    case "toast" when e.Str("room") == "report" || e.Str("room") == "stop": break;   // 리포트 발표는 planEv 배너로 (토스트에 밀려 사라지지 않게)
                    case "planEv": if (e.Str("k") == "report") ReportBanner(e); break;
                    case "stopFill": StopBanner(e); break;
                    case "toast": Toast(e.Str("text"), e.Str("kind")); if (e.Str("app") == "gall") HoldFace("annoyed"); if (e.Str("room") == "flash") CoachCtx("news"); break;   // 첫 칸 시작 속보 → 속보 설명 카드
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
                            case "flex": HoldFace(ArtCatalog.FaceSprite(e.Num("amt") >= GameSim.LOVE_AMT ? "love" : "flex"), true); break;
                            case "crack": HoldFace("shocked", true); break;
                            case "ash": HoldFace("crying_comic", true); break;
                        }
                        break;
                    case "relic": { var a = D.AUGS.FirstOrDefault(x => x.id == e.Str("id")); if (a != null) { Toast($"유물 획득: {a.name}", "good", ArtCatalog.Relic(a.id)); HoldFace("smug"); } break; }
                    case "gacha": if (e["junk"] != null) Toast("꽝: " + e.Str("text"), "", ArtCatalog.Junk((int)e.Num("junk"))); break;
                    case "bought": SetFace("happy"); break;
                    case "menhera": SetFace(e.Str("face") ?? "menhera"); yield return KakaoBarrage((string[])e["msgs"]); Toast("카톡 " + ((string[])e["msgs"]).Length + "개 폭탄", "liq"); break;
                    case "impBuy": yield return ImpulseAlert(e); break;
                    case "sick": yield return SickAlert(e.Str("k")); break;
                    case "addictEv": if (e.Str("k") == "secret") Toast($"몰래 카지노 {G.sgnWon(e.Num("amt"))}", "liq"); break;
                    case "faint": Toast("기절!", "liq"); HoldFace("dizzy", true); break;
                    case "morning": yield return Morning(e); break;
                    case "settle": yield return SettleCard(e); break;   // v4 저녁 정산 카드 (GameController.Screens.cs)
                    case "night": { string nf = e.Str("cls") == "jackpot" ? "love" : e.Str("cls") == "loss" ? "pout" : e.Str("cls") == "liq" ? "panic" : null; if (nf != null) SetFace(nf); break; }   // 대사는 sim 이 집 대사로 이미 걸어 둠
                    case "opening": yield return Opening(); break;
                    case "unlock": CoachCtx("unlock"); break;   // 첫 해금 → 해금 · 주말 설명 카드
                    case "story": yield return PlayScene(e.Str("key")); break;
                    case "aff": Toast($"미래 호감 {(e.Num("d") > 0 ? "+" : "")}{e.Num("d"):0} → {e.Num("v"):0}", e.Num("d") > 0 ? "good" : "liq"); break;
                    case "watch": if (!G.v4 && !phoneOpen) TogglePhone(); break;   // v4 는 폰 대신 데스크가 뜸
                    case "ending":
                        if (e.Str("kind") == "clear" && !(G.v4 && e.Str("variant") == "lonely"))
                        {
                            yield return PlayScene("clear");
                            // 1부 · 복학 통장이 드러난 판: "우리 해냈다" 끝에 미래 한 줄 (등록함 = true · 못 함 = hollow)
                            string fv = e.Str("variant");
                            if (S.part <= 1 && G.fundOn && (fv == "true" || fv == "hollow")) yield return Say("m", null, G.T(fv == "true" ? "v4.clear.reg" : "v4.clear.noreg"), fv == "hollow" ? "tired" : null);
                        }
                        if (e.Str("kind") == "clear") JuiceConfetti(stage);   // 빚 다 갚음
                        RecordMeta();   // 엔딩·도전과제 기록 (판마다 한 번, GameController.Screens.cs)
                        break;
                    case "liveLiq": JuiceLiq(stage, SizeOf(stage).x / 2, SizeOf(stage).y * 0.42f); break;   // 실시간 청산
                    case "error": Debug.LogWarning("[sim] " + e.Str("msg")); break;
                }
            }
            HideDialogue();
            playing = false; FacePlayEnd();

            saveControls.SetEnabled(true);
            if (!evs.Any(e => e.t == "error")) SaveCheckpoint(false);
            RenderAll();
        }

        /// 장면 데이터의 규칙 자리표시자 → 이 판 값 (난이도별): {rate} 주 이자 % · {due} 이자 금액 · {cash} 시작 현금 · {debt} 시작 빚
        string FillRules(string text)
        {
            if (text == null || text.IndexOf('{') < 0 || G == null) return text;
            return text.Replace("{rate}", (G.rate() * 100).ToString("0.#")).Replace("{due}", G.won(G.interestDue())).Replace("{cash}", G.won(S.cash)).Replace("{debt}", G.won(G.debtStart()));
        }
        IEnumerator Say(string who, string name, string text, string face)
        {
            text = FillRules(text);
            dlg.style.display = DisplayStyle.Flex;
            dlgText.style.display = DisplayStyle.Flex; idleText.style.display = DisplayStyle.None; dlgHint.style.display = DisplayStyle.Flex;
            DlgSync();   // 대사 동안은 계획판 · 말풍선 대신 대사창 (같은 프레임이라 깜빡임 없음)
            dlgName.text = Ui.Clean(who == "m" ? "미래" : who == "me" ? "나" : who == "kim" ? "김사장" : who == "npc" ? name : "");
            dlgName.style.display = dlgName.text == "" ? DisplayStyle.None : DisplayStyle.Flex;
            dlgText.style.unityFontStyleAndWeight = who == "nar" ? FontStyle.Italic : FontStyle.Normal;
            dlgType.Start(Ui.Show(text));
            if (textSpeed >= 3 || sceneInstant) dlgType.Complete();   // 글자 속도 '즉시' · 읽은 장면 빨리 넘기기
            DlgPaint(true);
            UpdateDialogueHint();
            if (face != null) SetFace(face);
            SpeakerArt(who, name, face);
            yield return WaitClick(true);
        }
        IEnumerator WaitClick(bool dialogue = false)
        {
            if (autoSkipDialog)
            {
                if (dialogue) CompleteDialogueText();
                yield return null; yield break;
            }
            waitingForDialogue = dialogue;
            waiting = true; waitAny = true; clicked = false; waitFrame = Time.frameCount;
            while (!clicked) yield return null;
            waiting = false; waitAny = false; waitingForDialogue = false;
        }
        // ---------- 실시간 (GameSim.Realtime.cs) ----------
        int rtSpeed = 1; float rtAcc, rtPhoneT, rtSaveT;
        /// 고를 게 없는 화면(집·지도·장소·창구)에선 게임 시간이 흐름. 조용한 분은 HUD·차트만 다시 그리고, 무슨 일이 생기면(시간대 끝·청산·상폐) 이벤트 재생
        bool rtDirty, rtWasOpen;
        void RtUpdate()
        {
            if (G == null || !S.rt || playing || waiting || rtSpeed == 0 || settingsEl != null || mg != null || coach != null || modal.style.display == DisplayStyle.Flex || !PHONE_OK.Contains(S.pending?.t)) return;
            if (G.v4 && S.pending?.t != "watch") return;   // v4: 장 볼 때만 시간이 흐름
            // 타이머는 매 프레임 쌓음 (예전엔 시계가 1분 갈 때만 쌓여서 폰 글자가 8초에 한 번꼴로만 바뀜)
            float dt = Time.unscaledDeltaTime;
            rtPhoneT += dt; rtSaveT += dt;
            rtAcc += dt * (float)(G.v4 ? D.RULES.V4_WATCH_SPEED : D.RULES.RT_SPEED) * rtSpeed;
            int m = Mathf.Min(30, (int)rtAcc);
            if (m >= 1)
            {
                rtAcc -= m;
                var evs = G.Apply(new SimCommand("tick", "m", m));
                if (evs.Count > 0) { rtAcc = 0; LlmTick(); StartCoroutine(Play(evs)); return; }
                rtDirty = true;
                LiveChart();
            }
            bool held = Input.GetMouseButton(0) || Input.touchCount > 0;   // 누르고 있는 동안엔 다시 그리지 않음 (누름~뗌 사이에 버튼이 바뀌면 클릭이 사라짐)
            if (!held) stkDragging = false;                                 // 막대 끌던 중 다시 그려져서 뗌을 못 받아도 풀리게
            bool flip = G.stockOpen() != rtWasOpen;                         // 장 열림/닫힘이 바뀌면 바로 (매수 버튼)
            if (rtDirty && !held && !stkDragging && (rtPhoneT >= 0.3f || flip))
            {
                rtDirty = false; rtPhoneT = 0; rtWasOpen = G.stockOpen();
                RenderHud(G.HudSnapOf());
                if (DeskActive) RenderDesk();   // 장 보기: 데스크 시세 · 장 열림
                if (phoneOpen) RenderPhone();
                RenderMini();
            }
            if (rtSaveT >= 30f) { rtSaveT = 0; SaveCheckpoint(false); }
        }

        void Update()
        {
            if (dlgText == null) return;
            if (settingsEl != null) { if (Input.GetKeyDown(KeyCode.Escape)) CloseSettings(); return; }   // 설정 창 (GameController.Settings.cs)
            RtUpdate();
            if (CoachKeys()) return;
            if (statusCard != null && Input.GetKeyDown(KeyCode.Escape)) { CloseStatusCard(); return; }   // 상태 카드가 먼저 닫힘 (폰 Esc 보다)
            if (!waiting && mg == null && G != null && S.pending?.t != "start")
            {
                if (Input.GetKeyDown(KeyCode.P) || (phoneOpen && Input.GetKeyDown(KeyCode.Escape))) TogglePhone();
                else if (!playing && modal.style.display != DisplayStyle.Flex) PanelKeys();
            }
            FaceTick();
            if (waitingForDialogue)
            {
                if (dlgType.Tick(Time.unscaledDeltaTime)) DlgPaint(false);
                if (dlgType.Typing) KwGame.Audio.GameAudioManager.Play(KwGame.Audio.SoundCue.Blip);   // 타자음 (간격 BlipInterval)
                UpdateDialogueHint();
            }
            if (!waiting) return;
            if (Input.GetMouseButtonDown(0) || Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return)) RequestAdvance();
        }

        void RequestAdvance()
        {
            if (!waiting || Time.frameCount <= waitFrame || advanceFrame == Time.frameCount) return;
            advanceFrame = Time.frameCount;
            if (waitAny) GuardUi();   // 이 누름은 '넘기기'로 썼음 → 같은 누름 · 이어지는 연타가 방금 뜬 버튼에 닿지 않게 (GameController.Type.cs)
            if (waitingForDialogue && dlgType.Typing)
            {
                CompleteDialogueText();
                return;
            }
            clicked = true;
        }

        void CompleteDialogueText()
        {
            dlgType.Complete();
            DlgPaint(false);
            UpdateDialogueHint();
        }

        void UpdateDialogueHint()
        {
            dlgHint.text = dlgType.Typing ? "클릭 / Space : 즉시 표시" : "클릭 / Space ▶";
        }

        void HideDialogue()
        {
            dlgText.style.display = DisplayStyle.None; idleText.style.display = DisplayStyle.Flex; dlgHint.style.display = DisplayStyle.None;
            if (G != null) SetIdle();
            DlgSync();   // v4 집 · 데스크: 대사가 끝나면 대사창을 걷고 계획판으로
        }

        /// 오프닝: 처음 한 번은 전부, 2회차부터는 미래 한 줄 + "오프닝 다시 보기" (kw.v4.opening)
        const string OpeningPref = "kw.v4.opening";
        IEnumerator Opening()
        {
            int seen = 0;
            try { seen = PlayerPrefs.GetInt(OpeningPref, 0); } catch { }
            bool full = seen == 0 || autoSkipDialog || ShotMode.On;
            if (!full)
            {
                SetScene("room", "pout");
                yield return Say("m", null, $"또 시작이네. 빚 {G.man(G.debtStart())}, 7일마다 이자 {G.rate() * 100:0.#}%, {D.RULES.V4_DAYS}일 만기. 알지? …알바는 자기가 가는 거고.", "pout");
                HideDialogue();
                int pick = -1;
                modal.Clear(); modal.style.display = DisplayStyle.Flex;
                var card = Card(760);
                card.Add(Ui.Label("오프닝은 이미 봤어요", 32, Ui.Gold, true));
                var b0 = Ui.Button("바로 시작 (Space)", () => pick = 0, null, false, Ui.Accent); b0.style.marginTop = 16; card.Add(b0);
                card.Add(Ui.Button("오프닝 다시 보기", () => pick = 1));
                modal.Add(card);
                waiting = true; waitFrame = Time.frameCount;   // 고르는 동안 폰(P) 등 다른 입력 막음
                do { yield return null; if (Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return)) pick = 0; } while (pick < 0);
                waiting = false; clicked = false;
                modal.style.display = DisplayStyle.None; modal.Clear();
                full = pick == 1;
            }
            if (!full) yield break;
            yield return PlayScene("opening");
            if (!ShotMode.On) try { PlayerPrefs.SetInt(OpeningPref, 1); PlayerPrefs.Save(); } catch { }
        }

        IEnumerator PlayScene(string key)
        {
            var steps = D.J["SCENES"]?[key] as JArray;
            if (steps == null) yield break;
            sceneKey = key;
            sceneInstant = skipSeen && SeenScene(key);
            foreach (JObject st in steps)
            {
                if (st["say"] != null) yield return Say((string)st["say"], (string)st["name"], (string)st["text"], (string)st["face"]);
                else switch ((string)st["do"])
                {
                    case "scene": SetScene((string)st["bg"], (string)st["face"], (bool?)st["night"] == true); break;
                    case "face": SetFace((string)st["f"]); break;
                    case "kim": ShowKim((bool?)st["on"] == true); break;
                    case "hideDlg": HideDialogue(); break;
                    case "rules": if (!G.v4) yield return RulesCard(); if (key == "opening") ShowCg("opening_box"); break;   // 규칙 뒤 = 유물 상자 장면 (v4 는 규칙 카드 없이 첫 화면 튜토리얼로)
                    case "shake": Shake(stage, 18); break;
                    case "flash": Flashback((bool?)st["on"] == true); break;
                    case "card": HideDialogue(); yield return StoryCard((string)st["h"], FillRules((string)st["t"]), FillRules((string)st["sub"]), (string)st["chart"]); break;
                }
            }
            Flashback(false);
            sceneKey = null;
            sceneInstant = false;
            MarkSceneSeen(key);
            HideDialogue();
        }

        /// 아침 카드가 지난번에 본 해금 상태 (바뀐 날만 줄을 띄우려고). null / −1 = 아직 모름
        bool? mLoanSeen, mShortSeen;
        int mBuffSeen = -1;
        /// 만기 같이 엔딩 목표 (GameSim.V4.cs v4EndVariant: 만기 빚 ≤ 시작 빚 × V4_DUO_DEBT + 호감 ≥ V4_AFF_GOOD)
        double DuoDebt() => G.debtStart() * G.duoDebt();   // 난이도별 문턱
        bool DuoOk() => S.debt <= DuoDebt() && S.aff >= D.RULES.V4_AFF_GOOD;
        /// 주 목표(빚 0 = 클리어) 아래 한 단계 낮은 차선: 만기 때 못 갚아도 미래가 같이 가 주는 조건
        string DuoGoal() => $"못 갚아도: 만기에 빚 {Man(DuoDebt())} 이하 + 호감 {D.RULES.V4_AFF_GOOD}이면 미래가 같이 가 줌 (지금 빚 {Man(S.debt)})";
        /// 금액 표시: 1만 이상은 만 단위 ("3,000만원" · "18만원"), 1만 미만은 원 단위 그대로
        string Man(double v) => G.man(v) + "원";

        static string ArgValue(string name)
        {
            var a = Environment.GetCommandLineArgs();
            int i = Array.IndexOf(a, name);
            return i >= 0 && i + 1 < a.Length ? a[i + 1] : null;
        }
    }
}
