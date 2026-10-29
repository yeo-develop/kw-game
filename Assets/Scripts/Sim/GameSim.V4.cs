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
        public int daysLeft() => Math.Max(0, R.V4_DAYS - absDay());
        /// 2부는 빚 1억 → 한도·상한·만기 판정도 같은 비율로
        public double debtScale() => v4 && S.part > 1 ? R.V4_PART2_DEBT / R.DEBT0 : 1;
        public double debtStart() => R.DEBT0 * debtScale();
        public bool locHidden(string id) => v4 && R.V4_HIDE_LOCS != null && R.V4_HIDE_LOCS.Contains(id);
        /// 칸 남은 시간 (v4: 행동 하나 = 칸 하나)
        int slotLeft() => Math.Max(1, slotEndMin(S.slot) - S.min);

        void affD(double d)
        {
            if (!v4 || d == 0) return;
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
            bool kept = !S.promBad && (p.@do == null || S.promDone);
            if (kept) { affD(R.V4_PROM_OK); stress(-5); pushK("m", p.endOk); }
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
            if (S.greed >= 60) pushK("m", fpick(TA("v4.greedK")));
        }
        void v4DayEnd()
        {
            if (!v4) return;
            promJudge();
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
            promHit("date");
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

        // ---------- 엔딩 ----------
        /// 만기(28일째 이자일 뒤)에 빚이 남았을 때: 빚 절반 이하 + 호감 → 같이 원양어선 · 절반 넘음 + 호감 아주 높음(V4_AFF_HEIST) → 미래가 김사장 털기 · 나머지 → 혼자 끌려감
        void maturityEnd()
        {
            kim(false);
            N(T("v4.maturityN", "d", won(S.debt)));
            ending(S.aff >= R.V4_AFF_HEIST && S.greed >= R.V4_GREED_HEIST && S.debt > debtStart() * 0.5 ? "heist" : "bad1");
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
            else if (kind == "bad1" && absDay() >= R.V4_DAYS && S.debt <= debtStart() * 0.5)
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
            S.month = 1; S.day = 1; S.slot = 0; S.min = R.RT_DAY0; S.owe = 0; S.paidMonth = 0; S.chSeen = 0; S.prom = null; S.dateN = 0;
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
