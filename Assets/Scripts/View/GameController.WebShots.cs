using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using KwGame.Sim;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.View
{
    // 웹 캡처 모드 (주소에 ?kwShots=1 · ShotMode.cs): 게임 화면을 차례로 띄우고 콘솔에 "[shot] 이름" → 바깥 드라이버가 그 순간 페이지를 찍음.
    // 화면은 진짜 게임 경로(Send → 이벤트 재생 → RenderAll)로 가거나, 상태(pending · 화면 필드)를 직접 놓고 화면 코드가 그리게 함.
    // 단계마다 따로 돌려서(WRun) 한 단계가 예외 · 시간 초과로 죽어도 "[shot] skip …" 을 남기고 다음 단계로. 끝에 "[shot] done".
    public partial class GameController
    {
        const int WebShotSeed = 424242;
        string Pt => G?.S?.pending?.t ?? "null";

        IEnumerator WebShots()
        {
            ShotMode.Begin();
            autoSkipDialog = true;   // 대사 타자 · 클릭 대기 건너뜀 (카드를 찍을 때만 잠깐 끔)
            Ui.FxOff = false; textSpeed = 3; ApplyTextSpeed(); rtSpeed = 1;   // 메모리에서만 (설정 저장 안 함)
            NewGame(WebShotSeed, "normal");
            yield return new WaitForSecondsRealtime(1f);
            var steps = new List<(string name, Func<IEnumerator> body, float limit)>
            {
                ("opening", new Func<IEnumerator>(WsOpening), 45f),
                ("first_day", new Func<IEnumerator>(WsFirstDay), 30f),
                ("watch", new Func<IEnumerator>(WsWatch), 60f),
                ("work", new Func<IEnumerator>(WsWork), 70f),
                ("night", new Func<IEnumerator>(WsNight), 70f),
                ("payday", new Func<IEnumerator>(WsPayday), 50f),
                ("week2", new Func<IEnumerator>(WsWeek2), 30f),
                ("endings", new Func<IEnumerator>(WsEndings), 90f),
                ("faces", new Func<IEnumerator>(WsFaces), 15f),
            };
            foreach (var st in steps)
            {
                if (ShotMode.TimeUp) { ShotMode.Log("[shot] skip " + st.name + ": 전체 제한 시간 초과"); continue; }
                yield return WRun(st.name, st.body(), st.limit);
                WTidy();
                yield return WIdle(5f);
            }
            ShotMode.Log("[shot] done");
        }

        // ---------- 실행 도우미 ----------

        /// 한 단계를 예외 · 시간 초과로부터 감싸 돌림. 안쪽 IEnumerator(yield return 다른 코루틴)는 펼쳐서 직접 MoveNext → 어디서 터져도 여기서 잡힘
        IEnumerator WRun(string step, IEnumerator body, float limit)
        {
            var stack = new Stack<IEnumerator>(); stack.Push(body);
            float t0 = Time.realtimeSinceStartup;
            while (stack.Count > 0)
            {
                if (ShotMode.TimeUp) { ShotMode.Log("[shot] skip " + step + ": 전체 제한 시간 초과"); yield break; }
                if (Time.realtimeSinceStartup - t0 > limit) { ShotMode.Log("[shot] skip " + step + ": 단계 시간 초과 (" + limit.ToString("0") + "초)"); yield break; }
                var top = stack.Peek(); bool more = false, failed = false; object cur = null;
                try { more = top.MoveNext(); if (more) cur = top.Current; }
                catch (Exception ex) { failed = true; ShotMode.Log("[shot] skip " + step + ": 예외 " + ex.GetType().Name + ": " + ex.Message); Debug.LogException(ex); }
                if (failed) yield break;
                if (!more) { stack.Pop(); continue; }
                if (cur is IEnumerator sub) { stack.Push(sub); continue; }
                yield return cur;
            }
        }

        /// 단계 사이 정리: 끈 자동 넘김 복구 · 클릭 대기 풀기 · 떠 있는 창 걷기
        void WTidy()
        {
            autoSkipDialog = true;
            if (waiting) clicked = true;
            if (settingsEl != null) { settingsEl.RemoveFromHierarchy(); settingsEl = null; }
            if (coach != null) CoachClose();
            CloseHudTip();
            if (!playing && !waiting && modal != null) modal.style.display = DisplayStyle.None;
        }

        IEnumerator WIdle(float max = 15f)
        {
            float t0 = Time.realtimeSinceStartup;
            while (playing && Time.realtimeSinceStartup - t0 < max) yield return null;
            yield return null; yield return null;
        }
        IEnumerator WWait(Func<bool> cond, float max)
        {
            float t0 = Time.realtimeSinceStartup;
            while (!cond() && Time.realtimeSinceStartup - t0 < max) yield return null;
        }
        /// 이벤트 재생이 끝나길 기다렸다가 명령 → 재생 끝까지
        IEnumerator WSend(string t, params object[] kv)
        {
            yield return WIdle();
            Send(t, kv);
            yield return WIdle();
        }
        /// 대사 클릭을 대신 눌러 가며 조건이 맞을 때까지 (autoSkipDialog 를 끈 동안)
        IEnumerator WClickUntil(Func<bool> cond, float max)
        {
            float t0 = Time.realtimeSinceStartup;
            while (!cond() && Time.realtimeSinceStartup - t0 < max) { RequestAdvance(); yield return null; yield return null; }
            yield return new WaitForSecondsRealtime(0.2f);
        }
        IEnumerator WShot(string name, float settle = 0.2f) => ShotMode.Shot(name, settle);
        /// 지금 화면이 기대한 것인가: 아니면 "[shot] skip 이름: 이유" 를 남기고 false
        bool WWant(bool ok, string name, string why) { if (!ok) ShotMode.Skip(name, why); return ok; }

        /// 모달 카드(아침 · 정산)를 클릭 대기 상태로 띄워 찍고 넘김
        IEnumerator WCard(IEnumerator card, string name)
        {
            yield return WIdle();
            autoSkipDialog = false;
            StartCoroutine(card);
            yield return WWait(() => waiting, 4f);
            if (WWant(waiting && modal.style.display == DisplayStyle.Flex, name, "카드가 안 뜸")) yield return WShot(name, 0.2f);
            autoSkipDialog = true;
            if (waiting) clicked = true;
            yield return null; yield return null;
        }

        /// 고를 것들을 무난한 쪽으로 넘기며 stop 중 하나가 될 때까지 (예전 데모 ToHome 의 v4 판)
        IEnumerator WResolve(params string[] stop)
        {
            int nul = 0;
            for (int g = 0; g < 40; g++)
            {
                yield return WIdle();
                var P = S.pending;
                // debug 로 띄운 멘헤라는 답장 뒤에 이어질 흐름이 없어 대기 상태가 비어 버림 → 캡처용으로 집에 돌려놓음 (실제 게임에선 칸 끝 흐름이 이어 감)
                if (P == null) { if (++nul >= 8) { S.pending = new Pending("home"); RenderAll(); nul = 0; } else yield return null; continue; }
                if (stop.Contains(P.t)) yield break;
                switch (P.t)
                {
                    case "start": Send("start"); break;
                    case "relic": Send("pickRelic", "i", 0); break;
                    case "menhera": case "impulse": Send("reply", "i", Math.Max(0, P.opts.FindIndex(o => o.ok))); break;
                    case "event": Send("evPick", "k", (P.opts.FirstOrDefault(o => !o.dis) ?? P.opts[0]).k); break;
                    case "tempt": Send("tempt", "k", "no"); break;
                    case "payday":
                        {
                            var o = P.opts.FirstOrDefault(x => !x.dis && (x.k == "pay" || x.k == "gatePay")) ?? P.opts.FirstOrDefault(x => !x.dis);
                            if (o == null) yield break;
                            Send("payday", "k", o.k);
                            break;
                        }
                    case "loc": Send("leave"); break;
                    case "map": Send("goTo", "loc", "home"); break;
                    case "encounter": Send("encounter", "ask", false); break;
                    case "watch": Send("watchEnd"); break;
                    case "loan": Send("loanDone"); break;
                    case "repay": Send("repay", "amt", 0); break;
                    case "lotto": Send("lottoDone"); break;
                    case "casino": Send("casinoLeave"); break;
                    case "work": if (P.setup == null) Send("workBack"); else Send("mgResult", "score", 0.6); break;
                    default: yield break;
                }
            }
        }
        IEnumerator WToHome() => WResolve("home", "ending");

        /// 집 → 지도 → 장소 (길에서 말 거는 사람은 무시)
        IEnumerator WGoTo(string loc)
        {
            yield return WToHome();
            if (Pt != "home") yield break;
            yield return WSend("map");
            if (Pt != "map") yield break;
            yield return WSend("goTo", "loc", loc);
            if (Pt == "encounter") yield return WSend("encounter", "ask", false);
        }
        bool AtLoc(string key) => Pt == "loc" && S.pending.key == key;
        bool MgHas(string text) => mg != null && mg.Query<Label>().ToList().Any(l => l.text == text);
        string OpenCoin() => G.tkOpen("BTK") ? "BTK" : D.TKList.Where(x => x.IsCoin && G.tkOpen(x.id)).Select(x => x.id).FirstOrDefault();

        /// 아침 카드 (sim morning 이벤트와 같은 필드, 지금 상태로). 첫날 아침은 sim 이 안 보내서 직접
        SimEvent WMorningEvent() => new SimEvent
        {
            t = "morning",
            d = new Dictionary<string, object>
            {
                ["v4"] = true, ["ch"] = G.chapter(), ["part"] = S.part, ["month"] = S.month, ["day"] = S.day, ["left"] = G.daysLeft(), ["wk"] = G.weekend(),
                ["paid"] = S.paidMonth == S.month, ["dd"] = Math.Max(0, D.RULES.MONTH_DAYS - S.day), ["due"] = G.gateDue(),
                ["Y"] = new List<Dictionary<string, object>>(), ["net"] = 0.0, ["netConv"] = "", ["ev"] = "", ["mline"] = G.T("mline.calm"),
            },
        };

        /// 저녁 정산 카드: 일당 · 매매 · 그 밖 · 현금 · 납부 줄이 다 보이게 (값이 0 인 줄은 화면에서 빠지므로 없으면 채움)
        SimEvent WSettleEvent()
        {
            double wage = S.lastPay > 0 ? S.lastPay : 180000, pnl = G.dayPnl();
            if (Math.Abs(pnl) < 1) pnl = 230000;
            double other = -100000, net = wage + pnl + other, cash0 = S.dayCash0 >= 0 ? S.dayCash0 : S.cash - net, due = G.gateDue();
            return new SimEvent
            {
                t = "settle",
                d = new Dictionary<string, object>
                {
                    ["cls"] = pnl > 0 ? "jackpot" : "loss", ["wage"] = wage, ["pnl"] = pnl, ["other"] = other, ["liq"] = 0, ["unreal"] = G.unreal(),
                    ["hit"] = 1, ["miss"] = 1, ["net"] = net, ["cash0"] = cash0, ["cash"] = S.cash, ["move"] = S.cash - cash0 - net,
                    ["due"] = due, ["gap"] = Math.Max(0, due - S.cash), ["dd"] = G.gateDays(),
                },
            };
        }

        /// 엔딩용 새 판 (화면 재생 없이 시작 → 유물 하나 → 첫날 집)
        void WFresh()
        {
            G = GameSim.Create(D, WebShotSeed + 1, new GameSim.Opts { rt = true, diff = "normal" });
            G.Hud = true; metaRunStamp = null; lastUnlock = null; phoneOpen = false;
            G.Apply(new SimCommand("start"));
            G.Apply(new SimCommand("pickRelic", "i", 0));
            MinigameClose();
            RenderAll();
        }

        // ---------- 단계 ----------

        /// 오프닝: 첫 자막 카드 · 미래 대사 · 김사장 방문 CG · 유물 상자 CG → 유물 고르기
        IEnumerator WsOpening()
        {
            if (!WWant(Pt == "start", "opening_card", "시작 화면이 아님: " + Pt)) yield break;
            autoSkipDialog = false;
            Send("start");
            yield return WWait(() => storyNow != null, 6f);
            yield return new WaitForSecondsRealtime(1.9f);   // 차트가 다 그려질 때까지 (StoryCard 1.6초)
            if (WWant(storyNow != null, "opening_card", "자막 카드가 안 뜸")) yield return WShot("opening_card", 0);
            yield return WClickUntil(() => storyNow == null && waitingForDialogue && dlgName.text == "미래" && flashEl.style.display == DisplayStyle.None, 15f);
            if (WWant(waitingForDialogue && dlgName.text == "미래", "opening_dialogue", "미래 대사를 못 찾음")) yield return WShot("opening_dialogue");
            yield return WClickUntil(() => cgKey == "opening_visit" && waitingForDialogue, 15f);
            if (WWant(cgKey == "opening_visit", "opening_cg_visit", "김사장 방문 CG 가 안 뜸")) yield return WShot("opening_cg_visit");
            yield return WClickUntil(() => cgKey == "opening_box" && waitingForDialogue, 15f);
            if (WWant(cgKey == "opening_box", "opening_cg_box", "유물 상자 CG 가 안 뜸")) yield return WShot("opening_cg_box");
            autoSkipDialog = true;
            if (waiting) clicked = true;
            yield return WIdle();
            if (WWant(Pt == "relic", "relic_pick", "유물 고르기가 아님: " + Pt)) yield return WShot("relic_pick");
        }

        /// 첫날: 아침 카드 · 집(낮) · 도움말 카드 · 유물 설명 카드 · 설정 창 · 대출(잠김)
        IEnumerator WsFirstDay()
        {
            yield return WToHome();
            if (!WWant(Pt == "home", "morning_first", "집이 아님: " + Pt)) yield break;
            yield return WCard(Morning(WMorningEvent()), "morning_first");
            RenderAll();
            yield return WShot("home_day", 0.3f);

            CoachStart();   // 퀵메뉴 "도움말" 과 같은 카드 (기록 안 씀)
            yield return new WaitForSecondsRealtime(0.15f);
            if (coach != null && coachCards.Count > 1) { coachStep = 1; CoachDraw(); }   // 2장 = 상태 카드 짚기
            if (WWant(coach != null, "coach_card", "도움말 카드가 안 뜸")) yield return WShot("coach_card", 0.25f);
            CoachClose();

            var tipSrc = hudBar.Query(className: TipSrcClass).ToList().LastOrDefault();   // 버프 칩 뒤에 유물 아이콘이 옴 → 마지막 = 유물
            string rid = S.augs.Take(9).LastOrDefault(); var aug = D.AUGS.FirstOrDefault(a => a.id == rid);
            if (WWant(tipSrc != null && aug != null, "hud_relic_tip", "HUD 에 유물 아이콘이 없음"))
            {
                OpenHudTip(tipSrc, "relic:" + rid, aug.name, aug.d);
                yield return WShot("hud_relic_tip");
                CloseHudTip();
            }

            if (settingsEl == null) OpenSettings();
            if (WWant(settingsEl != null, "settings_game", "설정 창이 안 뜸")) yield return WShot("settings_game");
            if (settingsEl != null) { settingsEl.RemoveFromHierarchy(); settingsEl = null; }   // CloseSettings 는 PlayerPrefs.Save 를 불러서 직접 걷음

            yield return WSend("loanOpen");
            if (WWant(Pt == "loan", "loan_locked", "대출 창이 아님: " + Pt)) yield return WShot("loan_locked");
            yield return WToHome();
        }

        /// 장 보기: 폰 닫힘 · 시세 · 리포트 칩 · 차트·주문(코인 접힘/펼침 · 주식) · 위험 주문 확인 · 내 계좌 · 카톡 · 주갤 · 뉴스 · 정보 수첩 · 배너 · 현금 ±
        IEnumerator WsWatch()
        {
            yield return WToHome();
            if (!WWant(Pt == "home" && !G.isEve(), "watch", "낮 집이 아님: " + Pt)) yield break;
            yield return WSend("watch");
            if (!WWant(Pt == "watch", "watch", "장 보기가 아님: " + Pt)) yield break;
            int open = D.RULES.RT_STOCK[0] + 30;   // 09:30 = 장 열림
            if (S.min < open) yield return WSend("tick", "m", Math.Min(120, open - S.min));
            phoneOpen = false; RenderAll();
            if (Pt == "watch") yield return WShot("watch");

            string stk = D.TKList.Where(x => x.IsStock && !x.inv && G.tkOpen(x.id)).Select(x => x.id).FirstOrDefault();
            string coin = OpenCoin();
            phoneOpen = true; phoneTab = "stock"; stkTab = "mkt"; stkMsg = ""; RenderAll();
            yield return WShot("phone_market");

            yield return WIdle();
            onSent = ReportMsg; Send("report", "paid", false);   // 무료 리포트
            yield return WIdle();
            stkTab = "mkt"; RenderAll();
            int today = G.Tnow() / D.RULES.SLOTS;
            if (WWant(S.tips.Any(x => x.T0 / D.RULES.SLOTS == today), "phone_report", "오늘 받은 리포트가 없음")) yield return WShot("phone_report");

            if (stk != null && Pt == "watch") yield return WSend("buy", "tk", stk, "amt", 300000, "where", "app");
            if (coin != null && Pt == "watch") yield return WSend("open", "tk", coin, "dir", 1, "lev", 10, "amt", 200000, "sl", 0.5, "tp", 1.0);   // 예약 손절·익절 붙임

            if (WWant(coin != null, "chart_coin", "열린 코인이 없음"))
            {
                phoneOpen = true; phoneTab = "stock"; stkTab = "detail"; stkSel = coin; stkMore = false; stkAmt = null; stkLev = 10; stkDir = 1; stkMsg = ""; RenderAll();
                yield return WShot("chart_coin");
                stkMore = true; RenderAll();
                yield return WShot("chart_coin_more");
                stkMore = false;
            }
            if (WWant(stk != null, "chart_stock", "열린 주식이 없음"))
            {
                phoneOpen = true; phoneTab = "stock"; stkTab = "detail"; stkSel = stk; stkAmt = null; RenderAll();
                yield return WShot("chart_stock");
            }
            if (WWant(coin != null, "order_confirm", "열린 코인이 없음"))
            {   // 위험 주문(25배 이상) 첫 누름 = "한 번 더 누르면 진입" (OrderBar 의 확인 키와 같은 모양)
                stkSel = coin; stkTab = "detail"; stkLev = Math.Min(50, D.TK[coin].maxLev); stkDir = 1; stkAmt = null; RenderAll();
                ordArm = Time.realtimeSinceStartup; ordArmKey = $"open|{coin}|{stkDir}|{stkLev}|{stkAmt ?? 0}"; RenderAll();
                yield return WShot("order_confirm", 0.1f);
                stkLev = 10; stkAmt = null; ordArm = -10; ordArmKey = null;
            }
            phoneOpen = true; phoneTab = "stock"; stkTab = "acct"; RenderAll();
            yield return WShot("account");

            phoneTab = "kakao"; kkRoom = "m";
            yield return WSend("read", "what", "kakao", "room", "m");
            RenderAll();
            yield return WShot("kakao", 0.3f);
            phoneTab = "gall"; gallTab = "all"; gallOpen = 0;
            yield return WSend("read", "what", "gall");
            RenderAll();
            if (WWant(S.posts.Count > 0, "gall_list", "주갤 글이 없음")) yield return WShot("gall_list");
            var post = S.posts.AsEnumerable().Reverse().Take(5).FirstOrDefault(p => !string.IsNullOrEmpty(p.body)) ?? S.posts.LastOrDefault();
            if (WWant(post != null, "gall_post", "주갤 글이 없음"))
            {
                gallOpen = post.id; RenderAll();
                yield return WShot("gall_post");
                gallOpen = 0;
            }
            phoneTab = "news";
            yield return WSend("read", "what", "news");
            RenderAll();
            yield return WShot("news");
            phoneTab = "tips"; RenderAll();
            yield return WShot("tips");

            // 배너 (화면 코드 그대로, 값만 넣어서): 발표 적중 · 보유 중 → 예약 익절 체결
            phoneOpen = false; phoneTab = "stock"; stkTab = "mkt"; RenderAll();
            var an = G.analysts().FirstOrDefault();
            ReportBanner(new SimEvent { t = "planEv", d = new Dictionary<string, object> { ["k"] = "report", ["up"] = true, ["ok"] = true, ["hold"] = true, ["tk"] = stk ?? coin, ["who"] = an?.name ?? "" } });
            yield return WShot("banner_report", 0.35f);
            StopBanner(new SimEvent { t = "stopFill", d = new Dictionary<string, object> { ["tp"] = true, ["pnl"] = 184000.0, ["n"] = coin != null ? D.TK[coin].name : "" } });
            yield return WShot("banner_stop", 0.35f);

            // 현금 ± 숫자: 주식 절반 매도 → HUD 현금 옆에 떠오름 (0.8초짜리라 바로 찍음)
            if (WWant(stk != null && S.hold.Has(stk) && G.stockTradeOk(), "cash_float", "팔 주식이 없거나 장이 아님"))
            {
                yield return WIdle();
                Send("sell", "tk", stk, "frac", 0.5, "where", "app");
                yield return WIdle(3f);
                yield return WShot("cash_float", 0.1f);
            }
            if (Pt == "watch") yield return WSend("watchEnd");
            yield return WToHome();
        }

        /// 외출 · 알바: 지도 · 말 거는 사람 · 일하기 목록 · 알바 설명 · 미니게임 4종 · 구석 손익 · 몰래 폰 보기 · 알바 중 청산 · 그림 안내 · 결과 카드
        IEnumerator WsWork()
        {
            yield return WToHome();
            if (!WWant(Pt == "home", "map", "집이 아님: " + Pt)) yield break;
            yield return WSend("map");
            if (!WWant(Pt == "map", "map", "지도가 아님: " + Pt)) yield break;
            yield return WShot("map");

            // 말 거는 사람: 몇 번 나가 보고, 끝내 안 나오면 같은 모양으로 직접 띄움
            bool enc = false;
            for (int i = 0; i < 3; i++)
            {
                if (Pt != "map") break;
                yield return WSend("goTo", "loc", "work");
                if (Pt == "encounter") { enc = true; break; }
                yield return WToHome();
                if (Pt == "home") yield return WSend("map");
            }
            if (!enc && Pt == "map")
            {
                var src = D.SRCList.FirstOrDefault(x => x.tier == "walk" && !x.bar);
                if (src != null)
                {
                    S.pending = new Pending("encounter")
                    {
                        id = src.id, loc = "work", opts = new List<Opt> {
                            new Opt { k = "enc-ask", l = src.cost != 0 ? G.T("enc.askPaid", "c", G.man(src.cost)) : G.T("enc.askFree") },
                            new Opt { k = "enc-ignore", l = G.T("enc.ignore"), sub = G.T("enc.ignoreSub") } },
                    };
                    RenderAll();
                }
            }
            if (WWant(Pt == "encounter", "encounter", "말 거는 사람이 안 나옴: " + Pt)) yield return WShot("encounter");
            if (Pt == "encounter") yield return WSend("encounter", "ask", false);
            if (Pt == "home") yield return WSend("map");
            if (Pt == "map") yield return WSend("goTo", "loc", "work");
            if (Pt == "encounter") yield return WSend("encounter", "ask", false);
            if (!WWant(AtLoc("work"), "work_list", "일하기 목록이 아님: " + Pt)) yield break;

            // 포지션을 든 채 알바 (구석 손익 · 몰래 폰 보기 · 알바 중 청산용)
            string coin = OpenCoin();
            if (coin != null)
            {
                yield return WSend("open", "tk", coin, "dir", 1, "lev", 10, "amt", 150000);
                yield return WSend("open", "tk", coin, "dir", 1, "lev", 25, "amt", 100000);
            }
            RenderAll();
            yield return WShot("work_list");
            yield return WSend("act", "k", "l-cafe");
            if (WWant(Pt == "work" && S.pending.setup == null, "work_brief", "알바 설명 카드가 아님: " + Pt)) yield return WShot("work_brief");

            // 미니게임 4종: 판을 그린 첫 순간 (자동 넘김이라 점수는 안 보냄 → 칸을 안 씀)
            foreach (var k in new[] { "cafe", "store", "ware", "mart" })
            {
                if (!D.JOBS.ContainsKey(k)) { ShotMode.Skip("mg_" + k, "알바 데이터 없음"); continue; }
                S.pending = new Pending("work") { key = k, loc = "work" }; RenderAll();
                yield return WSend("mgSetup");
                yield return new WaitForSecondsRealtime(0.3f);
                if (WWant(mg != null && Pt == "work", "mg_" + k, "미니게임 판이 안 뜸")) yield return WShot("mg_" + k);
            }
            if (WWant(mg != null && S.cps.Count > 0 && G.peekOk(), "mg_positions", "판 · 포지션 · 폰 보기 조건이 안 맞음"))
            {
                MgLiveOpen();
                yield return WShot("mg_positions");
                MgPeekOpen();
                if (WWant(mgPeekBox != null, "mg_peek", "몰래 폰 보기 창이 안 뜸")) yield return WShot("mg_peek");
                MgPeekClose();
                // 알바 중 청산: 배율 가장 높은 포지션이 청산된 것처럼 빼고 화면 연출만 (MgLiq = 터짐 · 번쩍 · 구석 붉은 줄)
                var before = S.cps.ToList(); var gone = before.OrderByDescending(c => c.lev).First();
                S.cps.Remove(gone);
                MgLiq(new List<SimEvent>(), before);
                yield return WShot("mg_liq", 0.12f);
            }

            // 실제로 한 판 (편의점): 그림 안내 카드 → 3·2·1 → 게임 (입력 없이 시간 끝) → 결과 카드 → 점수 보냄 (칸 씀 → 저녁)
            if (D.JOBS.ContainsKey("store"))
            {
                S.pending = new Pending("work") { key = "store", loc = "work" }; RenderAll();
                mgHowSeen.Add("store");   // 본 적 있는 게임 = 그림 안내가 2.5초 뒤 저절로 넘어감
                yield return WIdle();
                autoSkipDialog = false;
                Send("mgSetup");
                yield return WWait(() => mg != null, 3f);
                autoSkipDialog = true;   // MinigameRun 은 시작할 때만 봄
                yield return new WaitForSecondsRealtime(0.9f);
                if (WWant(MgHas("이렇게 해요"), "mg_howto", "그림 안내 카드가 안 뜸")) yield return WShot("mg_howto", 0);
                yield return WWait(() => MgHas("알바 끝"), 25f);
                if (WWant(MgHas("알바 끝"), "mg_result", "결과 카드가 안 뜸")) yield return WShot("mg_result", 0.4f);
                yield return WWait(() => mg == null, 8f);
            }
            yield return WIdle();
            yield return WToHome();
        }

        /// 밤: 정산 카드 · 밤의 집 · 돌발 이벤트 · 멘헤라 · 돌발 풀매수 알림 · 유혹 · 빚 갚기 · 청산당한 밤 · 복권소 · 한강공원 · 카지노 한 판
        IEnumerator WsNight()
        {
            yield return WToHome();
            if (!WWant(Pt == "home", "settle_card", "집이 아님: " + Pt)) yield break;
            yield return WCard(SettleCard(WSettleEvent()), "settle_card");
            RenderAll();
            if (WWant(G.isEve(), "home_night", "밤이 아님 (칸 " + S.slot + ")")) yield return WShot("home_night", 0.3f);

            yield return WSend("debug", "k", "event");
            if (WWant(Pt == "event", "event_choice", "돌발 이벤트가 안 뜸: " + Pt)) yield return WShot("event_choice");
            yield return WToHome();

            yield return WSend("debug", "k", "menhera");
            if (WWant(Pt == "menhera", "menhera", "멘헤라가 안 뜸: " + Pt)) yield return WShot("menhera", 0.6f);
            yield return WToHome();

            // 돌발 풀매수 체결 알림 (화면 코드 그대로, 값만 지금 상태로)
            string coin = OpenCoin();
            if (WWant(coin != null && Pt == "home", "impulse_alert", "열린 코인이 없거나 집이 아님"))
            {
                double amt = Math.Round(S.cash * 0.9 / 1000) * 1000;
                var fe = new SimEvent { t = "impBuy", d = new Dictionary<string, object> { ["tk"] = coin, ["amt"] = amt, ["cash0"] = S.cash, ["cash1"] = S.cash - amt, ["coin"] = true } };
                autoSkipDialog = false;   // 알림이 뜬 채로 머물게 (6초 대기 쪽)
                var co = StartCoroutine(ImpulseAlert(fe));
                var dim = stage.childCount > 0 ? stage[stage.childCount - 1] : null;   // ImpulseAlert 가 막 붙인 어둠 판
                yield return new WaitForSecondsRealtime(0.35f);
                autoSkipDialog = true;
                yield return WShot("impulse_alert", 0.1f);
                if (co != null) StopCoroutine(co);
                dim?.RemoveFromHierarchy();
                RenderAll();
            }

            // 도박 유혹 (sim temptStart 와 같은 선택지 · 같은 문구)
            if (WWant(Pt == "home", "tempt", "집이 아님: " + Pt))
            {
                double stake = Math.Max(10000, Math.Floor(S.cash * 0.5 / 10000) * 10000);
                S.pending = new Pending("tempt")
                {
                    opts = new List<Opt> {
                        new Opt { k = "go", l = G.T("add.temptGo"), sub = G.T("add.temptGoSub", "a", G.won(stake)), dis = S.cash < 10000 },
                        new Opt { k = "no", l = G.T("add.temptNo"), sub = G.T("v4.add.temptNoSub") } },
                };
                RenderAll(); SetFace("menhera");
                yield return WShot("tempt");
                yield return WSend("tempt", "k", "no");
                yield return WToHome();
            }

            yield return WSend("repayOpen");
            if (WWant(Pt == "repay", "repay", "빚 갚기 창이 아님: " + Pt)) yield return WShot("repay");
            yield return WToHome();

            // 청산당한 밤 장면 (sim storyCheck 가 청산한 날 밤에 띄우는 이벤트를 그대로)
            var ev = D.EVENTS.FirstOrDefault(e => e.when == "liq" && (e.part == 0 || e.part == S.part));
            if (WWant(ev != null && Pt == "home", "night_liq", "청산당한 밤 이벤트가 없거나 집이 아님"))
            {
                var opts = new List<Opt>();
                for (int i = 0; i < ev.opts.Count; i++)
                {
                    var o = ev.opts[i]; bool dis = o.need > 0 && S.cash < o.need;
                    opts.Add(new Opt { k = "ev" + i, l = o.l, sub = dis ? G.won(o.need) + " 필요" : G.noHpText(o.sub), dis = dis });
                }
                S.pending = new Pending("event") { evId = ev.id, opts = opts };
                RenderAll(); SetScene(ev.bg ?? "room", ev.face ?? "panic", G.isEve());
                yield return WShot("night_liq");
                yield return WToHome();
            }

            yield return WGoTo("lotto");
            if (AtLoc("lotto")) yield return WSend("act", "k", "l-lotto");
            if (WWant(Pt == "lotto", "lotto", "복권소가 아님: " + Pt)) yield return WShot("lotto");
            yield return WGoTo("park");
            if (WWant(AtLoc("park"), "park", "한강공원이 아님: " + Pt)) yield return WShot("park");
            yield return WGoTo("casino");
            if (WWant(AtLoc("casino"), "casino", "카지노가 아님: " + Pt)) yield return WShot("casino");
            if (AtLoc("casino")) yield return WSend("act", "k", "l-oddeven");
            if (Pt == "casino" && S.cash >= 10000) yield return WSend("bet", "stake", 10000, "choice", 1);
            if (WWant(Pt == "casino", "casino_round", "카지노 판이 아님: " + Pt)) yield return WShot("casino_round");
            // 카지노는 일어나지 않고 둠 → 다음 단계(이자일)에서 일어나며 밤이 끝남
        }

        /// 7일째 밤 납부: 이자 · 원금 분납(모자람 → 낼 수 있음) · 통과 유물 → 다음 날 2장 시작 카드
        IEnumerator WsPayday()
        {
            if (Pt != "casino") yield return WToHome();
            if (!WWant(Pt == "casino" || Pt == "home", "payday_interest", "이자일로 갈 수 없음: " + Pt)) yield break;
            yield return WSend("debug", "k", "pay");   // 7일째 밤으로
            S.stress = Math.Min(S.stress, 30);          // 칸 끝 멘헤라가 이자일보다 먼저 끼지 않게
            S.cash = G.interestDue() + 600000;          // 이자는 낼 수 있고 원금 분납은 모자라게
            yield return WSend(Pt == "casino" ? "casinoLeave" : "rest");
            yield return WResolve("payday", "ending");
            if (!WWant(Pt == "payday" && S.pending.stage == "choose", "payday_interest", "이자일이 아님: " + Pt + "/" + S.pending?.stage)) yield break;
            yield return WShot("payday_interest");
            if (S.pending.opts.Any(o => o.k == "pay" && !o.dis)) yield return WSend("payday", "k", "pay");
            var P = S.pending;
            if (WWant(Pt == "payday" && P.stage == "gate", "gate_short", "원금 분납 단계가 아님: " + Pt + "/" + P?.stage))
            {
                yield return WShot("gate_short");
                // 낼 수 있는 상태: 현금을 채우고 잠김을 sim gateOpts 와 같은 규칙으로 맞춤 (낼 수 있으면 팔기 · 일부 내기는 잠김)
                S.cash = Math.Max(S.cash, P.due + 1000000);
                foreach (var o in P.opts)
                {
                    if (o.k == "gatePay") { o.dis = false; o.sub = G.T("pd.cash", "c", G.won(S.cash)); }
                    else if (o.k == "gateSell" || o.k == "gatePart") o.dis = true;
                }
                RenderAll();
                yield return WShot("gate_ready");
                yield return WSend("payday", "k", "gatePay");
            }
            yield return WResolve("relic", "home", "ending");
            if (WWant(Pt == "relic", "gate_relic", "통과 보상 유물 고르기가 아님: " + Pt)) yield return WShot("gate_relic");
            if (Pt == "relic")
            {   // 유물을 고르면 밤이 끝나고 8일째 아침 → 2장 시작 카드 (아침 카드 등은 대신 클릭)
                yield return WIdle();
                autoSkipDialog = false;
                Send("pickRelic", "i", 0);
                yield return WClickUntil(() => storyNow != null && waiting, 20f);
                if (WWant(storyNow != null, "chapter_card", "장 카드가 안 뜸")) yield return WShot("chapter_card", 0.3f);
                autoSkipDialog = true;
                if (waiting) clicked = true;
            }
            yield return WIdle();
            yield return WToHome();
        }

        /// 2주차: 미납 경고(아침 카드 · HUD) · 대출(열림) · 은행
        IEnumerator WsWeek2()
        {
            yield return WToHome();
            if (!WWant(Pt == "home", "gate_miss_warning", "집이 아님: " + Pt)) yield break;
            int miss0 = S.missN; S.missN = Math.Max(1, S.missN); RenderAll();   // 미납 1번 한 상태로 화면만
            yield return WCard(Morning(WMorningEvent()), "gate_miss_warning");
            S.missN = miss0; RenderAll();
            yield return WSend("loanOpen");
            if (WWant(Pt == "loan" && G.loanOk(), "loan_open", "대출이 아직 잠김 / 대출 창이 아님: " + Pt)) yield return WShot("loan_open");
            yield return WGoTo("bank");
            if (WWant(AtLoc("bank"), "bank", "은행이 아님: " + Pt)) yield return WShot("bank");
            yield return WToHome();
        }

        /// 엔딩: 판마다 새로 시작해 상태만 맞춘 뒤 debug end_* (진엔딩 뒤엔 점수판 · 2부 시작 장면)
        IEnumerator WsEndings()
        {
            int MD = D.RULES.MONTH_DAYS, last = D.RULES.V4_DAYS - 1;
            Action matured = () => { S.month = last / MD + 1; S.day = last % MD + 1; S.paidMonth = S.month; S.debt = 8000000; };   // 28일째 만기 · 빚 30% 아래
            var list = new List<(string name, string kind, Action setup)>
            {
                ("end_true", "clear", () => S.aff = 80),
                ("end_lonely", "clear", () => S.aff = 30),
                ("end_rich", "rich", () => S.aff = 80),
                ("end_gamble_clear", "clear", () => { S.aff = 80; S.st.gnet = 5000000; }),
                ("end_sea", "bad1", () => { matured(); S.aff = 30; }),
                ("end_duo", "bad1", () => { matured(); S.aff = 80; }),
                ("end_gall", "bad1", () => S.galFame = D.FAME.TryGetValue("gall", out var gf) ? gf + 1 : 30),
                ("end_heist", "heist", () => { S.aff = 80; S.greed = 60; }),
                ("end_heist_fail", "heistFail", () => { S.aff = 40; S.greed = 20; }),
                ("end_bad2", "bad2", null),
                ("end_bad2_loop", "bad2", () => S.st.work = 25),
                ("end_bad3", "bad3", null),
                ("end_bad4_run", "bad4", null),
                ("end_bad4_sell", "bad4", () => { var c = OpenCoin(); if (c != null) G.Apply(new SimCommand("open", "tk", c, "dir", 1, "lev", 10, "amt", 100000)); }),
            };
            foreach (var e in list)
            {
                if (ShotMode.TimeUp) yield break;
                yield return WRun(e.name, WEnding(e.name, e.kind, e.setup), 20f);
                WTidy();
            }
        }
        IEnumerator WEnding(string name, string kind, Action setup)
        {
            yield return WIdle();
            WFresh();
            setup?.Invoke();
            RenderAll();
            yield return WSend("debug", "k", "end_" + kind);
            if (!WWant(Pt == "ending", name, "엔딩이 아님: " + Pt)) yield break;
            yield return WShot(name, 0.4f);
            if (name != "end_true") yield break;
            // 엔딩 점수판 (선택지 상자를 맨 아래로)
            panelSv.scrollOffset = new Vector2(0, 100000);
            yield return WShot("end_scoreboard", 0.25f);
            panelSv.scrollOffset = Vector2.zero;
            // 2부 시작 장면: "2부: 아빠의 차용증 →" → 김사장 대사까지 대신 클릭
            yield return WIdle();
            autoSkipDialog = false;
            Send("continue");
            yield return WClickUntil(() => kimKey != null && waitingForDialogue, 12f);
            if (WWant(kimKey != null && waitingForDialogue, "part2_start", "2부 장면이 안 뜸")) yield return WShot("part2_start");
            autoSkipDialog = true;
            if (waiting) clicked = true;
            yield return WIdle();
        }

        /// 미래 표정 스탠딩 전부: 한 장에 8개씩
        IEnumerator WsFaces()
        {
            var all = new[] { "base", "excited", "smug", "shy", "pout", "annoyed", "tired", "pajama", "crying", "crying_comic", "shocked", "dizzy", "mental", "yami", "flex", "love" };
            for (int s = 0; s * 8 < all.Length; s++)
            {
                var sheet = Ui.Box(Ui.Bg); Ui.Fill(sheet);
                sheet.style.flexDirection = FlexDirection.Row; sheet.style.flexWrap = Wrap.Wrap;
                sheet.style.justifyContent = Justify.Center; sheet.style.alignContent = Align.Center; sheet.style.alignItems = Align.FlexEnd;
                foreach (var f in all.Skip(s * 8).Take(8))
                {
                    var col = new VisualElement(); col.style.width = 400; col.style.alignItems = Align.Center; col.style.marginBottom = 20;
                    var sp = ArtCatalog.Mirai(f);
                    var img = new VisualElement(); img.style.height = 430; img.style.width = 430 * 739f / 1080f;
                    if (sp != null) { img.style.backgroundImage = new StyleBackground(sp); img.style.backgroundSize = new BackgroundSize(BackgroundSizeType.Contain); }
                    col.Add(img);
                    col.Add(Ui.Label(sp != null ? f : f + " (그림 없음)", 24, sp != null ? Ui.Text : Ui.Bad, true));
                    sheet.Add(col);
                }
                root.Add(sheet);
                yield return WShot("faces_" + (s + 1), 0.4f);
                sheet.RemoveFromHierarchy();
            }
        }
    }
}
