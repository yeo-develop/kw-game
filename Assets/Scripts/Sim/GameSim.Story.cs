using System;
using System.Collections.Generic;
using System.Linq;

namespace KwGame.Sim
{
    // 스토리 "미래의 미래" (docs/BLUEPRINT_V3.md ③-b): 복학 통장 · 등록 마감 · 엄마가 아는지 · 말림/같이 탐 · 정해진 장면의 조건과 밀림.
    // 전부 v4 전용. 통장 규칙은 V4_FUND > 0 일 때만 (없으면 기능 전체가 꺼짐). 턴 모드(웹 골든)의 난수 흐름은 안 건드림.
    public partial class GameSim
    {
        bool fundRule => v4 && R.V4_FUND > 0;
        /// 통장이 한 번이라도 드러났거나 등록 결과가 있음 (부와 상관없이)
        bool fundSeen => fundRule && (fundHas || S.enroll != 0);
        /// 통장이 열렸나. 옛 저장은 새 필드가 0 · false 로 읽히므로(생성자를 안 거침) '안 열림'이 0 값이어야 한다
        bool fundHas => S.fundOpened || S.fund > 0;
        bool fundP1 => fundRule && S.part <= 1;

        // ---------- 화면이 쓰는 것 ----------
        /// 상태 줄을 보여 줄지: 1부이고 통장이 드러났거나 등록 결과가 있음
        public bool fundOn => fundSeen && S.part <= 1;
        /// 통장 잔액 (없으면 0)
        public double fundBal => fundOn && S.fund > 0 ? S.fund : 0;
        public double fundGoal() => R.V4_FUND;
        /// 등록 마감까지 남은 날 (당일 0 · 지났으면 −1)
        public int regDaysLeft() { int d = R.V4_REG_DAY - absDay(); return d < 0 ? -1 : d; }
        /// 판돈으로 탄 종목 id (없으면 null)
        public string fundBetTk => S?.fundBet?.tk;
        /// 상태 줄 한 줄. 통장이 없으면 null
        public string fundHud()
        {
            if (!fundOn) return null;
            if (S.enroll == 1) return T("v4.fund.hudReg");
            double b = Math.Max(0, S.fund); int n = regDaysLeft();
            if (S.enroll == 2 || n < 0) return T("v4.fund.hudLate", "b", man(b));
            if (n == 0) return T("v4.fund.hudToday", "b", man(b));
            if (b < R.V4_FUND) return T("v4.fund.hudShort", "b", man(b), "s", man(R.V4_FUND - b), "n", n);
            return T("v4.fund.hud", "b", man(b), "n", n);
        }
        /// 지금 채울 수 있는 돈 (못 채우면 0). cap > 0 이면 그만큼까지만 (10만 단위로 내림)
        public double fundRefillAmt(double cap = 0)
        {
            if (!fundP1 || S.enroll != 0 || !fundHas || S.fund >= R.V4_FUND || absDay() > R.V4_REG_DAY || S.fundBet != null) return 0;
            double need = R.V4_FUND - S.fund, have = Math.Floor(S.cash / 100000) * 100000;
            if (cap > 0) have = Math.Min(have, Math.Floor(cap / 100000) * 100000);
            double a = Math.Min(need, have);
            if (a < need && need < 100000 && S.cash >= need && (cap <= 0 || cap >= need)) a = need;   // 10만 미만 자투리(판돈 정산으로 생김)는 통째로
            return a >= 100000 || (a > 0 && a == need) ? a : 0;
        }

