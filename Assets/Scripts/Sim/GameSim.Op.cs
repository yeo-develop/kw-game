using System;
using System.Collections.Generic;
using System.Linq;

namespace KwGame.Sim
{
    /// 작전 하나: 세력이 주식 하나에 붙어 매집 → 끌어올리기 → 설거지(또는 조용히 식음). docs/BLUEPRINT_V3.md ①②
    public class Op
    {
        public string tk; public int key;             // key = 부 × 10 + 주차
        public int accDay, pumpDay;                   // 주 안의 날(1~5): 매집 시작 · 끌어올리기 시작
        public double cap;                            // 열기 상한 (숨김). 닿으면 더 안 오르고 다음 칸부터 식음
        public double heat, heatPrev;                 // 숨은 열기 · 한 봉 전 값 (온도계는 한 봉 늦게 봄)
        public int ph;                                // 0 대기 · 1 매집 · 2 끌어올리기 · 3 식는 중 · 4 설거지(하한가 잠김) · 5 끝
        public double basePx;                         // 끌어올리기 시작가 (식으면 여기로 되돌아감)
        public int bar = int.MinValue;                // 마지막으로 열기를 갱신한 봉
        public int planT = int.MinValue, dumpMin = -1, preMin = -1, fakeMin = -1;   // 이번 칸 계획: 설거지 · 전조 · 헛전조 시각(분). 없으면 -1
        public int lockDay; public double gap;        // 잠김이 풀리는 날(absDay) · 그날 시가 갭
        public double barAmt; public int barAmtAt = int.MinValue;   // 이번 봉에 내가 사고판 금액 (미끄러짐 누적)
    }

    // 작전주: 분석가 읽기와 별개인 두 번째 읽을거리. 사람이 몰릴수록(열기↑) 팔기는 쉬워지는데 설거지는 가까워진다.
    // 뽑기는 전부 씨앗 해시(hashU) — rng 흐름을 안 건드림. 관문 규칙 + 실시간에서만 켜짐 (턴 모드 · 골든과 무관).
    public partial class GameSim
    {
        public bool opOn => gateOn && S.rt && R.V4_OP > 0;
        int opIdx(string k) => D.TKList.FindIndex(t => t.id == k) + 1;
        /// 지금 살아 있는 작전 (매집~잠김). 없으면 null
        public Op opOf(string k) => !opOn ? null : S.ops.FirstOrDefault(o => o.tk == k && o.ph >= 1 && o.ph <= 4);
        /// 설거지당해 하한가에 붙어 있는 동안 (그날 장 끝까지) — 매도 불가
        public bool opLocked(string k) { var o = opOf(k); return o != null && o.ph == 4 && absDay() < o.lockDay; }
        int firstStockSlot() { for (int s = 0; s < R.SLOTS; s++) if (slotEndMin(s) > R.RT_STOCK[0]) return s; return 0; }
        int lastStockSlot() { for (int s = R.SLOTS - 1; s >= 0; s--) if (slotStartMin(s) < R.RT_STOCK[1]) return s; return 0; }
        int nextTradeDay() { int d = absDay() + 1; while (v4 && ((d - 1) % R.MONTH_DAYS) + 1 > R.V4_WEEKDAYS) d++; return d; }
        double opUp(int bk, int idx) { var U = R.V4_OP_UP; return U[0] + hashU(bk * 37 + idx * 11 + 103) * (U[1] - U[0]); }
        double opInc(int bk, int idx) { var H = R.V4_OP_HEAT; return H[0] + hashU(bk * 41 + idx * 13 + 107) * (H[1] - H[0]); }
        /// 설거지 확률(봉당): 열기 V4_OP_HZ0 이하 0, 그 위로 제곱으로 오름
        public double opHazard(double heat) => heat <= R.V4_OP_HZ0 ? 0 : R.V4_OP_HZ * Math.Pow((heat - R.V4_OP_HZ0) / (100 - R.V4_OP_HZ0), 2);

