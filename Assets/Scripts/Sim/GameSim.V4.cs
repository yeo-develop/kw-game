using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace KwGame.Sim
{
    // v4 리디자인 (docs/V4.md). 실시간 모드 + rules V4 = 1 일 때만. 턴 모드(웹 골든)는 안 건드림.
    // 하루 3칸(시계는 멈춤, 장 보기만 실시간) · 4장 28일(장마다 시장 국면) · 주말 휴장 · 미래 호감/욕심 · 아침 부탁 · 만기 결산 엔딩 · 2부(아빠의 차용증)
    public partial class GameSim
    {
        public bool v4 => S != null && S.rt && R.V4 > 0;
        public int chapter() => (int)clamp(S.month, 1, 4);
        public bool weekend() => v4 && S.day > R.V4_WEEKDAYS;
        double p2reg() => S.part > 1 ? R.V4_P2_REGIME : 1;
        // ---------- 시장 국면 시나리오 (판마다 다름) ----------
        /// 씨앗으로 고르는 시나리오 번호 (rng 를 안 씀 → 저장·불러오기와 상관없이 같음). 2부는 1부와 다른 시나리오
        int scenIdx(int part)
        {
            int n = R.V4_SCEN?.Length ?? 0; if (n == 0) return -1;
            uint h = unchecked((uint)S.seed); h ^= h >> 16; h = unchecked(h * 0x7feb352d); h ^= h >> 15; h = unchecked(h * 0x846ca68b); h ^= h >> 16;
            int a = (int)(h % (uint)n);
            return part <= 1 || n == 1 ? a : (a + 1 + (int)((h >> 8) % (uint)(n - 1))) % n;
        }
        /// 장 ch(1~4)의 국면 이름 (화면엔 안 보여 줌 — 뉴스 방향·시세로만 드러남). 시나리오가 없으면 null
        public string regime(int ch = 0) { int i = scenIdx(S.part); if (ch <= 0) ch = chapter(); return i < 0 ? null : R.V4_SCEN[i][(int)clamp(ch, 1, 4) - 1]; }
        /// 장 ch 국면 = [시장 가산, 코인 가산, 변동성 배수, 좋은 뉴스 확률]
        double[] regOf(int ch)
        {
            string k = regime(ch);
            if (k != null && R.V4_REG != null && R.V4_REG.TryGetValue(k, out var g)) return g;
            int c = (int)clamp(ch, 1, 4) - 1;
            return new[] { R.V4_CH_MKT[c], R.V4_CH_COIN[c], R.V4_CH_VOL[c], R.V4_CH_NEWSUP[c] };
        }
        double[] regNow() => regOf(chapter());
        /// 화면에 쓰는 장 이름 (국면은 안 드러냄). ch 0 = 지금 장
        public string chapterName(int ch = 0)
        {
            if (ch <= 0) ch = chapter();
            var L = TA(S.part > 1 ? "v4.chName2" : "v4.chName");
            return L.Count == 0 ? "" : L[(int)clamp(ch, 1, L.Count) - 1];
        }
        public int daysLeft() => Math.Max(0, R.V4_DAYS - absDay());
        /// 2부는 빚 1억 → 한도·상한·만기 판정도 같은 비율로
        public double debtScale() => v4 && S.part > 1 ? R.V4_PART2_DEBT / R.DEBT0 : 1;
        public double debtStart() => R.DEBT0 * debtScale();
        /// 난이도 값 (unity_v4.json V4_DIFF[S.diff][k]). 없으면 기본값. v4 아니면 기본값
        public double dv(string k, double dflt = 1) => v4 && R.V4_DIFF != null && S.diff != null && R.V4_DIFF.TryGetValue(S.diff, out var m) && m.TryGetValue(k, out var x) ? x : dflt;
        /// 같이 원양어선 문턱 (만기 빚 ≤ 시작 빚 × 이 값). 난이도별
        public double duoDebt() => dv("duo", R.V4_DUO_DEBT);

        // ---------- 알바 중 청산 경보 (docs/STORE.md §3 ⑦: 제목 그대로의 순간) ----------
        /// 씨앗 + 시각 해시 → [0,1). rng 를 안 써서 골든·시세 흐름과 무관
        double hashU(int salt)
        {
            uint h = unchecked((uint)S.seed * 0x9E3779B1u ^ (uint)salt * 0x85EBCA6Bu); h ^= h >> 15; h = unchecked(h * 0x2C1B3C6Du); h ^= h >> 12; h = unchecked(h * 0x297A2D39u); h ^= h >> 15;
            return h / 4294967296.0;
        }
        /// 포지션 손실률 (증거금 대비, 0 = 본전, 1 = 전부). 청산은 0.9
        public double posLoss(CoinPos c) => c.entry > 0 ? -(c.lev * c.mult * c.dir * (S.mk.tk[c.tk].p / c.entry - 1)) : 0;
        /// 청산가
        public double liqPrice(CoinPos c) => c.entry * (1 - 0.9 * c.dir / Math.Max(1e-9, c.lev * c.mult));
        /// 알바 나가 있는 동안 레버리지 포지션 손실이 문턱을 넘으면 한 칸에 한 번 경보 pending (true = 시계 멈춤)
        bool liqAlertCheck()
        {
            if (!v4 || !S.awayWork || R.V4_ALERT_LOSS <= 0 || S.alertT == Tnow() || S.pending != null) return false;
            CoinPos worst = null; double wl = 0;
            foreach (var c in S.cps) { if (c.lev * c.mult < 2 || c.margin <= 0) continue; double l = posLoss(c); if (l >= R.V4_ALERT_LOSS && l > wl) { wl = l; worst = c; } }
            if (worst == null) return false;
            S.alertT = Tnow();
            double took = round1k(S.lastPay * (1 - R.V4_ALERT_PAY));
            S.pending = new Pending("liqAlert") { tk = worst.tk, n0 = Math.Min(1, wl), total = rhu(worst.margin * Math.Min(1, wl)), due = liqPrice(worst), took = took, half = R.V4_ALERT_CAUGHT, key = S.lastJob };
            face("panic");
            toast(T("v4.alert.toast", "n", D.TK[worst.tk].name, "p", rhu(wl * 100)), "liq", "coin");
            Emit("liqAlert", "tk", worst.tk, "loss", wl);
            return true;
        }
        /// 경보 선택. peek = 몰래 폰 본다 (전부 정리 + 일당 깎임 + 들킬 수도), 아니면 참는다. 남은 알바 시간은 spend 로 이어 흘림
        Sub liqAlertPick(bool peek)
        {
            var P = S.pending; if (P == null || P.t != "liqAlert") return Sub.Err("state");
            S.pending = null;
            if (peek)
            {
                double s = 0; foreach (var x in S.cps.ToList()) s += closeCoin(x) ?? 0;
                Emit("trade", "op", "closeCoins", "ok", true, "pnl", s);
                bool caught = hashU(Tnow() * 31 + 7) < P.half;
                double cut = caught ? S.lastPay : P.took;
                if (cut > 0) { money(-cut, "work", T(caught ? "lbl.alertCaught" : "lbl.alertCut")); coverNeg(); }   // 돌발 매수 뒤라 현금이 모자라면 빚으로
                if (caught) { stress(8); pushK("m", T("v4.alert.caughtM")); toast(T("v4.alert.caught", "p", won(S.lastPay)), "liq"); }
                else toast(T("v4.alert.peek", "p", won(cut), "pnl", sgnWon(s)), "info");
            }
            else toast(T("v4.alert.hold"), "info");
            after("spend");
            return Sub.Go();
        }
        public bool locHidden(string id) => v4 && R.V4_HIDE_LOCS != null && R.V4_HIDE_LOCS.Contains(id);
        /// 국장 주문 가능: v4 는 장 보기 칸에서만 (행동 → 소재 → 본 행동). 코인은 어디서나
        public bool stockTradeOk() => stockOpen() && (!v4 || S.pending?.t == "watch");
        /// 칸 시작 속보: 이번 칸 시세에 들어갈 뉴스를 먼저 보여 줌 (가짜일 수도). STONKS 식 '뉴스 보고 판단'
        void newsFlash()
        {
            var n = S.news; if (!v4 || n == null || S.nflashT == Tnow()) return;
            S.nflashT = Tnow();
            // AI 기사면 출처·본문까지 (가짜 30% 는 기사 속 단서로 가려냄 → 칸 끝에 [오보] 정정)
            pushF("🚨", T("v4.newsFlash", "h", n.h), "news", n.llm ? new List<string> { T("news.src", "s", n.src, "b", n.body) } : null);
            toast(T("v4.newsFlash", "h", n.h), "news", "news", "flash");   // room "flash" = 칸 시작 속보 (소리 구분용)
        }
        /// 장별 뉴스 방향 편향 (국면 = 확률). 좋은 뉴스가 나올 확률
        int newsDir() => rnd() < regNow()[3] ? 1 : -1;
        /// 칸 남은 시간 (v4: 행동 하나 = 칸 하나)
        int slotLeft() => Math.Max(1, slotEndMin(S.slot) - S.min);

        /// 호감 변화. 오를 땐 높을수록 덜 오름 (×(1 − 호감/V4_AFF_SOFT)) → 공짜로 100 찍지 못하게
        void affD(double d)
        {
            if (!v4 || d == 0) return;
            if (d > 0) d *= Math.Max(0.1, 1 - S.aff / R.V4_AFF_SOFT);
            double b = S.aff; S.aff = clamp(rhu(S.aff + d), 0, 100);
            if (S.aff != b) Emit("aff", "d", S.aff - b, "v", S.aff);
        }
        void greedD(double d) { if (v4 && d != 0) S.greed = clamp(rhu(S.greed + d), 0, 100); }

        // ---------- 신용 · 실적 (초반 시드머니) ----------
        /// 이자 낸 횟수 = 김사장 신용. V4_CREDIT_LOAN 넘어야 대출. 이자를 일찍 내면 일찍 열림 (레버리지·숏은 실적 — levCap · shortOk)
        public int credit() => !v4 || S.part > 1 ? 3 : (int)clamp(   // 2부는 1부에서 쌓은 신용 그대로 (다 열림)
            S.month - 1 + (S.paidMonth == S.month && S.earlyM != S.month ? 1 : 0), 0, 3);   // 실적 없이 미리 낸 이자는 이자일에 신용으로
        /// 이자를 미리 내면 바로 신용이 오르는 실적 (레버리지 첫 단계와 같은 실현수익). 0 = 누구나
        public double earlyCreditProfit() => R.V4_LEV_PROFIT != null && R.V4_LEV_PROFIT.Length > 1 ? R.V4_LEV_PROFIT[1] : 0;
        public bool loanOk() => credit() >= R.V4_CREDIT_LOAN;
        /// 숏 = 실적으로 엶 (STONKS 의 '평판'): 실현수익 누적 V4_SHORT_PROFIT 넘으면. 신용(이자)으론 안 열림
        public bool shortOk() => !v4 || S.shortOn || R.V4_SHORT_PROFIT <= 0;
        /// 레버리지 단계 = 실현수익으로 오른 최고 단계 (다시 잃어도 안 내려감). 2부는 다 열림
        public double levCap() { var L = R.V4_LEV_CAP; return !v4 || S.part > 1 || L == null || L.Length == 0 ? 1000 : L[Math.Min(S.levTier, L.Length - 1)]; }
        int levTierOf(double p) { var P = R.V4_LEV_PROFIT; int t = 0; for (int i = 1; i < (P?.Length ?? 0); i++) if (p >= P[i]) t = i; return t; }
        /// 다음 레버리지 단계 문구 (화면용). null = 다 열림
        public string levNext()
        {
            var P = R.V4_LEV_PROFIT; int n = S.levTier + 1;
            return !v4 || S.part > 1 || P == null || n >= P.Length ? null : T("v4.lev.next", "p", man(P[n]), "x", R.V4_LEV_CAP[n]);
        }
        /// 다음 신용 단계 문구 (화면용). null = 대출 열림
        public string creditNext() => !v4 || loanOk() ? null : S.earlyM == S.month && S.paidMonth == S.month ? T("v4.credit.nextPaid") : T("v4.credit.next1", "p", man(earlyCreditProfit()));
        /// 이자 낸 직후: 대출이 열렸으면 김사장 카톡 + 토스트
        void creditUp(int before)
        {
            if (!v4 || before >= R.V4_CREDIT_LOAN || !loanOk()) return;
            string x = T("v4.credit.up1");
            pushK("kim", T("v4.credit.kim", "x", x)); toast(x, "good", "kakao", "kim"); Emit("unlock", "k", "loan");
        }
        /// 매도·청산 뒤: 실적 넘었으면 레버리지 단계 올리고 · 숏 열고 김사장 카톡
        void shortCheck()
        {
            if (!v4) return;
            int t = levTierOf(S.realized);
            if (t > S.levTier)
            {
                S.levTier = t;
                string x = T("v4.lev.up", "p", man(R.V4_LEV_PROFIT[t]), "x", R.V4_LEV_CAP[t]);
                pushK("kim", T("v4.short.kim", "x", x)); toast(x, "good", "kakao", "kim"); Emit("unlock", "k", "lev");
            }
            if (S.shortOn || S.realized < R.V4_SHORT_PROFIT) return;
            S.shortOn = true;
            string y = T("v4.short.up", "p", man(R.V4_SHORT_PROFIT));
            pushK("kim", T("v4.short.kim", "x", y)); toast(y, "good", "kakao", "kim"); Emit("unlock", "k", "short");
        }

        // ---------- 아침 부탁 ----------
        public class Prom { public string id, ask, avoid, @do, okK, badK, endOk, endBad, hud; }
        List<Prom> proms() => D.J["V4_PROM"] is JArray a ? a.ToObject<List<Prom>>() : new List<Prom>();
        public Prom promNow() => S.prom == null ? null : proms().FirstOrDefault(p => p.id == S.prom);
        /// 오늘 부탁 상태 (화면용): null = 없음, "ok" = 해냄/지키는 중, "bad" = 어김
        public string promState() { var p = promNow(); if (p == null) return null; if (S.promBad) return "bad"; if (p.@do != null) return S.promDone ? "ok" : "todo"; return "ok"; }

        void promPick()
        {
            var L = proms(); if (L.Count == 0) { S.prom = null; return; }
            var ok = L.Where(p => p.id != S.prom).ToList();
            var p0 = ok[(int)Math.Floor(rnd() * ok.Count)];
            S.prom = p0.id; S.promBad = false; S.promDone = false;
            pushK("m", p0.ask);
        }
        /// 행동마다 부탁 확인: coin(코인 열기) · gamble(카지노·복권) · work(알바) · date(놀아주기) · out(밤 외출)
        void promHit(string kind)
        {
            if (!v4) return;
            var p = promNow(); if (p == null) return;
            if (p.avoid == kind && !S.promBad)
            {
                S.promBad = true;
                pushK("m", p.badK); toast(T("v4.promBadT", "a", p.hud), "liq", "kakao", "m");
                Emit("prom", "ok", false);
            }
            else if (p.@do == kind && !S.promDone)
            {
                S.promDone = true;
                pushK("m", p.okK); toast(T("v4.promOkT", "a", p.hud), "good", "kakao", "m");
                Emit("prom", "ok", true);
            }
        }
        /// 자정: 부탁 판정 → 호감·스트레스
        void promJudge()
        {
            var p = promNow(); if (p == null) return;
            if (p.avoid == "coin" && S.cps.Any(c => !c.mirai)) S.promBad = true;   // 코인 금지 = 자정에 들고 있어도 어김 (미래가 돌발로 산 건 빼고)
            bool kept = !S.promBad && (p.@do == null || S.promDone);
            if (kept) S.promKept++; else S.promBroke++;   // 메타 업적용 (하루 한 번 확정 판정 — 행동 순간의 Emit("prom") 은 '하지 마' 부탁을 지킨 날엔 안 나옴)
            if (kept) { affD(p.@do != null ? R.V4_PROM_OK : R.V4_PROM_OK / 2); stress(-5); pushK("m", p.endOk); }   // 하지 마 부탁은 가만있어도 지켜지니 절반
            else { affD(R.V4_PROM_BAD); stress(10); pushK("m", p.endBad); }
            S.prom = null;
        }

        // ---------- 아침 · 하루 끝 ----------
        void v4Morning()
        {
            if (!v4) return;
            greedD(-(S.heist > 0 ? R.V4_GREED_DECAY_HEIST : R.V4_GREED_DECAY));   // 털기 계획 중엔 욕심이 잘 안 식음
            int key = S.part * 10 + chapter();
            if (S.day == 1 && S.chSeen != key) { S.chSeen = key; Emit("story", "key", (S.part > 1 ? "p2ch" : "ch") + chapter()); }
            promPick();
            if (S.sleepD == absDay() && R.V4_SLEEP_RSCH > 0) toast(T("v4.rest.morning", "n", R.V4_SLEEP_RSCH), "good");   // 어젯밤 푹 잠
            if (S.greed >= R.V4_GREED_HEIST) pushK("m", fpick(TA("v4.greedK2")));        // 털기 문턱 넘음
            else if (S.greed >= R.V4_GREED_HEIST - 15) pushK("m", fpick(TA("v4.greedK")));   // 슬슬
        }
        void v4DayEnd()
        {
            if (!v4) return;
            promJudge();
            if (S.dateN == 0) affD(-R.V4_AFF_DECAY * dv("decay"));   // 하루 종일 안 놀아 주면 식음 (난이도별)
            S.dateN = 0;
        }

        // ---------- 집 행동 ----------
        /// 시간대 비중: 평일 낮 = 장·알바 시간이라 놀아도 호감 덜 오름, 저녁 = 미래 시간. 주말은 그대로
        public double dateMult() => !v4 || weekend() ? 1 : isEve() ? R.V4_DATE_EVE : R.V4_DATE_DAY;
        /// 미래랑 놀기: 칸 하나. 같은 날 두 번째부턴 호감 조금만
        void dateHome()
        {
            S.dateN++;
            affD((S.dateN == 1 ? R.V4_DATE_AFF : 2) * dateMult());
            stress(R.V4_DATE_ST); hp(5, T("why.date"));
            S.workStreak = 0;
            face("happy");
            M(fpick(TA(S.aff >= R.V4_AFF_GOOD ? "v4.dateHi" : "v4.dateLo")), "happy");
            hideDlg();
            promHit("date"); if (isEve()) promHit("datenight");
            S.actMin = slotLeft(); slotUsed();
        }
        /// 집 '쉬기/자기' 버튼 부제 (화면용): 밤 = 체력 + 내일 무료 리포트 보너스
        public string restHint() => !v4 ? null : isEve()
            ? (R.V4_SLEEP_RSCH > 0 ? T("v4.rest.subEve", "h", R.RT_HP_REST_EVE + R.RT_HP_SLEEP, "n", R.V4_SLEEP_RSCH) : T("v4.rest.subEve0", "h", R.RT_HP_REST_EVE + R.RT_HP_SLEEP))
            : T("v4.rest.sub", "h", R.RT_HP_REST);
        void watchStart() { S.pending = new Pending("watch") { n0 = S.st.invest }; Emit("watch"); }
        void watchEnd()
        {
            bool traded = S.st.invest > S.pending.n0;
            if (traded) hp(-hpCost("trade"));
            S.pending = null; S.actMin = slotLeft(); slotUsed();
        }

        // ---------- 이야기 이벤트 (정해진 날) ----------
        bool storyCheck()
        {
            if (!v4 || D.EVENTS.Count == 0 || fainted() || S.ending != null) return false;
            var ev = D.EVENTS.FirstOrDefault(e => e.day == absDay() && (e.part == 0 || e.part == S.part) && (e.slots == null || e.slots.Contains(S.slot)) && S.heist >= e.heistMin && !S.evSeen.Contains(e.id + "@" + S.part));
            if (ev == null) return false;
            S.evSeen.Add(ev.id + "@" + S.part); S.evT = Tnow();
            evStart(ev);
            return true;
        }

        /// 이자일 "전량 매도" = 급매 손해 (주식 평가액의 V4_FIRESALE)
        double fireSale(double stockV)
        {
            if (!v4 || stockV <= 0) return 0;
            double cut = round1k(stockV * R.V4_FIRESALE);
            if (cut > 0) money(-cut, "invest", T("v4.fireSale"));
            return cut;
        }
        /// 주말 갭: 주말 국장 움직임을 쌓아 뒀다가 월요일 오전에 (금요일에 들고 갈까 = 위험)
        /// 같은 칸 계획을 다시 짜도 갭이 두 번 쌓이거나 사라지지 않게 칸마다 한 번만 (S.gapT)
        double wkGap(Ticker t, double r, MarketState M)
        {
            if (!v4 || !t.IsStock || M != S.mk || S.gapT == Tnow()) return r;
            if (weekend()) { S.wkGap[t.id] = (S.wkGap.TryGetValue(t.id, out var g) ? g : 0) + r; return 0; }
            if (S.day == 1 && S.slot == 0 && S.wkGap.TryGetValue(t.id, out var g2)) { S.wkGap.Remove(t.id); return r + g2; }
            return r;
        }

        // ---------- 엔딩 ----------
        /// 만기(28일째 이자일 뒤)에 빚이 남았을 때. 털기 루트(이야기 이벤트 4개)를 끝까지 타고 "턴다"를 골랐으면 빚과 상관없이 털기:
        /// 호감 V4_AFF_HEIST(믿고 따라옴) + 욕심 V4_GREED_HEIST(끝까지 감) 둘 다면 성공 `heist`, 아니면 `heistFail`. 그 밖엔 bad1 (빚 60% 이하면 같이/혼자 원양어선)
        void maturityEnd()
        {
            kim(false);
            N(T("v4.maturityN", "d", won(S.debt)));
            if (S.heistGo) { ending(heistOk() ? "heist" : "heistFail"); return; }
            ending("bad1");
        }
        public bool heistOk() => S.aff >= R.V4_AFF_HEIST && S.greed >= R.V4_GREED_HEIST;
        /// ending() 끝에서 v4 변형 덮어쓰기
        void v4EndVariant(string kind, ref string variant, ref string lead)
        {
            if (!v4) return;
            bool good = S.aff >= R.V4_AFF_GOOD;
            var v = V("debt", won(S.debt), "aff", S.aff, "d", absDay(), "p", S.part, "pct", Math.Max(0, Math.Round((1 - S.debt / debtStart()) * 100)));   // pct = 갚은 비율 (같이 원양어선 문턱 = 1 − V4_DUO_DEBT)
            if (kind == "clear")
            {
                if (variant == "gamble" || variant == "rich") { if (!good) { variant = "lonely"; lead = T("v4.end.lonely", v); } return; }
                variant = good ? "true" : "lonely";
                lead = T(good ? (S.part > 1 ? "v4.end.true2" : "v4.end.true") : "v4.end.lonely", v);
            }
            else if (kind == "bad1" && absDay() >= R.V4_DAYS && S.debt <= debtStart() * duoDebt())
            {
                variant = good ? "duo" : "sea";
                lead = T(good ? "v4.end.duo" : "v4.end.half", v);
            }
            else if (kind == "heist" || kind == "heistFail") lead = T("v4.end." + kind, v);
        }

        // ---------- 2부 (B안: 아빠의 차용증) ----------
        bool part2Start()
        {
            S.part = 2; S.cleared = 0; S.ending = null; S.endInfo = null; S.pending = null; S.phase = "home";
            S.month = 1; S.day = 1; S.slot = 0; S.min = R.RT_DAY0; S.owe = 0; S.paidMonth = 0; S.sleepD = 0; S.earlyM = 0; S.chSeen = 0; S.prom = null; S.promBad = S.promDone = false; S.dateN = 0; S.wkGap.Clear(); S.heist = 0; S.heistGo = false;
            S.debt = R.V4_PART2_DEBT; S.st.maxDebt = Math.Max(S.st.maxDebt, S.debt); S.st.minDebt = S.debt;
            S.today = new List<Ledger>(); S.resume = null;
            foreach (var kv in S.mk.tk) { kv.Value.ref0 = kv.Value.p; kv.Value.sT = int.MinValue; }
            S.mplan = null;
            Emit("story", "key", "part2");
            Emit("continued");
            S.needMorning = true;
            S.flow = new List<string> { "loopTop" };
            return true;
        }
    }
}