        // ---------- 통장 ----------
        void fundOpen(double amt)
        {
            if (!fundP1 || fundHas || amt <= 0) return;
            S.fund = amt; S.fundOpened = true;
            toast(T("v4.fund.new", "b", man(S.fund)), "good");
            Emit("fund", "k", "new", "v", S.fund);
        }
        /// 관문에서 모자란 돈 (현금 + 지금 팔 수 있는 보유분으로도 모자란 만큼)
        double fundShort(double need) => need - (S.cash + stockValFree() + coinVal());
        /// 관문에서 꺼내는 돈 = min(잔액, 모자람을 단위로 올림)
        double fundTake(double need)
        {
            double s = fundShort(need), u = R.V4_FUND_UNIT > 0 ? R.V4_FUND_UNIT : 1;
            if (!fundP1 || S.enroll == 1 || S.fund <= 0 || S.fundBet != null || s <= 0) return 0;
            return Math.Min(S.fund, Math.Ceiling(s / u) * u);
        }
        /// 관문 선택지 (1부 · 잔액이 있을 때만 목록에 들어감)
        Opt gateFundOpt(double need)
        {
            double take = fundTake(need);
            string sub = S.enroll == 1 ? T("v4.gate.fundReg") : take <= 0 ? T("v4.gate.fundNo")
                : T(absDay() <= R.V4_REG_DAY && S.enroll == 0 ? "v4.gate.fundSub" : "v4.gate.fundSubLate", "b", man(S.fund - take));
            return new Opt { k = "gateFund", l = T("v4.gate.fund", "a", man(take)), sub = sub, dis = take <= 0 };
        }
        void fundBreak(double need)
        {
            double take = fundTake(need); if (take <= 0) return;
            S.fund -= take; S.fundBrokeN++;
            money(take, "fund", T("lbl.fundBreak"));
            affD(R.V4_FUND_AFF); stress(R.V4_FUND_ST);
            KIM(T("v4.gate.fundKim"));
            M(fill(fpick(TA("v4.fund.break")), V("a", man(take), "b", man(S.fund))), "sad");
            Emit("fund", "k", "break", "d", take, "v", S.fund);
        }
        /// 명령 fund (k = "refill", amt = 선택: 이만큼까지만): 집에서 현금 → 통장. 칸을 안 씀
        bool fundCmd(string k, double cap)
        {
            if (k != "refill") return false;
            double a = fundRefillAmt(double.IsNaN(cap) ? 0 : cap); if (a <= 0) return false;
            money(-a, "fund", T("lbl.fundRefill")); S.fund += a;
            if (S.fund >= R.V4_FUND) pushK("m", fill(fpick(TA("v4.fund.refill")), V("b", man(S.fund))));
            Emit("fund", "k", "refill", "d", a, "v", S.fund);
            return true;
        }
        /// 등록: 통장에서 등록금이 학교로, 남는 돈은 현금으로
        void fundReg(string label)
        {
            if (!fundP1 || S.enroll != 0 || S.fund < R.V4_FUND) return;
            double left = S.fund - R.V4_FUND;
            if (left > 0) money(left, "fund", label);
            S.fund = 0; S.enroll = 1;
            Emit("fund", "k", "reg", "ok", true);
        }
        void fundNoReg()
        {
            if (!fundP1 || S.enroll != 0) return;
            S.enroll = 2;
            Emit("fund", "k", "reg", "ok", false);
        }
        /// 등록 마감 전에 빚을 다 갚음: 통장 + 현금으로 등록금이 되면 모자란 만큼 현금에서 채워 등록한 것으로
        void fundClearReg()
        {
            if (!fundP1 || S.enroll != 0 || !fundHas) return;
            fundBetSettle();
            if (S.fund + S.cash < R.V4_FUND) return;
            double gap = R.V4_FUND - S.fund;
            if (gap > 0) { money(-gap, "fund", T("lbl.fundRefill")); S.fund += gap; }
            fundReg(T("lbl.fundRefill"));
        }
        /// 같이 태움: 통장 전액이 판돈. 끌어올리는 중인 작전 종목이 있으면 그것, 없으면 열린 주식 하나에 돌발 매수 같은 충격
        void fundBetStart()
        {
            if (!fundP1 || S.fund <= 0 || S.fundBet != null || S.enroll != 0) return;
            var op = opOn ? S.ops.FirstOrDefault(o => o.ph == 2 && tkOpen(o.tk)) : null;
            string tk = op?.tk;
            if (tk == null)
            {
                var cands = STK().Where(k => tkOpen(k) && !D.TK[k].inv && !opLocked(k)).ToList();
                if (cands.Count == 0) return;
                tk = cands[(int)Math.Floor(rnd() * cands.Count)];
                bool up = rnd() < 0.5; double mag = 0.12 + rnd() * 0.18;
                addShock(Tnow(), tk, (up ? 1 : -1) * mag);
            }
            S.fundBet = new FundBet { tk = tk, p0 = S.mk.tk[tk].p, amt = S.fund, T = Tnow() };
            S.fundBrokeN++;
            pushF("🛒", T("lbl.fundBet") + " · " + D.TK[tk].name, "money");
        }
        /// 칸이 끝날 때 판돈 정산 (실제 보유 · 현금은 안 건드림)
        void fundBetSettle()
        {
            var b = S.fundBet; if (!v4 || b == null) return;
            S.fundBet = null;
            double px = S.mk.tk.Has(b.tk) ? S.mk.tk[b.tk].p : b.p0;
            double nv = Math.Max(0, round1k(b.amt * px / Math.Max(1e-9, b.p0))), d = nv - b.amt;
            S.fund = nv;
            string x = T(d > 0 ? "v4.fund.betWin" : "v4.fund.betLose", "b", man(nv));
            pushK("m", x); toast(x, d > 0 ? "good" : "liq", "kakao", "m");
            Emit("fund", "k", "bet", "d", d, "v", S.fund, "tk", b.tk);
        }

