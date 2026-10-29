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
        public int daysLeft() => Math.Max(0, R.V4_DAYS - absDay());
        /// 2부는 빚 1억 → 한도·상한·만기 판정도 같은 비율로
        public double debtScale() => v4 && S.part > 1 ? R.V4_PART2_DEBT / R.DEBT0 : 1;
        public double debtStart() => R.DEBT0 * debtScale();
        public bool locHidden(string id) => v4 && R.V4_HIDE_LOCS != null && R.V4_HIDE_LOCS.Contains(id);
        /// 국장 주문 가능: v4 는 장 보기 칸에서만 (행동 → 소재 → 본 행동). 코인은 어디서나
        public bool stockTradeOk() => stockOpen() && (!v4 || S.pending?.t == "watch");
        /// 칸 시작 속보: 이번 칸 시세에 들어갈 뉴스를 먼저 보여 줌 (가짜일 수도). STONKS 식 '뉴스 보고 판단'
        void newsFlash()
        {
            var n = S.news; if (!v4 || n == null || S.nflashT == Tnow()) return;
            S.nflashT = Tnow();
            pushF("🚨", T("v4.newsFlash", "h", n.h), "news"); toast(T("v4.newsFlash", "h", n.h), "news", "news");
        }
        /// 장별 뉴스 방향 편향 (국면 = 확률). 좋은 뉴스가 나올 확률
        int newsDir() => rnd() < R.V4_CH_NEWSUP[chapter() - 1] ? 1 : -1;
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
                Emit("prom");
            }
            else if (p.@do == kind && !S.promDone)
            {
                S.promDone = true;
                pushK("m", p.okK); toast(T("v4.promOkT", "a", p.hud), "good", "kakao", "m");
                Emit("prom");
            }
        }
        /// 자정: 부탁 판정 → 호감·스트레스
        void promJudge()
        {
            var p = promNow(); if (p == null) return;
            if (p.avoid == "coin" && S.cps.Count > 0) S.promBad = true;   // 코인 금지 = 자정에 들고 있어도 어김
            bool kept = !S.promBad && (p.@do == null || S.promDone);
            if (kept) { affD(p.@do != null ? R.V4_PROM_OK : R.V4_PROM_OK / 2); stress(-5); pushK("m", p.endOk); }   // 하지 마 부탁은 가만있어도 지켜지니 절반
            else { affD(R.V4_PROM_BAD); stress(10); pushK("m", p.endBad); }
            S.prom = null;
        }

        // ---------- 아침 · 하루 끝 ----------
        void v4Morning()
        {
            if (!v4) return;
            greedD(-R.V4_GREED_DECAY);
            int key = S.part * 10 + chapter();
            if (S.day == 1 && S.chSeen != key) { S.chSeen = key; Emit("story", "key", (S.part > 1 ? "p2ch" : "ch") + chapter()); }
            promPick();
            if (S.greed >= R.V4_GREED_HEIST) pushK("m", fpick(TA("v4.greedK2")));        // 털기 문턱 넘음
            else if (S.greed >= R.V4_GREED_HEIST - 15) pushK("m", fpick(TA("v4.greedK")));   // 슬슬
        }
        void v4DayEnd()
        {
            if (!v4) return;
            promJudge();
            if (S.dateN == 0) affD(-R.V4_AFF_DECAY);   // 하루 종일 안 놀아 주면 식음
            S.dateN = 0;
        }

        // ---------- 집 행동 ----------
        /// 미래랑 놀기: 칸 하나. 같은 날 두 번째부턴 호감 조금만
        void dateHome()
        {
            S.dateN++;
            affD(S.dateN == 1 ? R.V4_DATE_AFF : 2);
            stress(R.V4_DATE_ST); hp(5, T("why.date"));
            S.workStreak = 0;
            face("happy");
            M(fpick(TA(S.aff >= R.V4_AFF_GOOD ? "v4.dateHi" : "v4.dateLo")), "happy");
            hideDlg();
            promHit("date"); if (isEve()) promHit("datenight");
            S.actMin = slotLeft(); slotUsed();
        }
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
            var ev = D.EVENTS.FirstOrDefault(e => e.day == absDay() && (e.part == 0 || e.part == S.part) && (e.slots == null || e.slots.Contains(S.slot)) && !S.evSeen.Contains(e.id + "@" + S.part));
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
        /// 만기(28일째 이자일 뒤)에 빚이 남았을 때: 빚 V4_DUO_DEBT(60%) 이하 + 호감 → 같이 원양어선 · 그보다 많음 + 호감·욕심 아주 높음(V4_AFF_HEIST·V4_GREED_HEIST) → 미래가 김사장 털기 · 나머지 → 혼자 끌려감
        void maturityEnd()
        {
            kim(false);
            N(T("v4.maturityN", "d", won(S.debt)));
            ending(S.aff >= R.V4_AFF_HEIST && S.greed >= R.V4_GREED_HEIST && S.debt > debtStart() * R.V4_DUO_DEBT ? "heist" : "bad1");
        }
        /// ending() 끝에서 v4 변형 덮어쓰기
        void v4EndVariant(string kind, ref string variant, ref string lead)
        {
            if (!v4) return;
            bool good = S.aff >= R.V4_AFF_GOOD;
            var v = V("debt", won(S.debt), "aff", S.aff, "d", absDay(), "p", S.part);
            if (kind == "clear")
            {
                if (variant == "gamble" || variant == "rich") { if (!good) { variant = "lonely"; lead = T("v4.end.lonely", v); } return; }
                variant = good ? "true" : "lonely";
                lead = T(good ? (S.part > 1 ? "v4.end.true2" : "v4.end.true") : "v4.end.lonely", v);
            }
            else if (kind == "bad1" && absDay() >= R.V4_DAYS && S.debt <= debtStart() * R.V4_DUO_DEBT)
            {
                variant = good ? "duo" : "sea";
                lead = T(good ? "v4.end.duo" : "v4.end.half", v);
            }
            else if (kind == "heist") lead = T("v4.end.heist", v);
        }

        // ---------- 2부 (B안: 아빠의 차용증) ----------
        bool part2Start()
        {
            S.part = 2; S.cleared = 0; S.ending = null; S.endInfo = null; S.pending = null; S.phase = "home";
            S.month = 1; S.day = 1; S.slot = 0; S.min = R.RT_DAY0; S.owe = 0; S.paidMonth = 0; S.chSeen = 0; S.prom = null; S.promBad = S.promDone = false; S.dateN = 0; S.wkGap.Clear();
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
