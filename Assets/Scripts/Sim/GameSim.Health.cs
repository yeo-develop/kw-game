using System;
using System.Collections.Generic;
using System.Linq;

namespace KwGame.Sim
{
    // 실시간 모드 스트레스 관리 · 병: 공원(산책·조깅·한강 라면) · 포차(소주·부어라 마셔라) · 병원(약국·영양제·수액)
    // 스트레스 높음·체력 바닥·숙취 → 아침에 감기/몸살 → 알바 점수 ×pay · 매매 체결가 손해(slip) · 잠 회복 ×sleep
    public partial class GameSim
    {
        SickDef sickDef() => S.rt && !string.IsNullOrEmpty(S.sick) && R.SICK != null && R.SICK.TryGetValue(S.sick, out var d) ? d : null;
        public string sickName() => sickDef()?.name;
        public double sickPay() => sickDef()?.pay ?? 1;
        /// 아파서 손 떨림 = 매매할 때 추가로 잃는 비율 (코인은 레버리지 곱해지니 1/5)
        public double sickSlip() => sickDef()?.slip ?? 0;
        public double sickSleep() => sickDef()?.sleep ?? 1;
        /// 내일 아침 앓아누울 확률 (지금 상태 기준)
        public double sickP()
        {
            if (!S.rt || R.SICK == null) return 0;
            double p = R.SICK_P0 + Math.Max(0, S.stress - R.SICK_ST0) * R.SICK_ST_K + (S.hp < R.HP_LOW ? R.SICK_HP : 0) + (S.hang ? R.SICK_HANG : 0);
            return clamp(p * (S.fit ? R.SICK_FIT : 1), 0, 0.9);
        }
        /// 같은 날 같은 놀거리 반복 = 효과 줄어듦
        double relaxSt(string k, double st)
        {
            if (!S.rt) return st;
            int n = S.relaxN.TryGetValue(k, out var v) ? v : 0; S.relaxN[k] = n + 1;
            return rhu(st * Math.Pow(R.RELAX_DIM, n));
        }
        public int relaxCount(string k) => S.relaxN != null && S.relaxN.TryGetValue(k, out var v) ? v : 0;

        // ---------- 아침: 숙취 · 병 진행 · 새로 앓기 ----------
        void healthMorning()
        {
            if (!S.rt || R.SICK == null) return;
            if (S.relaxN == null) S.relaxN = new Dictionary<string, int>();
            double p = sickP();
            if (S.hang) { hp(-R.HANG_HP); pushK("m", fpick(TA("hang.m"))); toast(T("hang.toast", "h", R.HANG_HP), "liq"); }
            S.hang = false; S.fit = false;
            var d = sickDef();
            if (d != null)
            {
                S.sickD--; stress(d.st);
                if (S.sickD <= 0) { toast(T("sick.well", "n", d.name), "good"); pushK("m", fpick(TA("sick.wellM"))); S.sick = null; S.sickD = 0; Emit("sick", "k", ""); }
                return;
            }
            if (rnd() >= p) return;
            string k = S.stress >= R.SICK_FLU_ST || rnd() < 0.3 ? "flu" : "cold"; d = R.SICK[k];
            S.sick = k; S.sickD = d.d[0] + (int)Math.Floor(rnd() * (d.d[1] - d.d[0] + 1));
            toast(T("sick.toast", "ic", d.ic, "n", d.name, "d", S.sickD, "p", rhu((1 - d.pay) * 100)), "liq");
            pushF(d.ic, T("sick.feed", "n", d.name, "d", S.sickD), "money");
            pushK("m", fpick(TA("sick.m")));
            Emit("sick", "k", k);
        }
        /// 집에서 쉬면 반쯤 확률로 하루 일찍 나음
        void sickRest()
        {
            var d = sickDef(); if (d == null || rnd() >= 0.5) return;
            if (--S.sickD <= 0) { S.sick = null; S.sickD = 0; toast(T("sick.well", "n", d.name), "good"); Emit("sick", "k", ""); }
            else toast(T("sick.restBetter", "n", d.name, "d", S.sickD), "good");
        }

        // ---------- 공원 · 포차 ----------
        bool doRelax(string k)
        {
            var d = R.RELAX[k];
            if (S.cash < d.cost) { M(T("pc.broke"), "cry"); hideDlg(); return false; }
            if (d.cost > 0) { S.cash -= d.cost; S.today.Add(new Ledger { kind = "pc", amt = -d.cost, label = T("lbl.relax." + k) }); }
            S.workStreak = 0; S.st.pc++;
            double st = relaxSt(k, d.st); stress(st); if (d.hp != 0) hp(d.hp);
            if (d.fit) S.fit = true;
            bool hung = d.hang > 0 && rnd() < d.hang; if (hung) S.hang = true;
            N(fpick(TA("relax." + k)) + (relaxCount(k) > 1 ? T("relax.dim", "n", relaxCount(k)) : ""));
            if (d.tip > 0 && rnd() < d.tip) overhear(k);
            M(fpick(TA(hung ? "relax.hangM" : "relax.m")), hung ? "smug" : "happy");
            galReact("pc", null, 1);
            hideDlg();
            return true;
        }
        /// 산책·술자리에서 주워들은 정보 (공짜, 출처는 길거리·옆 테이블)
        void overhear(string k)
        {
            var pool = D.SRCList.Where(s => k == "drunk" ? s.bar : s.tier == "walk" && !s.bar && s.cost == 0).ToList();
            if (pool.Count == 0) return;
            var src = pool[(int)Math.Floor(rnd() * pool.Count)];
            var t = rollTip(src.id); tipAnnounce(t, "walk");
            NPC(src.name, T("enc.tell", "n", D.TK[t.tk].name, "w", whenLabel(t.Tr), "d", T(t.dir > 0 ? "enc.up" : "enc.dn")));
        }

        // ---------- 병원 ----------
        bool doClinic(string k)
        {
            var d = sickDef();
            double cost = k == "pharm" ? R.PHARM_COST : k == "clinic" ? R.CLINIC_COST : R.VITA_COST;
            if (S.cash < cost) { M(T("pc.broke"), "cry"); hideDlg(); return false; }
            S.cash -= cost; S.today.Add(new Ledger { kind = "pc", amt = -cost, label = T("lbl.hosp." + k) });
            if (k == "vita") { S.fit = true; hp(5); N(T("hosp.vita")); }
            else if (d != null && (k == "clinic" || --S.sickD <= 0))
            {
                S.sick = null; S.sickD = 0; if (k == "clinic") hp(15);
                N(T("hosp.cured", "n", d.name)); toast(T("sick.well", "n", d.name), "good"); Emit("sick", "k", "");
            }
            else N(T("hosp.pharm", "d", S.sickD));
            stress(-3);
            M(fpick(TA("hosp.m")), "shy");
            hideDlg();
            return true;
        }
    }
}