        // ---------- 아침 · 하루 끝 ----------
        /// v4Morning 끝: 통장 안전망 · 욕심 단계 카톡 · 등록 마감 알림
        void storyMorning()
        {
            if (fundP1 && !fundHas && S.enroll == 0 && absDay() > R.V4_FUND_DAY + R.V4_EV_LATE && absDay() <= R.V4_REG_DAY) fundOpen(R.V4_FUND);   // 장면을 놓쳤거나 옛 저장
            if (fundP1 && S.enroll == 0 && S.fund >= R.V4_FUND) { int n = regDaysLeft(); if (n == 3 || n == 1) pushK("m", fill(fpick(TA("v4.fund.remind")), V("n", n))); }
        }
        /// 욕심 단계 카톡 키 (문턱이 없으면 null = 예전 동작)
        string greedKey()
        {
            var G = R.V4_GREED_STEPS; if (G == null || G.Length < 3) return null;
            return S.greed >= G[2] ? (S.heist >= 1 ? "v4.greedHeist" : "v4.greedK3") : S.greed >= G[1] ? "v4.greedK2" : S.greed >= G[0] ? "v4.greedK" : "";
        }
        void storyDayEnd()
        {
            if (fundP1 && absDay() >= R.V4_REG_DAY && S.enroll == 0 && fundHas) fundNoReg();
        }

