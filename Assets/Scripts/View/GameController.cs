using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Febucci.TextAnimatorForUnity;
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
        AnimatedLabel dlgText;
        TypingDelaysByCharacter dialogueTiming;
        AnimatorSettingsScriptable dialogueAnimation;
        bool playing, waiting, clicked; int waitFrame;
        bool waitingForDialogue;
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
                        if (e.Str("kind") == "clear" && !(G.v4 && e.Str("variant") == "lonely")) yield return PlayScene("clear");
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
            dlgText.ResumeAnimation();
            dlgText.Typewriter.ShowText(Ui.Clean(text));
            dlgText.Typewriter.StartShowingText(true);
            if (textSpeed >= 3 || sceneInstant) dlgText.Typewriter.SkipTypewriter();   // 글자 속도 '즉시' · 읽은 장면 빨리 넘기기
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
            waiting = true; clicked = false; waitFrame = Time.frameCount;
            while (!clicked) yield return null;
            waiting = false; waitingForDialogue = false;
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
                dlgText.Typewriter.UpdateTypewriter();
                if (dlgText.Typewriter.IsShowingText) KwGame.Audio.GameAudioManager.Play(KwGame.Audio.SoundCue.Blip);   // 타자음 (간격 BlipInterval)
                UpdateDialogueHint();
            }
            if (!waiting) return;
            if (Input.GetMouseButtonDown(0) || Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return)) RequestAdvance();
        }

        void RequestAdvance()
        {
            if (!waiting || Time.frameCount <= waitFrame || advanceFrame == Time.frameCount) return;
            advanceFrame = Time.frameCount;
            if (waitingForDialogue && dlgText.Typewriter.IsShowingText)
            {
                CompleteDialogueText();
                return;
            }
            clicked = true;
        }

        void CompleteDialogueText()
        {
            dlgText.Typewriter.SkipTypewriter();
            dlgText.SetVisibilityEntireText(true, false);
            UpdateDialogueHint();
        }

        void UpdateDialogueHint()
        {
            dlgHint.text = dlgText.Typewriter.IsShowingText ? "클릭 / Space : 즉시 표시" : "클릭 / Space ▶";
        }

        void HideDialogue()
        {
            dlgText.Typewriter.StopShowingText();
            dlgText.PauseAnimation();
            dlgText.style.display = DisplayStyle.None; idleText.style.display = DisplayStyle.Flex; dlgHint.style.display = DisplayStyle.None;
            if (G != null) SetIdle();
            DlgSync();   // v4 집 · 데스크: 대사가 끝나면 대사창을 걷고 계획판으로
        }

        void OnDestroy()
        {
            dlgText?.Typewriter?.StopShowingText();
            dlgText?.PauseAnimation();
            dlgText?.Typewriter?.Dispose();
            if (Application.isPlaying)
            {
                Destroy(dialogueTiming);
                Destroy(dialogueAnimation);
            }
            else
            {
                DestroyImmediate(dialogueTiming);
                DestroyImmediate(dialogueAnimation);
            }
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
                yield return Say("m", null, $"또 시작이네. 빚 {G.man(G.debtStart())}, 7일마다 이자 {G.rate() * 100:0.#}%, {D.RULES.V4_DAYS}일 만기. 알지? …알바 가자.", "pout");
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

        IEnumerator Morning(SimEvent e)
        {
            modal.Clear();
            modal.style.display = DisplayStyle.Flex;
            HoldFace("pajama");   // 밤잠 자고 일어난 아침
            var card = Card(900);
            bool first = false;
            if (e["v4"] is bool v4 && v4)
            {
                int ch = (int)e.Num("ch");
                card.Add(Ui.Label($"{(e.Num("part") > 1 ? "2부 · " : "")}{ch}장 {G.chapterName(ch)} · {(e.Num("month") - 1) * D.RULES.MONTH_DAYS + e.Num("day")}일째 아침", 40, Ui.Gold, true));
                bool wkd = e["wk"] is bool wk && wk;
                bool paid4 = e["paid"] is bool pd4 && pd4; double dd4 = e.Num("dd"), wday = e.Num("day");
                first = (e.Num("month") - 1) * D.RULES.MONTH_DAYS + wday <= 1;   // 첫날 = 짧은 브리핑 (어제 결산 없음)
                card.Add(Ui.Label($"원금 만기까지 {e.Num("left")}일" + (wkd ? " · 오늘은 주말 (국장 휴장)" : ""), 26, Ui.Accent));
                // 아침 브리핑: 매일 같은 줄 반복 X → 시간표·대출·레버리지·숏은 첫날 · 바뀐 날 · 손 닿을 때만. 부탁 · 이자 D-1 · 만기 목표는 늘
                if (first || wday == 1 || wday == D.RULES.V4_WEEKDAYS + 1)
                    card.Add(Ui.Label(wkd ? "오늘: 하루 종일 미래 · 생활 (코인만 열림)" : "오늘: 오전 · 오후 = 장 (국장 09:00~15:30) · 밤 = 미래 · 생활 (코인만)", 22, Ui.Text));
                bool loanNow = G.loanOk(), shortNow = G.shortOk();
                if (G.gateOn)
                {   // 주간 납부 관문: 납부 줄 (HUD 와 같은 글) · 증거금 상한 · 대출/숏 잠김 (잠긴 동안만)
                    double gd = G.gateDue(), gi = S.paidMonth == S.month ? 0 : G.interestDue();
                    bool lastWk = S.month >= D.RULES.V4_GATE_CAP.Length;
                    string gs = gd <= 0 ? (lastWk ? "이번 주 납부 끝" : G.T("v4.gate.hudOk", "cap", G.man(G.gateCap(S.month + 1))))
                        : G.T("v4.gate.hud", "d", G.man(gd), "i", G.man(gi), "p", G.man(G.gatePrincipal())) + " · " + (dd4 <= 0 ? "D-DAY (오늘 밤)" : $"D-{dd4}");
                    var gln = Ui.Label(gs, 26, gd <= 0 ? Ui.Good : dd4 <= 1 ? Ui.Bad : Ui.Gold, true); gln.style.whiteSpace = WhiteSpace.Normal; card.Add(gln);
                    if (S.missN > 0) card.Add(Ui.Label($"미납 {S.missN}/{D.RULES.V4_MISS_MAX} — 이번 주도 못 내면 원양어선", 22, Ui.Bad, true));
                    if (G.marginNext() is string mn) card.Add(Ui.Label("코인: " + mn, 22, Ui.Dim));
                    // 숏 = 주차가 차면 자동으로 · 대출 = 첫 납부 통과 뒤 (따로 열림)
                    if (!shortNow) card.Add(Ui.Label("숏: " + G.shortLockWhy(), 22, Ui.Dim));
                    else if (mShortSeen == false) card.Add(Ui.Label("숏 · 곱버스: 새로 열림!", 22, Ui.Good, true));
                    if (!loanNow) card.Add(Ui.Label("대출: " + G.T("v4.gate.loanNext"), 22, Ui.Dim));
                    else if (mLoanSeen == false) card.Add(Ui.Label("대출: 새로 열림!", 22, Ui.Good, true));
                }
                else
                {
                    if (G.creditNext() is string cn) { if (first || !paid4 && dd4 <= 1) card.Add(Ui.Label("대출: " + cn, 22, Ui.Gold)); }
                    else if (mLoanSeen == false) card.Add(Ui.Label("대출: 새로 열림!", 22, Ui.Good, true));
                    if (mShortSeen == false && shortNow) card.Add(Ui.Label("숏: 열림", 22, Ui.Dim));
                }
                mLoanSeen = loanNow; mShortSeen = shortNow;
                // 호감 버프: 켜진 것 + 구간 설명 (첫날 · 단계가 바뀐 날만)
                var bfs = G.buffs(); int bt = G.buffTier();
                if (bfs.Count > 0) card.Add(Ui.Label("호감 버프: " + string.Join(" · ", bfs), 22, new Color(1f, 0.6f, 0.75f), true));
                if (first || bt != mBuffSeen) { var bh = Ui.Label(G.T("v4.buff.help"), 20, Ui.Dim); bh.style.whiteSpace = WhiteSpace.Normal; card.Add(bh); }
                mBuffSeen = bt;
                if (G.promNow() is GameSim.Prom pm) { card.Add(Ui.Label("미래 부탁: " + pm.hud, 22, Ui.Accent)); if (!first) CoachCtx("mirai"); }   // 둘째 날부터 첫 부탁 → 미래 설명 카드
                if (wkd) CoachCtx("unlock");   // 첫 주말 아침 (첫 해금이 먼저면 그때)
                if (G.gateOn) { }   // 납부 줄은 위에서
                else if (!paid4 && dd4 <= 1) card.Add(Ui.Label($"이자일 {(dd4 <= 0 ? "D-DAY (오늘 밤)" : "D-1 (내일 밤)")} · 이자 {Man(e.Num("due"))}", 26, Ui.Bad, true));
                else if (first) card.Add(Ui.Label($"이자일까지 D-{dd4} · 이자 {Man(e.Num("due"))}", 22, Ui.Dim));
                card.Add(Ui.Label("목표: 빚 0원 = 클리어", 24, Ui.Gold, true));
                var gl = Ui.Label(DuoGoal(), 20, DuoOk() ? Ui.Good : Ui.Dim); gl.style.whiteSpace = WhiteSpace.Normal; card.Add(gl);
            }
            else
            {
                card.Add(Ui.Label($"{e.Num("month")}개월차 {e.Num("day")}일 아침", 40, Ui.Gold, true));
                card.Add(Ui.Label(e["paid"] is bool p && p ? "이번 달 이자 냄" : $"이자일까지 D-{e.Num("dd")} · 이자 {Man(e.Num("due"))}", 26, Ui.Dim));
            }
            var Y = e["Y"] as List<Dictionary<string, object>>;
            if (Y != null && Y.Count > 0 && !(G.v4 && first))
            {
                card.Add(Ui.Label("어제 결산", 28, Ui.Text, true));
                // v4: 큰 것 3줄 + 합계 (예전엔 8줄까지)
                var top = G.v4 ? Y.OrderByDescending(y => Math.Abs(Convert.ToDouble(y["amt"]))).Take(3).ToList() : Y.Take(8).ToList();
                foreach (var y in top) card.Add(Ui.Label($"· {y["label"]}  {G.sgnMan(Convert.ToDouble(y["amt"]))}", 22, UpDn(Convert.ToDouble(y["amt"]))));   // 돈 손익 = 폰과 같은 색 (이익 빨강 · 손실 파랑)
                if (Y.Count > top.Count) card.Add(Ui.Label($"· 그 밖 {Y.Count - top.Count}건", 20, Ui.Dim));
                card.Add(Ui.Label($"합계 {G.sgnMan(e.Num("net"))} ({e.Str("netConv")})", 24, e.Num("net") == 0 ? Ui.Text : UpDn(e.Num("net")), true));
            }
            if (!string.IsNullOrEmpty(e.Str("ev")) && !(G.v4 && first)) card.Add(Ui.Label("오늘의 사건: " + e.Str("ev"), 24, Ui.Gold));
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
