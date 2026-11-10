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
        // ---------- 알바 중 실시간 · 몰래 폰 보기 (docs/BLUEPRINT.md ①: 시세는 계속 흐르고 손은 묶임) ----------
        /// 알바 미니게임이 도는 동안 시계를 m 분 흘림 (칸 끝 1분 전까지만 — 칸 마무리는 결과 뒤에). 그동안 예약·청산·발표가 그대로 일어남
        Sub workTick(int m)
        {
            var P = S.pending; if (!v4 || P == null || P.t != "work" || P.setup == null || P.setup.practice) return Sub.Err("state");
            m = Math.Min(m, slotEndMin(S.slot) - 1 - S.min);
            if (m <= 0) return Sub.Go();
            S.awayWork = true;
            clockRun(m);
            workAlertCheck();
            return Sub.Go();
        }
        /// 레버리지 포지션 손실이 문턱을 넘으면 한 칸에 한 번 알림 (화면: 미니게임 위 경고 — 폰을 볼지는 플레이어 몫)
        void workAlertCheck()
        {
            if (R.V4_ALERT_LOSS <= 0 || S.alertT == Tnow()) return;
            CoinPos worst = null; double wl = 0;
            foreach (var c in S.cps) { if (c.lev * c.mult < 2 || c.margin <= 0) continue; double l = posLoss(c); if (l >= R.V4_ALERT_LOSS && l > wl) { wl = l; worst = c; } }
            if (worst == null) return;
            S.alertT = Tnow();
            toast(T("v4.alert.toast", "n", D.TK[worst.tk].name, "p", rhu(wl * 100)), "liq", "coin");
            Emit("workAlert", "tk", worst.tk, "loss", wl, "liq", liqPrice(worst), "id", worst.id);
        }
        /// 이 알바에서 몰래 폰을 볼 때 들킬 확률 (1 이상 = 폰을 못 꺼냄)
        public double peekRisk(string job) => R.V4_PEEK != null && R.V4_PEEK.TryGetValue(job ?? "", out var p) ? p : R.V4_ALERT_CAUGHT;
        /// 지금 몰래 폰을 볼 수 있나 (알바 미니게임 중 + 폰을 꺼낼 수 있는 알바)
        public bool peekOk() => v4 && S.pending?.t == "work" && S.pending.setup != null && !S.pending.setup.practice && peekRisk(S.pending.key) < 1;
        /// 지금까지 폰을 본 만큼 깎이는 일당 비율 (들켰으면 전부)
        public double peekCut(Pending P) => P == null ? 0 : P.caught ? 1 : Math.Min(1, R.V4_PEEK_PAY * P.peeks);
        /// 몰래 폰 보기: 포지션 정리 (코인 id 하나, 0 이하면 코인 전부). tk = 그 주식을 전량 매도, stk = 주식도 전부. 볼 때마다 일당 −V4_PEEK_PAY, 들키면 그 칸 일당 0
        Sub workPeek(int id, string tk = null, bool stk = false)
        {
            var P = S.pending; if (!peekOk()) return Sub.Err("peek");
            // 닫을 코인도, 지금 팔 수 있는 주식(장중 · 안 잠김)도 없으면 거절 — 예전엔 아무것도 못 팔고 일당만 깎임
            bool anyCoin = tk == null && S.cps.Any(x => id <= 0 || x.id == id);
            bool anyStk = (tk != null || stk) && stockOpen() && STK().Any(k => S.hold.Has(k) && S.hold[k].q > 0 && (tk == null || k == tk) && !opLocked(k));
            if (!anyCoin && !anyStk) return Sub.Err("peekNone");
            P.peeks++;
            bool was = P.caught;
            if (!P.caught && hashU(Tnow() * 31 + 7 + P.peeks * 97) < peekRisk(P.key)) P.caught = true;
            double s = 0; int n = 0;
            if (tk == null) foreach (var x in S.cps.ToList()) if (id <= 0 || x.id == id) { s += closeCoin(x) ?? 0; n++; }
            // 주식 (작전주를 들고 알바 간 사람): 장이 열려 있고 하한가에 잠기지 않았어야 팔림
            if (tk != null || stk) foreach (var k in STK().ToList()) if (S.hold.Has(k) && (tk == null || k == tk)) { var r = sellStock(k, 1, stockFee("app")); if (r.HasValue) { s += r.Value; n++; } }
            Emit("trade", "op", "closeCoins", "ok", true, "pnl", s);
            Emit("peek", "n", P.peeks, "caught", P.caught, "pnl", s, "closed", n, "cut", peekCut(P));
            if (P.caught && !was) { stress(8); toast(T("v4.peek.caught"), "liq"); }
            else toast(was ? T("v4.peek.again", "pnl", sgnMan(s)) : T("v4.peek.ok", "pnl", sgnMan(s), "p", rhu(peekCut(P) * 100)), "info");
            return Sub.Go();
        }

        // ---------- 하루 결과: 정산 카드 · 밤의 미래 · 호감 버프 (docs/BLUEPRINT.md ① ⑥-5·6) ----------
        static readonly string[] SETTLE_SKIP = { "work", "invest", "debt", "loan", "repay", "interest" };
        void dayBaseSet() { S.dayReal0 = S.realized; S.dayLiq0 = S.st.liq; S.dayCash0 = S.cash; S.dayLed0 = S.today.Count; S.dayRes = null; S.dayBase = absDay() * 10 + S.part; }
        /// 오늘(아침 이후) 매매 실현손익 · 청산 횟수
        public double dayPnl() => S.realized - S.dayReal0;
        public int dayLiq() => (int)Math.Round(S.st.liq - S.dayLiq0);
        /// 그날 결과 4종: liq 청산 · jackpot 대박 · loss 손실 · normal 평범
        public string dayClass() { double p = dayPnl(), k = debtScale(); return dayLiq() > 0 ? "liq" : p >= R.V4_NIGHT_BIG * k ? "jackpot" : p <= -R.V4_NIGHT_LOSS * k ? "loss" : "normal"; }
        /// 저녁 칸 시작: 낮 결과를 한 번에 정산 (일당 · 매매 · 청산 · 리포트 적중) → 그 결과로 밤의 미래 대사가 갈림
        void v4Evening()
        {
            if (!v4 || !isEve() || S.settleD == absDay()) return;
            S.settleD = absDay();
            if (S.dayBase != absDay() * 10 + S.part) { dayBaseSet(); return; }   // 기준점이 오늘 것이 아님 (루프 재설계 전 저장을 낮에 불러옴): 누적값으로 가짜 정산이 나오지 않게 오늘은 건너뜀
            double wage = 0; foreach (var x in S.today) if (x.kind == "work") wage += x.amt;
            double pnl = dayPnl(); int liq = dayLiq(), day = Tnow() / R.SLOTS;
            var reps = S.tips.Where(t => !string.IsNullOrEmpty(t.res) && srcOf(t).an && t.Tr / R.SLOTS == day).ToList();
            S.dayRes = dayClass();
            // 그 밖 = 일당·매매 말고 오늘 벌거나 쓴 돈 (유료 리포트 · 사건 · 도박 · 배당 · 놀거리 · 상점). 대출 · 상환 · 이자는 번 것도 쓴 것도 아니라 '옮긴 돈'으로.
            // 아침 기준점(dayBaseSet) 전에 들어온 아침 사건·배당은 아침 현금에 이미 들어 있으므로 세지 않음 (두 번 셈 방지)
            double other = 0; for (int i = Math.Min(S.dayLed0, S.today.Count); i < S.today.Count; i++) { var x = S.today[i]; if (!SETTLE_SKIP.Contains(x.kind)) other += x.amt; }
            double net = wage + pnl + other, due = gateOn ? gateDue() : 0; bool hasBase = S.dayCash0 >= 0;
            if (wage != 0 || pnl != 0 || other != 0 || liq > 0 || reps.Count > 0)
                Emit("settle", "cls", S.dayRes, "wage", wage, "pnl", pnl, "other", other, "liq", liq, "unreal", unreal(), "hit", reps.Count(t => t.res == "hit"), "miss", reps.Count(t => t.res != "hit"), "net", net,
                    "cash0", hasBase ? S.dayCash0 : -1, "cash", S.cash, "move", hasBase ? S.cash - S.dayCash0 - net : 0, "due", due, "gap", Math.Max(0, due - S.cash), "dd", gateDays());
            if (S.dayRes == "jackpot") greedD(R.V4_NIGHT_GREED);
            if (S.day == R.MONTH_DAYS && S.paidMonth != S.month && S.debt > 0) return;   // 이자일 저녁 집 대사는 김사장 얘기
            var L = TA("v4.night." + S.dayRes); if (L.Count == 0) return;
            string line = fpick(L).Replace("{a}", won(Math.Abs(pnl))).Replace("{w}", won(wage));
            S.hl = new HomeLine { T = Tnow(), t = line };
            Emit("night", "cls", S.dayRes, "line", line);
        }
        /// 호감 구간 버프 단계 (기둥 연결): 1 = 도시락(아침 스트레스 −) · 2 = + 미래의 감(하루 한 번 가짜 속보 경고) · 3 = + 응원(일당 +)
        public int buffTier() { var A = R.V4_BUFF_AFF; if (!v4 || A == null) return 0; int n = 0; foreach (var a in A) if (S.aff >= a) n++; return n; }
        /// 지금 켜진 버프 이름들 (화면용)
        public List<string> buffs()
        {
            var L = new List<string>(); int t = buffTier();
            if (t >= 1) L.Add(T("v4.buff.lunchN")); if (t >= 2) L.Add(T(S.senseD == absDay() ? "v4.buff.senseUsed" : "v4.buff.senseN")); if (t >= 3) L.Add(T("v4.buff.cheerN", "p", rhu((R.V4_BUFF_CHEER - 1) * 100)));
            return L;
        }
        /// 알바를 잘하면 (점수 V4_WORK_INFO↑) 손님이 정보를 흘림: 분석가 한 명의 지난 리포트 한 건이 맞았나 (전적에 더해짐 = 읽을 거리가 빨리 쌓임)
        void workInfo()
        {
            var L = analysts(); if (L.Count == 0) return;
            var a = L[(int)Math.Min(L.Count - 1, Math.Floor(hashU(Tnow() * 53 + 3) * L.Count))];
            bool hit = hashU(Tnow() * 59 + 11) < anAcc(a.id);
            if (!S.srcStat.TryGetValue(a.id, out var g)) S.srcStat[a.id] = g = new int[2];
            g[1]++; if (hit) g[0]++;
            string x = T(hit ? "v4.work.infoHit" : "v4.work.infoMiss", "ic", a.ic, "a", a.name, "r", srcRec(a.id));
            pushF("👂", x, "tip"); toast(x, "info");
            Emit("workInfo", "who", a.id, "hit", hit);
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
            if (buffTier() >= 2 && S.senseD != absDay() && n.tk != "MKT")
            {   // 호감 버프: 미래의 감 — 하루에 한 번, 그날 첫 속보가 쎄한지 괜찮은지 말해 줌. 감이라 가끔 틀림 (늘 맞으면 '말이 없으면 진짜'가 됨)
                S.senseD = absDay();
                bool right = hashU(Tnow() * 47 + 29) < R.V4_SENSE_ACC, warn = n.fake == right;
                string x = T(warn ? "v4.buff.sense" : "v4.buff.senseOk", "n", D.TK.TryGetValue(n.tk, out var nt) ? nt.name : n.tk);
                pushK("m", x); toast(x, "info", "kakao", "m"); Emit("sense", "tk", n.tk, "warn", warn);
            }
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
        public bool loanOk() => gateOn ? S.part > 1 || S.gateTier >= R.V4_LOAN_GATE : credit() >= R.V4_CREDIT_LOAN;   // 관문 규칙: 첫 납부 통과 뒤
        /// 숏 = 실적으로 엶 (STONKS 의 '평판'): 실현수익 누적 V4_SHORT_PROFIT 넘으면. 신용(이자)으론 안 열림
        public bool shortOk() => !v4 || (gateOn ? S.part > 1 || S.month >= R.V4_SHORT_WEEK : S.shortOn || R.V4_SHORT_PROFIT <= 0);   // 관문 규칙: 2주차부터
        /// 레버리지 단계 = 실현수익으로 오른 최고 단계 (다시 잃어도 안 내려감). 2부는 다 열림
        public double levCap() { var L = R.V4_LEV_CAP; return !v4 || gateOn || S.part > 1 || L == null || L.Length == 0 ? 1000 : L[Math.Min(S.levTier, L.Length - 1)]; }   // 관문 규칙: 배율은 처음부터 자유 (증거금 상한으로 묶음 — marginCap)
        int levTierOf(double p) { var P = R.V4_LEV_PROFIT; int t = 0; for (int i = 1; i < (P?.Length ?? 0); i++) if (p >= P[i]) t = i; return t; }
        /// 다음 레버리지 단계 문구 (화면용). null = 다 열림
        public string levNext()
        {
            var P = R.V4_LEV_PROFIT; int n = S.levTier + 1;
            return !v4 || gateOn || S.part > 1 || P == null || n >= P.Length ? null : T("v4.lev.next", "p", man(P[n]), "x", R.V4_LEV_CAP[n]);
        }
        /// 다음 신용 단계 문구 (화면용). null = 대출 열림
        public string creditNext() => !v4 || loanOk() ? null : gateOn ? T("v4.gate.loanNext") : S.earlyM == S.month && S.paidMonth == S.month ? T("v4.credit.nextPaid") : T("v4.credit.next1", "p", man(earlyCreditProfit()));
        /// 이자 낸 직후: 대출이 열렸으면 김사장 카톡 + 토스트
        void creditUp(int before)
        {
            if (!v4 || gateOn || before >= R.V4_CREDIT_LOAN || !loanOk()) return;   // 관문 규칙에선 gatePass 가 알림
            string x = T("v4.credit.up1");
            pushK("kim", T("v4.credit.kim", "x", x)); toast(x, "good", "kakao", "kim"); Emit("unlock", "k", "loan");
        }
        /// 매도·청산 뒤: 실적 넘었으면 레버리지 단계 올리고 · 숏 열고 김사장 카톡
        void shortCheck()
        {
            if (!v4 || gateOn) return;   // 관문 규칙: 실적 해금 없음 (납부 통과로 엶)
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

        // ---------- 주간 납부 관문 (docs/BLUEPRINT.md) ----------
        public bool gateOn => v4 && R.V4_GATE_CAP != null && R.V4_GATE_CAP.Length > 0;
        /// 주 w(1~) 납부 뒤 남아도 되는 빚. 마지막 주는 0 = 만기
        public double gateCap(int week = 0)
        {
            if (!gateOn) return double.MaxValue;
            if (week <= 0) week = S.month;
            var C = R.V4_GATE_CAP; return C[(int)clamp(week, 1, C.Length) - 1] * debtScale();
        }
        /// 이번 주에 갚아야 할 원금 (지금 빚 − 상한). 주중에 미리 갚으면 줄어듦. 이번 주에 빌린 돈은 다음 주 몫 (관문을 넘기는 비싼 다리 — 선이자 10% + 이자)
        public double gatePrincipal() => !gateOn ? 0 : Math.Max(0, S.debt - (gateLast() ? 0 : S.loanWeek) - gateCap());
        /// 숏이 잠겨 있으면 그 이유 (화면용). 열려 있으면 null
        public string shortLockWhy() => shortOk() ? null : gateOn ? T("v4.short.week", "w", R.V4_SHORT_WEEK) : T("v4.short.lockOld");
        /// 대출 화면 안내 (화면용): 이번 주에 얼마 더 빌릴 수 있나 · 빌린 돈은 다음 주 납부로. 관문 규칙이 아니면 null
        public string loanWeekHint()
        {
            if (!gateOn || R.V4_LOAN_WEEK <= 0) return null;
            double m = R.V4_LOAN_WEEK * debtScale(), r = loanWeekRoom();
            return r < R.LOAN_AMTS.Min() ? T("v4.gate.loanFull", "m", man(m)) : T("v4.gate.loanWeek", "r", man(r), "m", man(m));
        }
        /// 이번 주에 더 빌릴 수 있는 돈 (관문 규칙: 주당 한도)
        public double loanWeekRoom() => !gateOn || R.V4_LOAN_WEEK <= 0 ? double.MaxValue : Math.Max(0, R.V4_LOAN_WEEK * debtScale() - S.loanWeek);
        /// 만기 주 (상한 0): 빌린 돈도 다 갚아야 함
        bool gateLast() => S.month >= R.V4_GATE_CAP.Length;
        /// 이번 주 납부 총액 = 이자(아직 안 냈으면) + 원금 분납
        public double gateDue() => (S.paidMonth == S.month ? 0 : interestDue()) + gatePrincipal();
        /// 이번 주 납부일까지 남은 날 (납부일 당일 = 0)
        public int gateDays() => Math.Max(0, R.MONTH_DAYS - S.day);
        /// 순자산(화면용): 현금 + 들고 있는 주식·포지션 평가액. 빚은 뺀 값이 아님 (빚은 옆에 따로 보임)
        public double equity() => S.cash + holdVal();
        /// 코인 증거금 합계 상한 = 주차별 (마지막 값이 끝까지, 2부는 빚 비율만큼)
        public double marginCap(int week = 0)
        {
            var M = R.V4_MARGIN_CAP; if (week <= 0) week = S.month;
            return !v4 || M == null || M.Length == 0 ? double.MaxValue : M[(int)clamp(week, 1, M.Length) - 1] * debtScale();
        }
        public double marginUsed() => S.cps.Where(c => !c.mirai).Sum(c => c.margin);
        public double marginRoom() => Math.Max(0, marginCap() - marginUsed());
        /// 증거금 상한 안내 (화면용). null = 상한 없음
        public string marginNext()
        {
            double cap = marginCap(), nx = marginCap(S.month + 1);
            if (cap == double.MaxValue) return null;
            return nx > cap ? T("v4.margin.next", "a", man(cap), "b", man(nx)) : T("v4.margin.last", "a", man(cap));
        }
        List<Opt> gateOpts(double need)
        {
            double hv = stockValFree() + coinVal(), part = Math.Floor(Math.Min(S.cash, need) / 10000) * 10000;   // 잠긴 주식은 급매로도 못 팖
            string left = $"{S.missN + 1}/{R.V4_MISS_MAX}";
            return new List<Opt> {
                new Opt { k = "gatePay", l = T("v4.gate.pay", "p", won(need)), sub = T("pd.cash", "c", won(S.cash)), dis = S.cash < need },
                new Opt { k = "gateSell", l = T("pd.sell"), sub = hv > 0 ? T("pd.sellSub", "v", won(hv)) : stockVal() > 0 ? T("v4.op.lock") : T("pd.sellNone"), dis = hv <= 0 || S.cash >= need },
                new Opt { k = "gatePart", l = T("v4.gate.part", "c", won(part)), sub = T("v4.gate.missSub", "s", won(need - part), "f", won(round1k((need - part) * R.V4_LATE_FEE)), "n", left), dis = part < 10000 || S.cash >= need },
                new Opt { k = "gateSkip", l = T("v4.gate.skip"), sub = T("v4.gate.missSub", "s", won(need), "f", won(round1k(need * R.V4_LATE_FEE)), "n", left) },
            };
        }
        /// 이자를 낸 뒤: 이번 주 원금 분납. 이미 상한 밑이면 바로 통과
        void gateStart(bool say = true)
        {
            double need = gatePrincipal();
            if (need <= 0) { gatePass(); return; }
            if (say) KIM(T("v4.gate.ask", "p", won(need), "cap", won(gateCap())) + (S.loanWeek > 0 && !gateLast() ? " " + T("v4.gate.askLoan", "l", won(S.loanWeek)) : ""));
            S.pending = new Pending("payday") { stage = "gate", due = need, opts = gateOpts(need) };
        }
        bool gateCmd(string ck)
        {
            var P = S.pending; var o = P.opts.FirstOrDefault(x => x.k == ck); if (o == null || o.dis) return false;
            double need = gatePrincipal();
            if (ck == "gatePay") { repay(need); gatePass(); return true; }
            if (ck == "gateSell") { double sv = stockValFree(); double t = closeAll(); t -= fireSale(sv); N(T("pd.sold", "t", sgnWon(t), "c", won(S.cash))); gateStart(false); return true; }
            if (ck == "gatePart") { double part = Math.Floor(Math.Min(S.cash, need) / 10000) * 10000; repay(part); gateMiss(need - part); return true; }
            if (ck == "gateSkip") { gateMiss(need); return true; }
            return false;
        }
        /// 통과: 미납 기록 지움 · 단계 +1 (증거금 상한 · 숏 · 대출) · 유물 하나 고르기
        void gatePass()
        {
            S.missN = 0; S.pending = null;
            bool last = absDay() >= R.V4_DAYS;
            if (last || S.debt <= 0) { S.loanWeek = 0; paydayEnd(); return; }
            bool loan0 = loanOk();
            S.gateTier++; S.loanWeek = 0;
            var ups = new List<string>();
            if (!loan0 && loanOk()) { ups.Add(T("v4.gate.upLoan")); Emit("unlock", "k", "loan"); }
            KIM(T("v4.gate.pass", "cap", won(gateCap(S.month + 1))));
            if (ups.Count > 0) { string x = string.Join(" · ", ups); pushK("kim", T("v4.gate.kim", "x", x)); toast(T("v4.gate.passT", "x", x), "good", "kakao", "kim"); }
            Emit("gate", "ok", true, "w", S.month, "tier", S.gateTier);
            after("paydayEnd");
            if (D.AUGS.Any(a => !has(a.id))) relicStart(T("v4.gate.relic"));
        }
        /// 미납: 못 낸 원금에 연체료. 연속 V4_MISS_MAX 번이면 만기 전에 끌려감 (만기 주는 결산으로)
        void gateMiss(double shortA)
        {
            S.missN++; S.pending = null; S.loanWeek = 0;
            double fee = round1k(shortA * R.V4_LATE_FEE);
            bool last = absDay() >= R.V4_DAYS;
            Emit("gate", "ok", false, "w", S.month, "short", shortA);
            if (last) { paydayEnd(); return; }
            if (fee > 0) addDebt(fee, T("lbl.gateLate"));
            stress(10);
            if (S.missN >= R.V4_MISS_MAX) { KIM(T("v4.gate.out")); ending("bad1"); return; }
            KIM(T("v4.gate.miss", "s", won(shortA), "f", won(fee)));
            pushK("kim", T("v4.gate.missK", "cap", won(gateCap(S.month + 1))));
            paydayEnd();
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
            dayBaseSet();   // 오늘 결과(정산 카드)의 기준점
            opWeek();       // 작전주: 주가 바뀌면 새로 뽑고, 아침마다 단계를 넘김
            if (buffTier() >= 1 && R.V4_BUFF_LUNCH > 0) { stress(-R.V4_BUFF_LUNCH); toast(T("v4.buff.lunch", "s", R.V4_BUFF_LUNCH), "good"); }   // 호감 버프: 도시락
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
            slotMark("date");
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
        /// v4 체력 삭제: 체력은 늘 가득 (깎이지 않음) — 화면도 숨김
        public bool hpOff => v4 && R.V4_NO_HP > 0;
        /// 알바 한 번의 스트레스 (연속 근무 가산 포함). v4: 알바별 배수 (상하차가 제일 힘듦) · 산삼주(체력 삭제 뒤) = 알바 스트레스 −30%
        public double workStress(Job J, int streak)
        {
            double b = S.rt ? R.RT_WORK_ST + R.RT_WORK_ST_STREAK * Math.Min(Math.Max(0, streak - 1), 4) : 5 + 2 * Math.Min(Math.Max(0, streak - 1), 4);
            if (!v4) return b;
            if (R.V4_JOB_ST != null && J != null && R.V4_JOB_ST.TryGetValue(J.id, out var m)) b *= m;
            if (hpOff && has("ginseng")) b *= 0.7;
            return rhu(b);
        }
        /// 집 '쉬기/자기' 버튼 부제 (화면용): 밤 = 푹 잠 + 내일 무료 리포트 보너스
        public string restHint() => !v4 ? null : hpOff ? (isEve() && R.V4_SLEEP_RSCH > 0 ? T("v4.rest.noHpEve", "s", -R.RT_REST_ST, "n", R.V4_SLEEP_RSCH) : T("v4.rest.noHp", "s", -R.RT_REST_ST)) : isEve()
            ? (R.V4_SLEEP_RSCH > 0 ? T("v4.rest.subEve", "h", R.RT_HP_REST_EVE + R.RT_HP_SLEEP, "n", R.V4_SLEEP_RSCH) : T("v4.rest.subEve0", "h", R.RT_HP_REST_EVE + R.RT_HP_SLEEP))
            : T("v4.rest.sub", "h", R.RT_HP_REST);
        void watchStart() { slotMark("watch"); S.pending = new Pending("watch") { n0 = S.st.invest }; Emit("watch"); }
        // ---------- 하루 계획판: 칸마다 한 일과 손익 (화면용 기록, 규칙에는 영향 없음) ----------
        int slotDayKey() => absDay() * 10 + S.part;
        void slotLogDayCheck()
        {
            if (S.slotLogDay == slotDayKey() && S.slotAct != null && S.slotAct.Length == R.SLOTS) return;
            // 날이 바뀜: 지난 기록은 '어제'로 넘기고 새 판
            if (S.slotAct != null && S.slotAct.Length == R.SLOTS && S.slotLogDay > 0) { S.slotActY = S.slotAct; S.slotNetY = S.slotNet; S.slotLogDayY = S.slotLogDay; }
            S.slotLogDay = slotDayKey(); S.slotAct = new string[R.SLOTS]; S.slotNet = new double[R.SLOTS];
        }
        bool slotYOk(int s) => v4 && S.slotActY != null && S.slotNetY != null && S.slotLogDayY == (absDay() - 1) * 10 + S.part && s >= 0 && s < S.slotActY.Length && s < S.slotNetY.Length;
        /// 어제 그 칸에 한 일 · 번 돈 (어제 기록이 없으면 null · 0)
        public string slotActYOf(int s) => slotYOk(s) ? S.slotActY[s] : null;
        public double slotNetYOf(int s) => slotYOk(s) ? S.slotNetY[s] : 0;
        public bool slotYHas() => slotYOk(0);
        void slotMark(string act) { if (!v4) return; slotLogDayCheck(); if (S.slot >= 0 && S.slot < R.SLOTS && S.slotAct[S.slot] == null) S.slotAct[S.slot] = act; }
        void slotOpen() { if (!v4) return; slotLogDayCheck(); S.slotLed0 = S.today.Count; S.slotReal0 = S.realized; }
        void slotClose()
        {
            if (!v4 || S.slot < 0 || S.slot >= R.SLOTS) return;
            slotLogDayCheck();
            double net = S.realized - S.slotReal0;
            for (int i = Math.Min(S.slotLed0, S.today.Count); i < S.today.Count; i++) { var x = S.today[i]; if (x.kind != "invest" && x.kind != "debt" && x.kind != "loan" && x.kind != "repay" && x.kind != "interest") net += x.amt; }
            S.slotNet[S.slot] = net;
        }
        /// 오늘 s 번째 칸에 한 일 (아직 안 했으면 null) · 그 칸의 손익 (끝난 칸만)
        public string slotActOf(int s) => v4 && S.slotLogDay == slotDayKey() && S.slotAct != null && s >= 0 && s < S.slotAct.Length ? S.slotAct[s] : null;
        public double slotNetOf(int s) => v4 && S.slotLogDay == slotDayKey() && S.slotNet != null && s >= 0 && s < S.slotNet.Length && s < S.slot ? S.slotNet[s] : 0;
        /// 계획판에서 바로 가기: 도착한 장소에서 예약해 둔 행동을 바로 함 (못 하는 행동이면 장소 화면에 머묾)
        void quickAct()
        {
            string k = S.quick; S.quick = null;
            if (string.IsNullOrEmpty(k) || S.pending?.t != "loc" || S.visit == null) return;
            var o = locOpts(S.visit.key).FirstOrDefault(x => x.k == k);
            if (o != null && !o.dis) act(k);
        }
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
            if (ev == null)
            {   // 조건 장면: 청산당한 날 밤 (하루 한 번, 이자일 저녁 빼고)
                if (isEve() && S.dayRes == "liq" && S.nightEvD != absDay() && S.day != R.MONTH_DAYS)
                {
                    var ne = D.EVENTS.FirstOrDefault(e => e.when == "liq" && (e.part == 0 || e.part == S.part));
                    if (ne != null) { S.nightEvD = absDay(); S.evT = Tnow(); evStart(ne); return true; }
                }
                return false;
            }
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
        /// 2부 판돈: 가진 돈이 V4_P2_CASH 보다 적으면 거기까지 채움 (빚 1억에 포함된 돈이라는 설정 — 굴릴 돈이 없으면 읽기 엔진이 안 돎)
        public void p2Seed()
        {
            double eq = S.cash + holdVal();   // 들고 넘어온 포지션·주식도 가진 돈 (현금만 비우고 판돈을 또 받는 수 방지)
            if (R.V4_P2_CASH <= 0 || eq >= R.V4_P2_CASH) return;
            S.cash += R.V4_P2_CASH - eq; pushK("kim", T("v4.p2.seed", "a", man(R.V4_P2_CASH - eq)));
        }
        bool part2Start()
        {
            S.part = 2; S.cleared = 0; S.ending = null; S.endInfo = null; S.pending = null; S.phase = "home";
            anSeed();   // 2부: 분석가 폼이 바뀜 (적중률을 다시 섞고 전적도 새로)
            S.ops.Clear(); S.opKey = 0; S.opFakeTk = null;   // 작전도 처음부터
            S.settleD = S.nightEvD = S.senseD = S.dayBase = 0; S.alertT = -1; S.dayRes = null;   // 날짜가 1일부터 다시 → 날짜 기준 표식도 처음으로
            S.month = 1; S.day = 1; S.slot = 0; S.min = R.RT_DAY0; S.owe = 0; S.paidMonth = 0; S.missN = 0; S.loanWeek = 0; S.sleepD = 0; S.earlyM = 0; S.chSeen = 0; S.prom = null; S.promBad = S.promDone = false; S.dateN = 0; S.wkGap.Clear(); S.heist = 0; S.heistGo = false;
            S.debt = R.V4_PART2_DEBT; S.st.maxDebt = Math.Max(S.st.maxDebt, S.debt); S.st.minDebt = S.debt;
            S.today = new List<Ledger>(); S.resume = null;
            p2Seed();
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