        // ---------- 주 · 날 ----------
        /// 주가 바뀌면 이번 주 작전을 뽑음 (아침마다 호출). 대상 = 그 주 월요일에 상장돼 있는 후보 주식
        void opWeek()
        {
            if (!opOn) return;
            int key = S.part * 10 + S.month;
            if (S.opKey != key)
            {
                S.opKey = key;
                S.ops.RemoveAll(o => o.ph != 4);   // 지난 주 것 정리 (잠긴 건 풀릴 때까지 남김)
                S.opFakeTk = null; S.opFakeDay = 0;
                var W = R.V4_OP_WEEK; int n = W != null && S.month >= 1 && S.month <= W.Length ? W[S.month - 1] : 0;
                if (n > 0 && S.day <= 2)   // 주 중간에 들어온 판(옛 저장)은 이번 주를 건너뜀
                {
                    var cands = (R.V4_OP_TK ?? new string[0]).Where(k => D.TK.ContainsKey(k) && D.TK[k].IsStock && !D.TK[k].inv && tkOpen(k) && !S.mk.tk[k].warn && S.ops.All(o => o.tk != k)).ToList();
                    for (int i = 0; i < n && cands.Count > 0; i++)
                    {
                        int j = (int)Math.Floor(hashU(key * 7919 + i * 131 + 3) * cands.Count); string tk = cands[j]; cands.RemoveAt(j);
                        int acc = S.day + (int)Math.Floor(hashU(key * 6151 + i * 17 + 5) * 2);    // 월 또는 화
                        int len = 1 + (int)Math.Floor(hashU(key * 4051 + i * 29 + 7) * 2);        // 매집 1~2일
                        var C = R.V4_OP_CAP;
                        S.ops.Add(new Op { tk = tk, key = key, accDay = acc, pumpDay = Math.Min(R.V4_WEEKDAYS - 1, acc + len), cap = C[0] + hashU(key * 3301 + i * 37 + 11) * (C[1] - C[0]) });
                    }
                    // 가짜 매집: 다른 후보 하나가 하루 동안 거래량만 오름 (거래량이 오른다고 다 작전은 아님)
                    if (cands.Count > 0 && hashU(key * 2203 + 13) < R.V4_OP_FAKE) { S.opFakeTk = cands[(int)Math.Floor(hashU(key * 1709 + 19) * cands.Count)]; S.opFakeDay = 1 + (int)Math.Floor(hashU(key * 1301 + 23) * R.V4_WEEKDAYS); }
                }
            }
            opDay();
        }
        /// 아침: 단계 넘기기
        void opDay()
        {
            int key = S.part * 10 + S.month;
            foreach (var o in S.ops)
            {
                if (o.ph == 4 && absDay() > o.lockDay) o.ph = 5;                        // 풀린 날(갭으로 시작)이 지나면 끝
                if (o.key != key || o.ph >= 4) continue;
                if (weekend()) { if (o.ph >= 1) o.ph = 5; continue; }                   // 주말엔 세력도 쉼 (금요일 막봉에 이미 던졌거나 식었음)
                if (o.ph == 0 && S.day >= o.accDay) o.ph = 1;
                if (o.ph == 1 && S.day >= o.pumpDay) { o.ph = 2; o.basePx = S.mk.tk[o.tk].p; o.heat = o.heatPrev = 0; o.bar = int.MinValue; }
            }
        }

