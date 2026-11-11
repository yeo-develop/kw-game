using System;
using System.Collections.Generic;
using System.Linq;

namespace KwGame.Sim
{
    // 돌발 이벤트 (Unity 전용, Resources/Data/unity_events.json 의 EVENTS).
    // 칸 시작(집)에서 가끔 끼어드는 선택지 장면. 데이터에 EVENTS 가 없으면(골든 고정 데이터) 아무 일도 안 함.
    // 뜰지 말지는 S.rng 와 따로 노는 스트림으로 굴림 → 이벤트가 안 뜬 칸은 예전과 난수 진행이 같음.
    public partial class GameSim
    {
        const double EV_P = 0.3;   // 칸마다 뜰 확률 (쿨다운 포함 평균 이틀에 한 번꼴)
        const int EV_COOL = 3;     // 한 번 뜨면 최소 이만큼 칸을 쉼

        Func<double> evStream()
        {
            uint a = unchecked((uint)S.seed ^ ((uint)(Tnow() + 1) * 0x85EBCA77u) ^ 0x5EED5EEDu);
            return () => Rng.Float(ref a);
        }
        bool evFits(EvDef e) =>
            e.day == 0 && evWhenFits(e) && (e.slots == null || e.slots.Contains(S.slot)) && absDay() >= Math.Max(1, e.minDay) && S.cash >= e.minCash && S.addict >= e.minAddict;

        /// homeStep 에서 호출. 이벤트를 띄웠으면 true (pending = event)
        bool evCheck()
        {
            if (D.EVENTS.Count == 0 || fainted() || S.ending != null || S.optTut && absDay() <= 1) return false;
            if (v4 && S.part <= 1 && absDay() <= 1) return false;   // 1부 첫날은 배우는 날: 돌발 이벤트가 안내 카드보다 먼저 뜨지 않게 (2부 첫날은 그대로)
            if (S.evT == Tnow() || (S.evCool.HasValue && S.evCool.Value > Tnow())) return false;
            if (S.day == R.MONTH_DAYS && isEve()) return false;   // 이자일 저녁은 김사장 몫
            var h = evStream();
            if (h() >= EV_P) return false;
            var ok = D.EVENTS.Where(evFits).ToList();
            if (ok.Count == 0) return false;
            var fresh = ok.Where(e => !S.evSeen.Contains(e.id)).ToList();
            if (fresh.Count == 0) { S.evSeen.RemoveAll(id => ok.Any(e => e.id == id)); fresh = ok; }   // 다 봤으면 한 바퀴 더
            var ev = fresh[(int)Math.Floor(h() * fresh.Count)];
            S.evT = Tnow(); S.evCool = Tnow() + EV_COOL; S.evSeen.Add(ev.id);
            evStart(ev);
            return true;
        }

        /// 체력을 없앤 규칙(v4)에선 "· 체력 −5" 같은 조각을 문구에서 뺌 (데이터는 턴 모드와 같이 써서 여기서 거름)
        public string noHpText(string s)
        {
            if (s == null || !hpOff) return s;
            if (s.Contains("체력")) s = string.Join(" · ", s.Split(new[] { " · " }, StringSplitOptions.None).Where(x => !x.Contains("체력")));
            // 화면 용어 통일: 수치 이름은 '스트레스' (대사 속 '멘탈'은 그대로 둠 — 여기는 선택지 부제만 지나감)
            s = System.Text.RegularExpressions.Regex.Replace(s, "멘탈 (대폭|크게|완전) 회복", "스트레스 크게 ↓");
            return s.Replace("멘탈 조금 깎임", "스트레스 조금 ↑").Replace("멘탈 회복", "스트레스 ↓").Replace("멘탈 깎임", "스트레스 ↑").Replace("멘탈 −", "스트레스 −").Replace("멘탈↓", "스트레스↑").Replace("멘탈↑", "스트레스↓");
        }
        void evStart(EvDef ev)
        {
            Emit("event", "id", ev.id, "title", ev.title);
            scene(ev.bg ?? "room", "night", isEve(), "face", ev.face ?? "neutral", "mode", "home");
            bool kimOn = false;
            foreach (var ln in ev.lines)
            {
                string who = ln[0], face = ln.Length > 2 ? ln[2] : null;
                if (who == "kim" && !kimOn) { kim(true); kimOn = true; }
                say(who, storyFill(ln[1]), face);
            }
            if (kimOn) kim(false);
            var opts = new List<Opt>();
            for (int i = 0; i < ev.opts.Count; i++)
            {
                var o = ev.opts[i];
                double need = o.need > 0 ? o.need : v4 && o.fundFill > 0 ? fundFillNeed() : 0;   // fundFill = 모자란 복학 통장을 현금으로 (그때 금액)
                bool dis = need > 0 && S.cash < need;
                opts.Add(new Opt { k = "ev" + i, l = storyFill(o.l), sub = dis ? won(need) + " 필요" : storyFill(noHpText(o.sub)), dis = dis });
            }
            S.pending = new Pending("event") { evId = ev.id, opts = opts };
        }

