using System;
using System.Collections.Generic;
using System.Linq;

namespace KwGame.Sim
{
    // tips.js — 정보(팁): 출처 적중률로 진짜/가짜/펌프앤덤프를 굴리고 진짜면 결과 칸에 숨은 충격
    public partial class GameSim
    {
        const string ANON = "ㅇㅇ", HY = "형나믿지", MATH = "수학자", RES = "리서치", SUB = "구독", PARK = "박대리", KIM_OFF = "김사장(공식)", ME_AU = "알바감남친";

        public Source srcOf(Tip t) => D.SRC.TryGetValue(t.who, out var s) ? s : D.SRC[SUB];
        double repAcc(Source d) => !S.rt ? (d.tier == "rep" && has("vip") ? 0.85 : d.acc) : d.tier == "rep" ? d.acc + R.RT_REP_ACC + (has("vip") ? R.RT_VIP_ACC : 0) : d.acc;   // 실시간: 증권사 리포트 적중 0.8 → 0.68 (피드백: 리포트가 너무 잘 맞음)
        List<string> WALKERS() => D.SRCList.Where(s => s.tier == "walk" && !s.bar).Select(s => s.id).ToList();

        Tip rollTip(string who, string oTk = null, int oDir = 0)
        {
            var d = D.SRC[who]; int T0 = Tnow(); var TK = D.TK;
            var cands = TKS().Where(k => tkOpen(k) && (!TK[k].meme || d.meme) && (d.stock ? TK[k].type == "stock" && !TK[k].inv : true) && (d.coin ? TK[k].type == "coin" : true)).ToList();
            if (d.meme && tkOpen("MMC") && rnd() < 0.5) cands = new List<string> { "MMC" };
            bool an = v4 && d.an;
            if (an && oTk == null) { bool coinRep = rnd() < R.V4_AN_COINP; var all = anTickers(); var cc = all.Where(k => (TK[k].type == "coin") == coinRep).ToList(); cands = cc.Count > 0 ? cc : all; }   // 분석가 리포트: 코인이면 결과가 1~2칸 뒤 → 잡고 자리를 비울 이유
            string tk = oTk != null && cands.Contains(oTk) ? oTk : cands[(int)Math.Floor(rnd() * cands.Count)];
            bool stockish = TK[tk].type == "stock";
            int dir = oDir != 0 ? oDir : (rnd() < (d.up ?? (stockish ? 0.65 : 0.5)) ? 1 : -1);
            double mag = d.mag[0] + rnd() * (d.mag[1] - d.mag[0]);
            if (an) { if (!stockish) mag = Math.Min(0.6, mag * R.V4_AN_COIN * clamp(TK[tk].vol / Math.Max(1e-9, R.V4_AN_VOL0), 1, R.V4_AN_VOLX)); }   // 코인은 그 코인의 변동성만큼 크게 (잡음에 묻히지 않게 → 사나운 코인엔 배율을 낮춰야 함)
            else
            {
                if (v4 && d.tier != "rep") mag *= R.V4_TIP_MAG;   // 찌라시 한 방이 시세를 뒤엎지 않게 (레버리지가 잡음이 아니라 판단을 키우도록)
                if (!stockish) mag = Math.Min(TK[tk].meme ? 1 : 0.6, mag * (TK[tk].meme ? 2.5 : 1.4));
            }
            int Tr = T0 + d.lag[0] + (int)Math.Floor(rnd() * (d.lag[1] - d.lag[0] + 1));
            int Td = 0;
            if (an) { if (stockish) Tr = nextStockSlot(T0, Tr - T0); Td = stockish ? nextStockSlot(T0, d.lag[1]) : T0 + d.lag[1]; }   // 주식 리포트 결과는 장이 열린 칸에 (발표 = 장중 갭). 화면엔 기한(Td)만 — 정확한 칸은 숨김 (발표 직전에 양쪽으로 거는 수 방지)
            double r = rnd(), acc = an ? anAcc(who) : repAcc(d);
            string kind = r < acc ? "real" : an ? "anti" : r < acc + d.pd ? "pd" : "fake";   // 분석가가 틀리면 반대로 움직임 (전부 따라 타면 기대값 0)
            if (kind == "pd" && Tr < T0 + 1) Tr = T0 + 1;
            bool pre = false;
            if (kind == "real") { pre = !an && d.pre.HasValue && d.pre.Value != 0 && rnd() < d.pre.Value; addShock(Tr, tk, dir * mag * (pre ? 0.15 : 1)); }
            if (kind == "pd") { addShock(Tr - 1, tk, dir * mag * 0.4); addShock(Tr, tk, -dir * mag * 1.5); }
            if (kind == "anti") addShock(Tr, tk, -dir * mag);
            var t = new Tip { id = S.gid++, who = who, tier = d.tier, tk = tk, dir = dir, mag = mag, T0 = T0, Tr = Tr, Td = Td, kind = kind, pre = pre, p0 = S.mk.tk[tk].p, res = "" };
            S.tips.Add(t);
            if (S.tips.Count > 80) { int i = S.tips.FindIndex(x => !string.IsNullOrEmpty(x.res)); if (i >= 0) S.tips.RemoveAt(i); }
            return t;
        }
        /// 칸 T 에 국장이 열리나 (평일 + 그 칸이 장 시간과 겹침)
        bool stockSlotAt(int T)
        {
            int n = R.SLOTS, slot = ((T % n) + n) % n, dow = (int)Math.Floor((double)T / n) % R.MONTH_DAYS + 1;
            return dow <= R.V4_WEEKDAYS && Math.Max(slotStartMin(slot), R.RT_STOCK[0]) < Math.Min(slotEndMin(slot), R.RT_STOCK[1]);
        }
        /// T0 다음부터 nth 번째로 국장이 열리는 칸
        int nextStockSlot(int T0, int nth)
        {
            for (int T = T0 + 1; T < T0 + 60; T++) if (stockSlotAt(T) && --nth <= 0) return T;
            return T0 + 1;
        }
        List<Tip> resolveTips()
        {
            var done = new List<Tip>();
            foreach (var t in S.tips)
            {
                if (!string.IsNullOrEmpty(t.res)) continue;
                if (t.Tr < Tnow()) { t.res = "void"; continue; }
                if (t.Tr != Tnow()) continue;
                double rr = S.mk.tk[t.tk].p / t.p0 - 1; bool hit = (rr >= 0 ? 1 : -1) == t.dir;
                if (t.kind == "anti") hit = false; else if (v4 && t.kind == "real" && srcOf(t).an) hit = true;   // 분석가 전적은 발표가 맞았나로 (그 사이 시세 잡음에 안 흔들리게)
                t.rr = rr; t.res = t.kind == "pd" ? "pd" : hit ? "hit" : "miss";
                if (!S.srcStat.TryGetValue(t.who, out var g)) S.srcStat[t.who] = g = new int[2];
                g[1]++; if (t.res == "hit") g[0]++;
                done.Add(t);
            }
            return done;
        }
        public List<Tip> activeTips(string tk = null) => S.tips.Where(t => string.IsNullOrEmpty(t.res) && t.Tr >= Tnow() && (tk == null || t.tk == tk)).ToList();
        public Rsch rsch() { if (S.rsch == null || S.rsch.d != absDay()) S.rsch = new Rsch { d = absDay() }; return S.rsch; }
        public int freeMax() => (has("vip") ? 2 : 1) + (v4 ? R.V4_FREE_REP + (S.sleepD == absDay() ? R.V4_SLEEP_RSCH : 0) : 0);   // v4: 증권사(박대리)가 없으니 무료 리포트 하나 더 · 전날 밤 푹 잤으면 +V4_SLEEP_RSCH
        /// v4 분석가 목록 · 이번 판에서 그 분석가의 진짜 적중률 (씨앗·부로 섞음 — 화면엔 안 보이고 전적으로만 드러남)
        public List<Source> analysts() => v4 ? D.SRCList.Where(s => s.an).ToList() : new List<Source>();
        public double anAcc(string who)
        {
            var A = R.V4_AN_ACC; var L = analysts(); int n = L.Count, i = L.FindIndex(s => s.id == who);
            if (A == null || A.Length == 0 || i < 0) return 0.5;
            var order = Enumerable.Range(0, n).OrderBy(k => hashU(k * 7919 + S.part * 101 + 13)).ToList();
            return A[Math.Min(A.Length - 1, order.IndexOf(i))];
        }
        /// 새 판·2부 시작: 분석가마다 지난 전적 V4_AN_PRIOR 건을 진짜 적중률로 뽑아 깔아 둠 (프로필에 보임). 씨앗 해시라 rng 흐름과 무관
        /// 분석가가 다루는 종목 (열린 것 중 밈·곱버스 빼고)
        List<string> anTickers() => TKS().Where(k => tkOpen(k) && !D.TK[k].meme && !D.TK[k].inv).ToList();
        public void anSeedPublic() => anSeed();
        void anSeed()
        {
            var L = analysts(); int n0 = R.V4_AN_PRIOR;
            for (int i = 0; i < L.Count; i++)
            {
                if (n0 <= 0) { S.srcStat.Remove(L[i].id); continue; }
                double acc = anAcc(L[i].id); int h = 0;
                for (int k = 0; k < n0; k++) if (hashU(k * 331 + i * 7127 + S.part * 911 + 5) < acc) h++;
                S.srcStat[L[i].id] = new[] { h, n0 };
            }
        }
        /// 리포트 결과가 언제 나오나 (화면용): 분석가 = 기한만 ("오늘 저녁까지"), 나머지 = 그 칸
        public string tipWhen(Tip t) => t.Td > 0 ? (t.Td <= Tnow() ? whenLabel(t.Td) : T("v4.an.by", "w", whenLabel(t.Td))) : whenLabel(t.Tr);
        /// 리포트 받기. v4: 무료 = 아무 분석가, 유료 = 분석가를 골라서 (who)
        Tip getReport(bool paid, string who = null)
        {
            var Rr = rsch(); double fee = S.rt ? R.RT_RSCH_FEE : R.RSCH_FEE;
            var ans = analysts(); Source pickA = null;
            if (ans.Count > 0) { pickA = paid && who != null ? ans.FirstOrDefault(x => x.id == who) : null; if (paid && who != null && pickA == null || anTickers().Count == 0) return null; }
            if (paid) { if (Rr.paid >= R.RSCH_PAID_MAX || S.cash < fee) return null; S.cash -= fee; Rr.paid++; S.today.Add(new Ledger { kind = "ev", amt = -fee, label = T("lbl.paidReport") }); }
            else { if (Rr.free >= freeMax()) return null; Rr.free++; }
            if (ans.Count > 0) return rollTip((pickA ?? ans[(int)Math.Min(ans.Count - 1, Math.Floor(rnd() * ans.Count))]).id);
            return rollTip(RES);
        }
        string encounterRoll() { var W = WALKERS(); return rnd() < R.ENCOUNTER_P ? W[(int)Math.Floor(rnd() * W.Count)] : null; }