        // ---------- 칸 계획 (planMarket 이 작전 종목에 대해 호출) ----------
        /// 이번 칸의 등락(시가 대비) + 경유점 + 설거지·전조 시각. 속보·리포트 충격은 호출한 쪽이 그 위에 더함
        double opSlotR(Op o, Ticker t, TkState s, MarketPlan P)
        {
            int T = Tnow(); var (a, b) = rtWindow(t, S.slot); int idx = opIdx(t.id);
            o.planT = T; o.dumpMin = o.preMin = o.fakeMin = -1;
            if (b <= a) return 0;   // 장이 안 열리는 칸 (밤 · 주말)
            double so = s.sT == T && s.so > 0 ? s.so : s.p;   // 칸 시가 (칸 중간에 다시 짜는 경우엔 이미 잡힌 시가)
            if (o.ph == 1) return (hashU(T * 977 + idx) - 0.5) * 0.02;
            if (o.ph == 3)
            {   // 식는 중: 칸마다 매집가 쪽으로 절반씩, 거의 다 왔으면 끝
                double back = o.basePx / so - 1;
                if (Math.Abs(back) < 0.02) { o.ph = 5; return back; }
                return back * 0.5;
            }
            if (o.ph == 4)
            {   // 잠김: 그날은 하한가에 붙어 있고, 풀리는 날 첫 장에 갭으로 한 번 더 내림
                if (absDay() == o.lockDay && S.slot == firstStockSlot()) { P.way[t.id] = new[] { 0.04, Math.Log(1 - o.gap) }; return -o.gap; }
                return 0;
            }
            if (o.ph != 2) return 0;
            // 끌어올리기: 봉마다 오르고 열기가 쌓임. 상한에 닿은 칸은 거기서 멈추고 다음 칸부터 식음
            if (o.heat >= o.cap) { o.ph = 3; return opSlotR(o, t, s, P); }
            int C = R.RT_CANDLE, i0 = Math.Max(0, (S.min - a) / C), nb = (int)Math.Ceiling((b - a) / (double)C);
            double heat = o.heat, x = Math.Log(s.p / so); int stall = -1, dump = -1;
            bool friEnd = S.day >= R.V4_WEEKDAYS && S.slot == lastStockSlot();
            for (int i = i0; i < nb; i++)
            {
                int bk = absDay() * 1000 + (a + i * C) / C;
                if (hashU(bk * 31 + idx * 7 + 101) < opHazard(heat) || (friEnd && i == nb - 1 && heat > R.V4_OP_HZ0)) { dump = i; break; }   // 금요일 막봉: 세력은 주말을 넘기지 않음
                if (heat >= o.cap) { if (stall < 0) stall = i; continue; }
                x += Math.Log(1 + opUp(bk, idx)); heat = Math.Min(o.cap, heat + opInc(bk, idx));
            }
            if (dump >= 0)
            {
                int d0 = a + dump * C, d1 = Math.Min(b, d0 + C) - 1;
                o.dumpMin = Math.Max(S.min, d0 + (int)Math.Floor(hashU(T * 53 + idx * 17 + 109) * Math.Max(1, d1 - d0)));
                if (hashU(T * 59 + idx * 19 + 113) < R.V4_OP_PRE) { int pm = o.dumpMin - 10 - (int)Math.Floor(hashU(T * 61 + idx * 23 + 127) * 11); if (pm > Math.Max(a, S.min)) o.preMin = pm; }
                double ud = clamp((o.dumpMin - a) / (double)(b - a), 0.02, 0.98);
                P.way[t.id] = new[] { ud, x };   // 설거지 직전까지 오르던 길 (그 뒤는 opDump 가 하한가로)
            }
            else if (stall >= 0) P.way[t.id] = new[] { clamp(stall * C / (double)(b - a), 0.02, 0.98), x };   // 상한에 닿은 뒤로는 제자리
            // 헛전조: 설거지가 없는 칸(또는 한참 전)에 가끔 같은 띠가 뜸
            if (hashU(T * 67 + idx * 29 + 131) < R.V4_OP_FAKEPRE)
            {
                int fm = Math.Max(a, S.min) + 5 + (int)Math.Floor(hashU(T * 71 + idx * 31 + 137) * Math.Max(1, b - Math.Max(a, S.min) - 10));
                if (o.dumpMin < 0 || fm < o.dumpMin - 30) o.fakeMin = fm;
            }
            return Math.Exp(x) - 1;
        }

        // ---------- 1분마다 (clockRun) ----------
        void opTick(MarketPlan P)
        {
            if (!opOn || S.ops.Count == 0) return;
            int m = S.min - 1;   // 방금 지난 1분
            foreach (var o in S.ops)
            {
                if (o.ph != 2 && o.ph != 3) continue;
                var t = D.TK[o.tk]; var (a, b) = rtWindow(t, S.slot);
                if (m < a || m >= b) continue;
                int bk = absDay() * 1000 + m / R.RT_CANDLE;
                if (o.bar != bk)
                {
                    o.bar = bk; o.heatPrev = o.heat;
                    if (o.ph == 2) { if (o.heat < o.cap) o.heat = Math.Min(o.cap, o.heat + opInc(bk, opIdx(o.tk))); }
                    else o.heat = Math.Max(0, o.heat - 4);
                }
                if (o.ph != 2 || o.planT != Tnow()) continue;
                if ((m == o.preMin || m == o.fakeMin) && S.pending?.t == "watch")
                {   // 전조는 장을 보고 있을 때만 보임 (알바 중엔 안 옴). 진짜와 헛것은 같은 모양
                    string x = T("v4.op.pre", "n", t.name);
                    pushF("📉", x, "news"); toast(x, "liq", "news", "op"); Emit("opPre", "tk", o.tk, "n", t.name);
                }
                if (o.dumpMin >= 0 && m >= o.dumpMin) opDump(o, P);
            }
        }
        void opDump(Op o, MarketPlan P)
        {
            var t = D.TK[o.tk]; var s = S.mk.tk[o.tk];
            double fl = s.ref0 > 0 ? s.ref0 * (1 - R.RT_LIMIT) : s.p * (1 - R.RT_LIMIT);
            double from = s.p; var G = R.V4_OP_GAP;
            o.ph = 4; o.lockDay = nextTradeDay(); o.gap = G[0] + hashU(absDay() * 73 + opIdx(o.tk) * 37 + 139) * (G[1] - G[0]); o.dumpMin = -1;
            rtMove(s, fl, absDay(), S.min - 1, R.V4_OP_VOL_DUMP);
            if (P != null && s.so > 0) { P.r[o.tk] = fl / s.so - 1; P.way.Remove(o.tk); P.jmp.Remove(o.tk); }
            bool hold = S.hold.Has(o.tk);
            string x = T("v4.op.dump", "n", t.name, "p", pct(fl / from - 1));
            pushF("🚨", x, "news"); toast(x, "liq", "news", "op");
            if (hold) { face("panic"); S.opHit++; }
            Emit("opDump", "tk", o.tk, "n", t.name, "r", fl / from - 1, "hold", hold);
        }
        /// 잠긴 종목은 하한가에 고정 (잡음으로 떨어져 나와 팔리는 일 없게)
        bool opPinned(string k, out double px)
        {
            px = 0; if (!opLocked(k)) return false;
            var s = S.mk.tk[k]; px = s.p; return true;
        }