        bool evPick(string k)
        {
            var P = S.pending; var ev = D.EVENTS.FirstOrDefault(e => e.id == P.evId);
            int i = P.opts.FindIndex(o => o.k == k);
            if (ev == null || i < 0 || P.opts[i].dis) return false;
            S.pending = null;
            var o = ev.opts[i];
            var r = o.p < 1 && o.fail != null && rnd() >= o.p ? o.fail : o;
            evApply(ev, r, r.who ?? o.who ?? "m");
            storyPick(ev, o, r);   // 통장 · 등록 · 말림/같이 탐 · 엄마 (GameSim.Story.cs)
            homeLine(); S.pending = new Pending("home");
            return true;
        }

        void evApply(EvDef ev, EvOpt r, string who)
        {
            var bits = new List<string>();
            if (r.cash != 0)
            {
                S.cash = Math.Max(0, S.cash + r.cash);
                S.today.Add(new Ledger { kind = "ev", amt = r.cash, label = ev.title });
                bits.Add("현금 " + (r.cash > 0 ? "+" : "-") + won(Math.Abs(r.cash)));
            }
            if (r.st != 0) { stress(r.st); bits.Add(v4 ? (r.st < 0 ? "스트레스 ↓" : "스트레스 ↑") : r.st < 0 ? "멘탈 회복" : "멘탈 깎임"); }   // v4: 화면 용어는 스트레스 하나로
            if (r.hp != 0) { hp(r.hp); if (!hpOff) bits.Add("체력 " + (r.hp > 0 ? "+" : "") + JsFmt.Num(r.hp)); }
            if (r.fame != 0) fame(r.fame);
            if (r.addict != 0) { addict(r.addict); if (r.addict > 0) bits.Add("도박 중독도 +" + JsFmt.Num(r.addict)); }
            if (r.aff != 0) { affD(r.aff); bits.Add(r.aff > 0 ? "미래 호감 +" + JsFmt.Num(r.aff) : "미래 호감 " + JsFmt.Num(r.aff)); }
            if (r.greed != 0) greedD(r.greed);
            if (r.debt > 0) { addDebt(r.debt, ev.title); bits.Add("빚 +" + won(r.debt)); }
            if (r.debtPct != 0)
            {
                double d = round1k(S.debt * r.debtPct);
                if (d > 0) addDebt(d, ev.title);
                else if (d < 0) { S.debt = Math.Max(0, S.debt + d); S.st.minDebt = Math.Min(S.st.minDebt, S.debt); S.today.Add(new Ledger { kind = "debt", amt = -d, label = ev.title }); Emit("debt", "d", d); }
                bits.Add("빚 " + (d > 0 ? "+" : "-") + won(Math.Abs(d)));
            }
            if (r.heist >= 0 && v4 && S.heist != r.heist) { S.heist = r.heist; Emit("heist", "v", S.heist); bits.Add(S.heist > 0 ? "털기 준비 " + S.heist + "/3" : "털기 계획 접음"); }
            if (r.go && v4) S.heistGo = true;
            if (r.res != null) say(who, storyFill(r.res), r.face);
            string tail = bits.Count > 0 ? " (" + string.Join(" · ", bits) + ")" : "";
            pushF("🎲", ev.title + tail, "money");
            if (bits.Count > 0) toast(ev.title + tail, r.cash < 0 || r.st > 0 ? "liq" : "good");
            hideDlg();
        }
    }
}