        public string resMark(string r) { string k = "res." + (string.IsNullOrEmpty(r) ? "wait" : r); return v4 && D.STR["v4." + k] != null ? T("v4." + k) : T(k); }   // v4: 웹 글꼴에 없는 그림 글자 대신 ○ ×
        public string srcRec(string who)
        {
            if (S.srcStat.TryGetValue(who, out var g) && g[1] != 0) return g[0] + "/" + g[1] + " (" + JsFmt.Num(rhu((double)g[0] / g[1] * 100)) + "%)";
            return T("rec.none");
        }
        public string whenLabel(int Tr)
        {
            int n = R.SLOTS, k = Tr - Tnow(); if (k <= 0) return T(v4 ? "v4.when.now" : "when.now");
            int d = (int)Math.Floor((double)Tr / n) - (int)Math.Floor((double)Tnow() / n); string s = D.SLOT_NAME[((Tr % n) + n) % n];
            return d == 0 ? T("when.today", "s", s) : d == 1 ? T("when.tomorrow", "s", s) : T(v4 ? "v4.when.k" : "when.k", "k", k);
        }
        void tipAnnounce(Tip t, string via)
        {
            t.via = via; var d = srcOf(t);
            pushF("🔎", d.an ? T("v4.an.feed", "ic", d.ic, "n", d.name, "tk", D.TK[t.tk].name, "a", t.dir > 0 ? "▲" : "▼", "w", tipWhen(t), "r", srcRec(t.who))
                : T("tip.feed", "ic", d.ic, "n", d.name, "tk", D.TK[t.tk].name, "a", t.dir > 0 ? "▲" : "▼", "w", tipWhen(t), "s", stars(d.trust)), "tip");
            string bub = via != "post" && S.phase == "home" ? (d.an ? anReact(d) : fpick(D.TIP_REACT[t.who == HY ? HY : t.tier])) : null;
            Emit("tip", "id", t.id, "via", via, "bubble", bub, "face", t.tier == "rep" ? "tired" : "smug");
        }
        /// 분석가 리포트를 받았을 때 미래 한마디: 전적이 좋으면 믿자, 나쁘면 거꾸로 타자, 애매하면 걸러도 된다 (읽는 법을 미래 입으로)
        string anReact(Source d)
        {
            double rate = S.srcStat.TryGetValue(d.id, out var g) && g[1] > 0 ? (double)g[0] / g[1] : 0.5;
            return fpick(TA(rate >= 0.65 ? "v4.an.reactGood" : rate <= 0.35 ? "v4.an.reactBad" : "v4.an.reactMid")).Replace("{a}", d.name);
        }
        void onTipsResolved(List<Tip> list)
        {
            foreach (var t in list)
            {
                var p = t.pid.HasValue && t.pid.Value != 0 ? postById(t.pid.Value) : null;
                if (p != null)
                {
                    p.res = t.res == "hit" ? 1 : -1; p.rr = t.rr; p.pd = t.res == "pd";
                    var pool = (t.res == "pd" ? D.TIP_RES["pd"] : D.TIP_RES[t.res == "hit" ? "hit" : "miss"]).ToList();
                    int k = 2 + (int)Math.Floor(frnd() * 2);
                    for (int i = 0; i < k && pool.Count > 0; i++)
                    {
                        string au = frnd() < 0.6 ? ANON : fpick(TA("tipResAu"));
                        int j = (int)Math.Floor(frnd() * pool.Count); string x = replace1(pool[j], "{au}", t.who); pool.RemoveAt(j);
                        double up = Math.Floor(frnd() * 30);
                        p.cm.Add(new Cm { au = au, x = x, up = up, res = 1 });
                    }
                    if (t.res == "hit") p.up += 15 + Math.Floor(frnd() * 30); else p.dn += 10 + Math.Floor(frnd() * 25);
                    p.best = p.up >= 50;
                }
                if (t.via == "dm" && t.who == HY) pushKR("hy", "hy", t.res == "hit" ? T("hy.hit") : t.res == "pd" ? T("hy.pd") : fpick(TA("hy.miss")));
                if (t.via == "dm" && t.who == MATH) pushKR("hy", "hy", t.res == "hit" ? T("hy.mathHit") : T("hy.mathMiss"));
            }
        }
    }
}