        // ---------- 화면 · 봇이 읽는 것 ----------
        /// 주갤 온도계 (0~100): 숨은 열기를 한 봉 늦게, ±8 흔들려서 봄. 작전이 없는 종목은 바닥에서 흔들림
        public double opTemp(string k)
        {
            if (!opOn) return 0;
            int bk = absDay() * 1000 + S.min / R.RT_CANDLE, idx = opIdx(k);
            double noise = (hashU(bk * 43 + idx * 41 + 149) - 0.5) * 2 * R.V4_OP_TEMP_NOISE;
            var o = opOf(k);
            double h = o == null ? 6 : o.ph == 1 ? 8 : o.ph == 4 ? 15 : o.heatPrev;
            return clamp(h + noise, 0, 100);
        }
        /// 그 봉의 거래량 (평소 = 1). 평소에도 흔들리고, 매집 · 끌어올리기 · 가짜 매집 때 커짐
        public double opVol(string k, int day, int m, MarketState M = null)
        {
            int bk = day * 1000 + m / R.RT_CANDLE, idx = opIdx(k);
            double v = 0.6 + hashU(bk * 47 + idx * 43 + 151);
            if (!opOn || (M != null && M != S.mk)) return v;
            var o = opOf(k); double u = hashU(bk * 53 + idx * 47 + 157);
            if (o != null && o.ph == 1) { var A = R.V4_OP_VOL_ACC; v *= A[0] + u * (A[1] - A[0]); }
            else if (o != null && o.ph == 2) { var B = R.V4_OP_VOL_PUMP; v *= B[0] + (B[1] - B[0]) * clamp(o.heat / 100, 0, 1) * (0.7 + 0.6 * u); }
            else if (o != null && o.ph == 3) v *= 1.5;
            else if (S.opFakeTk == k && S.opFakeDay == S.day && !weekend() && S.opKey == S.part * 10 + S.month) { var A = R.V4_OP_VOL_ACC; v *= A[0] + u * (A[1] - A[0]); }
            return v;
        }
        /// 지금 봉의 거래량 배수 (화면 · 봇)
        public double volNow(string k) { var h = S.mk.tk[k].hist; return h.Count > 0 && h[h.Count - 1].v > 0 ? h[h.Count - 1].v : 1; }
        /// 최근 n봉 평균 거래량 배수
        public double volAvg(string k, int n) { var h = S.mk.tk[k].hist; if (h.Count == 0) return 1; double a = 0; int c = 0; for (int i = Math.Max(0, h.Count - n); i < h.Count; i++) { a += h[i].v > 0 ? h[i].v : 1; c++; } return c > 0 ? a / c : 1; }

        // ---------- 미끄러짐: 작전 종목은 한 번에 많이 사고팔수록 값이 나빠짐 ("파는 게 어렵다") ----------
        /// 이 주문의 체결가 손해 비율 (0~V4_OP_SLIP_MAX). peek = 미리 보기(누적 안 함)
        public double opSlip(string k, double amt, bool peek = false)
        {
            var o = opOf(k); if (o == null || o.ph > 3 || amt <= 0) return 0;
            int bk = absDay() * 1000 + S.min / R.RT_CANDLE;
            double turn = (R.V4_OP_TURN_TK != null && R.V4_OP_TURN_TK.TryGetValue(k, out var tv) ? tv : R.V4_OP_TURN) * volNow(k);
            double cum = (o.barAmtAt == bk ? o.barAmt : 0) + amt;
            if (!peek) { o.barAmt = cum; o.barAmtAt = bk; }
            return Math.Min(R.V4_OP_SLIP_MAX, R.V4_OP_SLIP * cum / Math.Max(1, turn));
        }
        /// 주식을 지금 못 파는 이유 (화면용). 팔 수 있으면 null
        public string sellLockWhy(string k) => opLocked(k) ? T("v4.op.lock") : null;
    }
}