        // ---------- 장면 ----------
        /// 장면 조건 (날짜 장면 · 엄마 돌발에서 씀). liq · fundAsk 같은 조건 장면 키는 여기선 거짓
        bool whenOk(string w)
        {
            switch (w)
            {
                case null: return true;
                case "momKnows": return S.momKnows;
                case "momNot": return !S.momKnows;
                case "fundOk": return S.fund >= R.V4_FUND && S.enroll == 0;
                case "fundBroken": return fundHas && S.fund < R.V4_FUND && S.enroll == 0;
                case "calm": return S.calmN > S.rideN;
                case "ride": return S.rideN >= S.calmN;
                case "regYes": return S.enroll == 1;
                case "regNo": return S.enroll != 1;
                default: return false;
            }
        }
        static string evKey(EvDef e, int part) => (e.grp ?? e.id) + "@" + part;
        /// 오늘 띄울 날짜 장면: 정해진 날부터 V4_EV_LATE 일 안 (칸 조건은 그대로). 여럿이면 날짜가 이른 것부터
        EvDef storyDue()
        {
            int ad = absDay(), late = Math.Max(0, R.V4_EV_LATE);
            return D.EVENTS.Where(e => e.day > 0 && e.day <= ad && ad - e.day <= late && (e.part == 0 || e.part == S.part) && (e.slots == null || e.slots.Contains(S.slot)) && S.heist >= e.heistMin && whenOk(e.when) && !S.evSeen.Contains(evKey(e, S.part)))
                .OrderBy(e => e.day).FirstOrDefault();
        }
        bool fundAskOk()
        {
            var G = R.V4_GREED_STEPS;
            return fundP1 && G != null && G.Length >= 3 && S.fund >= R.V4_FUND && S.enroll == 0 && S.greed >= G[2] && !weekend() && stockOpen() && absDay() < R.V4_REG_DAY
                && S.fundAskW != S.part * 10 + S.month && S.fundBet == null;
        }
        /// 조건 장면 "등록금으로 딱 한 번만" (날짜 장면이 없을 때만). 띄웠으면 true
        bool fundAskCheck()
        {
            if (!fundAskOk()) return false;
            var fe = D.EVENTS.FirstOrDefault(e => e.when == "fundAsk" && (e.part == 0 || e.part == S.part) && (e.slots == null || e.slots.Contains(S.slot)));
            if (fe == null) return false;
            S.fundAskW = S.part * 10 + S.month; S.evT = Tnow();
            evStart(fe);
            return true;
        }
        /// 이번 주 작전 종목 이름 (없으면 씨앗 해시로 고른 상장 주식). 장면 대사의 {n}
        string storyTkName()
        {
            int key = S.part * 10 + S.month;
            var op = S.ops.FirstOrDefault(o => o.key == key && D.TK.ContainsKey(o.tk));
            if (op != null) return D.TK[op.tk].name;
            var L = STK().Where(k => tkOpen(k) && !D.TK[k].inv).ToList();
            if (L.Count == 0) L = STK().ToList();
            return L.Count == 0 ? "" : D.TK[L[(int)Math.Min(L.Count - 1, Math.Floor(hashU(key * 389 + 401) * L.Count))]].name;
        }
        /// 장면 문구 자리표시자: {n} = 이번 주 작전 종목 · {b} = 통장 잔액 (v4 만)
        string storyFill(string x)
        {
            if (!v4 || x == null || x.IndexOf('{') < 0) return x;
            if (x.Contains("{n}")) x = x.Replace("{n}", storyTkName());
            if (x.Contains("{b}")) x = x.Replace("{b}", man(Math.Max(0, S.fund)));
            return x;
        }
        /// 돌발 이벤트 when · maxDay: when 은 엄마 갈래만 판정해서 통과 (그 밖의 when 은 조건 장면이라 돌발 풀에서 뺌)
        bool evWhenFits(EvDef e) => (e.when == null || ((e.when == "momKnows" || e.when == "momNot") && whenOk(e.when))) && (e.maxDay <= 0 || absDay() <= e.maxDay);
        /// fundFill 선택지에 필요한 현금 (= 등록금 − 잔액)
        double fundFillNeed() => Math.Max(0, R.V4_FUND - Math.Max(0, S.fund));
        /// 선택지 고른 뒤: 말림/같이 탐은 고른 선택지(o) 기준, 엄마는 실제로 적용된 쪽(r) 기준
        void storyPick(EvDef ev, EvOpt o, EvOpt r)
        {
            if (!v4) return;
            S.calmN += Math.Max(0, o.calm); S.rideN += Math.Max(0, o.ride);
            if (r.mom > 0 && !S.momKnows) { S.momKnows = true; Emit("mom", "knows", true); }
            if (!fundRule) return;
            if (o.fund > 0) fundOpen(o.fund);
            if (o.fundFill > 0 && fundP1 && S.enroll == 0 && fundHas)
            {
                double a = fundFillNeed();
                if (a > 0 && S.cash >= a) { money(-a, "fund", T("lbl.fundRefill")); S.fund += a; Emit("fund", "k", "refill", "d", a, "v", S.fund); }
            }
            if (o.reg == 1) fundReg(ev.title); else if (o.reg == 2) fundNoReg();
            if (o.fundBet > 0) fundBetStart();
        }
        /// 엔딩 그림 단서: 졸업식을 보는 판
        public bool endGrad() => S.endInfo?.grad ?? false;
    }
}
