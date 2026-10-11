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
        double repAcc(Source d) => d.tier == "rep" && has("vip") ? 0.85 : d.acc;
        List<string> WALKERS() => D.SRCList.Where(s => s.tier == "walk").Select(s => s.id).ToList();

        Tip rollTip(string who, string oTk = null, int oDir = 0)
        {
            var d = D.SRC[who]; int T0 = Tnow(); var TK = D.TK;
            var cands = TKS().Where(k => tkOpen(k) && (!TK[k].meme || d.meme) && (d.stock ? TK[k].type == "stock" && !TK[k].inv : true) && (d.coin ? TK[k].type == "coin" : true)).ToList();
            if (d.meme && tkOpen("MMC") && rnd() < 0.5) cands = new List<string> { "MMC" };
            string tk = oTk != null && cands.Contains(oTk) ? oTk : cands[(int)Math.Floor(rnd() * cands.Count)];
            bool stockish = TK[tk].type == "stock";
            int dir = oDir != 0 ? oDir : (rnd() < (d.up ?? (stockish ? 0.65 : 0.5)) ? 1 : -1);
            double mag = d.mag[0] + rnd() * (d.mag[1] - d.mag[0]);
            if (!stockish) mag = Math.Min(TK[tk].meme ? 1 : 0.6, mag * (TK[tk].meme ? 2.5 : 1.4));
            int Tr = T0 + d.lag[0] + (int)Math.Floor(rnd() * (d.lag[1] - d.lag[0] + 1));
            double r = rnd(), acc = repAcc(d);
            string kind = r < acc ? "real" : r < acc + d.pd ? "pd" : "fake";
            if (kind == "pd" && Tr < T0 + 1) Tr = T0 + 1;
            bool pre = false;
            if (kind == "real") { pre = d.pre.HasValue && d.pre.Value != 0 && rnd() < d.pre.Value; addShock(Tr, tk, dir * mag * (pre ? 0.15 : 1)); }
            if (kind == "pd") { addShock(Tr - 1, tk, dir * mag * 0.4); addShock(Tr, tk, -dir * mag * 1.5); }
            var t = new Tip { id = S.gid++, who = who, tier = d.tier, tk = tk, dir = dir, mag = mag, T0 = T0, Tr = Tr, kind = kind, pre = pre, p0 = S.mk.tk[tk].p, res = "" };
            S.tips.Add(t);
            if (S.tips.Count > 80) { int i = S.tips.FindIndex(x => !string.IsNullOrEmpty(x.res)); if (i >= 0) S.tips.RemoveAt(i); }
            return t;
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
                t.rr = rr; t.res = t.kind == "pd" ? "pd" : hit ? "hit" : "miss";
                if (!S.srcStat.TryGetValue(t.who, out var g)) S.srcStat[t.who] = g = new int[2];
                g[1]++; if (t.res == "hit") g[0]++;
                done.Add(t);
            }
            return done;
        }
        public List<Tip> activeTips(string tk = null) => S.tips.Where(t => string.IsNullOrEmpty(t.res) && t.Tr >= Tnow() && (tk == null || t.tk == tk)).ToList();
        public Rsch rsch() { if (S.rsch == null || S.rsch.d != absDay()) S.rsch = new Rsch { d = absDay() }; return S.rsch; }
        public int freeMax() => has("vip") ? 2 : 1;
        Tip getReport(bool paid)
        {
            var Rr = rsch(); double fee = R.RSCH_FEE;
            if (paid) { if (Rr.paid >= R.RSCH_PAID_MAX || S.cash < fee) return null; S.cash -= fee; Rr.paid++; S.today.Add(new Ledger { kind = "ev", amt = -fee, label = T("lbl.paidReport") }); }
            else { if (Rr.free >= freeMax()) return null; Rr.free++; }
            return rollTip(RES);
        }
        string encounterRoll() { var W = WALKERS(); return rnd() < R.ENCOUNTER_P ? W[(int)Math.Floor(rnd() * W.Count)] : null; }

        public string resMark(string r) => T("res." + (string.IsNullOrEmpty(r) ? "wait" : r));
        public string srcRec(string who)
        {
            if (S.srcStat.TryGetValue(who, out var g) && g[1] != 0) return g[0] + "/" + g[1] + " (" + JsFmt.Num(rhu((double)g[0] / g[1] * 100)) + "%)";
            return T("rec.none");
        }
        public string whenLabel(int Tr)
        {
            int n = R.SLOTS, k = Tr - Tnow(); if (k <= 0) return T("when.now");
            int d = (int)Math.Floor((double)Tr / n) - (int)Math.Floor((double)Tnow() / n); string s = D.SLOT_NAME[((Tr % n) + n) % n];
            return d == 0 ? T("when.today", "s", s) : d == 1 ? T("when.tomorrow", "s", s) : T("when.k", "k", k);
        }
        void tipAnnounce(Tip t, string via)
        {
            t.via = via; var d = srcOf(t);
            pushF("🔎", T("tip.feed", "ic", d.ic, "n", d.name, "tk", D.TK[t.tk].name, "a", t.dir > 0 ? "▲" : "▼", "w", whenLabel(t.Tr), "s", stars(d.trust)), "tip");
            string bub = via != "post" && S.phase == "home" ? fpick(D.TIP_REACT[t.who == HY ? HY : t.tier]) : null;
            Emit("tip", "id", t.id, "via", via, "bubble", bub, "face", t.tier == "rep" ? "tired" : "smug");
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
