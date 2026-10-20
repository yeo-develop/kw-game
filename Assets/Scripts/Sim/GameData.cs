using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace KwGame.Sim
{
    // data/*.json 을 평평하게 합친 테이블 (web/src/sim/core.js D). JSON 키 순서를 그대로 유지한다 (규칙이 순서에 기대는 곳이 있음).

    public class Rules
    {
        public double DEBT0, CASH0, RATE, DEBT_CAP, FEE_APP, FEE_BROKER, COIN_FEE, FUNDING, INTRA, ENCOUNTER_P, RSCH_FEE;
        public int MONTH_DAYS, SLOTS, RSCH_PAID_MAX, WRITE_MAX, SCRATCH_MAX, LOTTO_MAX;
        public double SCRATCH_PRICE, LOTTO_PRICE, LOAN_FEE, LOAN_FEE_BRO;
        public int[] STOCK_SLOTS;
        public double[] LOAN_CAP, LOAN_AMTS, LIQ_LOSS, RELIC_TIER_W;
        public Dictionary<string, double> PC_COST, HP_COST, ADD_GAIN, RELIC_PRICE;
        public double HP_MAX, HP_SLEEP, HP_REST, HP_REST_EVE, HP_LOW, HP_FAINT_BACK, HP_FAINT_COST;
        public double ADD_DECAY, ADD_SLOT_DECAY, ADD_STICKY, ADD_NAG, ADD_SECRET, ADD_TEMPT, ADD_WITHDRAW, ADD_COIN_LEV;
        public double IMPULSE_P, IMPULSE_CASH, GACHA_PRICE, GACHA_JUNK;
        /// 목장갑(grind) 일당 배율. 996af67 데이터엔 없음(코드 상수 1.3) → v3.3b 에서 rules.json 으로 빠짐 (1.15)
        public double GRIND_PAY = 1.3;
        // 실시간 모드 (GameSim.Realtime.cs). 시각은 하루 중 분 (480 = 08:00)
        public int RT_DAY0 = 480, RT_CANDLE = 30, RT_HIST = 160, RT_REST = 180, RT_ACT = 120, RT_WORK = 300;
        public int[] RT_SLOT_END = { 720, 1080, 1440 }, RT_STOCK = { 540, 930 };
        public double RT_VOL = 2, RT_LIMIT = 0.3, RT_SPEED = 10.0 / 15, RT_WARN_P = 0.05, RT_WARN_LOW_P = 0.15, RT_DELIST_P = 0.5, RT_DELIST_AT = 0.03;
        // 실시간 모드 체력·멘탈: 알바 무지성 반복·집에서 쉬기만 하기 막기 (턴 모드는 위 HP_* 그대로)
        public double RT_HP_SLEEP = 35, RT_HP_REST = 20, RT_HP_REST_EVE = 10, RT_REST_ST = -8, RT_WORK_ST = 12, RT_WORK_ST_STREAK = 4, RT_DUE_ST = 2, RT_ANX_PAY = 0.9, RT_MEN_PAY = 0.7;

        // 실시간 모드 스트레스 관리·병 (GameSim.Health.cs): 놀거리는 같은 날 반복할수록 효과 ×RELAX_DIM, 병 확률 = (기본 + 스트레스·체력·숙취) × 운동
        // 실시간 모드 밸런스 (피드백: OP 유품·유료 리포트)
        public double RT_DIVI = 0.003, RT_WHALE_HIT = 0.6, RT_WHALE_VOL = 1.5, RT_MEME_UP = 0.42, RT_INSURE = 0.3, RT_INVERSE = 0.1, RT_RSCH_FEE = 100000, RT_REP_ACC = -0.12, RT_IGNORE_N = 3, RT_IGNORE_ST = 3;
        // 알바·하이로우 (피드백: 알바비 7만~14만 · 컨디션 따라 일당 안 바뀜 · 하이로우 너무 쉬움 → 같은 숫자면 딜러 승 + 배당 ×0.9)
        public double RT_JOB_PAY0 = 70000, RT_JOB_PAYV = 70000, RT_HL_EDGE = 0.9, RT_VIP_ACC = 0.07, RT_CASH0 = 300000;
        /// 실시간 주 이자율. 바꾸면 하드코딩된 '5%' 문구도 같이: GameController.Screens.cs · scenes.json(150만) · tutorial.json · augments.json(loanbro 5→4%)
        public double RT_RATE = 0.05;
        public Dictionary<string, RelaxDef> RELAX; public Dictionary<string, SickDef> SICK;
        public double RELAX_DIM = 0.6, SICK_P0 = 0.02, SICK_ST0 = 50, SICK_ST_K = 0.006, SICK_HP = 0.2, SICK_HANG = 0.1, SICK_FIT = 0.5, SICK_FLU_ST = 80, HANG_HP = 10, PHARM_COST = 8000, CLINIC_COST = 60000, VITA_COST = 15000;

        public double HpCost(string k) => HP_COST != null && HP_COST.TryGetValue(k, out var v) ? v : 0;
        public double Gain(string k) => ADD_GAIN != null && ADD_GAIN.TryGetValue(k, out var v) ? v : 0;
    }

    public class Ticker
    {
        public string id, name, type, ic, d, @lock;
        public double p0, vol, beta, tr, maxLev;
        public bool inv, meme;
        /// inv 가 따라가는 종목 (없으면 시장 전체 반대). junk = 관리종목·상장폐지 대상. cat = 화면 분류. nmag = 뉴스 크기 배수
        public string of, cat; public bool junk; public double nmag = 1;
        /// 실시간: 이 날(absDay)부터 상장. 0 = 처음부터. 초보 과부하 줄이려고 주차마다 늘림
        public int day;
        public bool IsCoin => type == "coin";
        public bool IsStock => type == "stock";
    }

    public class Job { public string id, name, ic, bg; public double @base, var, hp; public List<string> lines; }

    public class Source
    {
        public string id, tier, ic, name, npc, line;
        public double acc, pd, trust, ret, cost;
        /// bar = 포차 옆 테이블 (길거리 만남엔 안 나옴)
        public bool bar;
        public double? pre, up;
        public double[] mag; public int[] lag;
        public bool stock, coin, meme;
    }

    public class Aug { public string id, cat, ic, name, d, fl; public int tier; }
    public class Item { public string id, type, ic, name, d, line; public double p; public double? st; }
    /// rt = 실시간 모드에만 있는 장소 (공원·포차·병원)
    public class Loc { public string id, name, ic, bg, npc, hint; public double[] pos; public int[] open; public bool rt; }
    /// 놀거리 한 번: 돈 · 멘탈 · 체력 · 숙취 확률 · 운동(내일 병 확률↓) · 정보 들을 확률
    public class RelaxDef { public double cost, st, hp, hang, tip; public bool fit; }
    /// 병: 알바 점수 배율 · 매매 손떨림(체결가 손해) · 잠 회복 배율 · 아침마다 멘탈 · 앓는 날 [최소, 최대]
    public class SickDef { public string name, ic; public double pay, slip, sleep, st; public int[] d; }
    public class RandEv { public string t; public double cash, st, fame, hp; }
    public class KQDef { public string q, ok, good, bad; public string[] no; }
    /// 돌발 이벤트 (unity_events.json). lines = [who, text, face?] 목록, who: m·me·kim·nar
    public class EvDef { public string id, title, bg, face; public List<string[]> lines; public int[] slots; public int minDay; public double minCash, minAddict; public List<EvOpt> opts; }
    public class EvOpt { public string l, sub, who, res, face; public double need, p = 1, cash, st, hp, fame, addict; public EvOpt fail; }
    public class MenSet { public string[] msgs; public string last, ok, good, bad; public string[] no; }
    public class ImpulseSet { public string line, ok, good, bad; public string[] no; }
    public class EndingDef
    {
        public string tag, h, bg, face; public bool ok;
        public Dictionary<string, string> hv, bgv; public Dictionary<string, int> noCharV;
    }
    public class GnDef { public double acc, w; public string ic, d; }

    public class GameData
    {
        public JObject J;
        public Rules RULES;
        public List<Ticker> TKList = new List<Ticker>();
        public Dictionary<string, Ticker> TK = new Dictionary<string, Ticker>();
        public Dictionary<string, List<(string h, int dir)>> NEWS = new Dictionary<string, List<(string, int)>>();
        public List<Job> JOBList = new List<Job>();
        public Dictionary<string, Job> JOBS = new Dictionary<string, Job>();
        public List<Source> SRCList = new List<Source>();
        public Dictionary<string, Source> SRC = new Dictionary<string, Source>();
        public List<Aug> AUGS;
        public Dictionary<string, string> TIER;
        public List<string> RELIC_JUNK;
        public List<Item> ITEMS;
        public Dictionary<string, string> DECOR_END;
        public List<Loc> LOCList = new List<Loc>();
        public Dictionary<string, Loc> LOCS = new Dictionary<string, Loc>();
        public Dictionary<string, List<string>> GREET;
        public List<string> SLOT_NAME, SLOT_IC, SLOT_CLOCK, SCRATCH_SYM, SLOT_SYM, RK, SU, HORSES, HY_TALK;
        public Dictionary<string, string> CAS_TITLE;
        public List<(string s, double amt, double p)> SC_PRIZE = new List<(string, double, double)>();
        public Dictionary<int, double> LOTTO_PRIZE = new Dictionary<int, double>();
        public List<(string name, double per, string unit)> CONV = new List<(string, double, string)>();
        public Dictionary<string, List<string[]>> GAL;
        public List<string> GNKeys; public Dictionary<string, GnDef> GN;
        public Dictionary<string, double> FAME;
        public List<(double f, string name, string desc)> RANKS = new List<(double, string, string)>();
        public Dictionary<string, List<string[]>> TIPT;
        public Dictionary<string, List<string>> CM, TIP_RES, MYCM, ML, KIM_DM, TIP_REACT;
        public Dictionary<string, string> GR_T;
        public Dictionary<string, int> HOT;
        public List<MenSet> MEN_SETS; public List<ImpulseSet> IMPULSE; public List<RandEv> MORNING_EV, PC_EV; public List<KQDef> KQ; public List<EvDef> EVENTS = new List<EvDef>();
        public Dictionary<string, EndingDef> ENDINGS;
        public JObject STR;
        public Dictionary<string, string> NPC_NAME = new Dictionary<string, string>();

        /// 파일별 JSON 문자열들을 이름순으로 합친다 (tools/load-data.mjs 와 같음)
        public static GameData Load(IEnumerable<KeyValuePair<string, string>> files)
        {
            var root = new JObject();
            foreach (var kv in files.OrderBy(k => k.Key, StringComparer.Ordinal))
            {
                var o = JObject.Parse(kv.Value);
                foreach (var p in o.Properties()) root[p.Name] = p.Value;
            }
            return FromJObject(root);
        }

        public static GameData FromJObject(JObject j)
        {
            var d = new GameData { J = j };
            d.RULES = j["RULES"].ToObject<Rules>();
            foreach (var p in ((JObject)j["TK"]).Properties())
            {
                var t = p.Value.ToObject<Ticker>(); t.id = p.Name;
                d.TKList.Add(t); d.TK[p.Name] = t;
            }
            foreach (var p in ((JObject)j["NEWS"]).Properties())
                d.NEWS[p.Name] = p.Value.Select(x => ((string)x[0], (int)x[1])).ToList();
            foreach (var p in ((JObject)j["JOBS"]).Properties())
            {
                var t = p.Value.ToObject<Job>(); t.id = p.Name; d.JOBList.Add(t); d.JOBS[p.Name] = t;
            }
            foreach (var p in ((JObject)j["SRC"]).Properties())
            {
                var t = p.Value.ToObject<Source>(); t.id = p.Name; d.SRCList.Add(t); d.SRC[p.Name] = t;
            }
            d.AUGS = j["AUGS"].ToObject<List<Aug>>();
            d.TIER = j["TIER"].ToObject<Dictionary<string, string>>();
            d.RELIC_JUNK = j["RELIC_JUNK"].ToObject<List<string>>();
            d.ITEMS = j["ITEMS"].ToObject<List<Item>>();
            d.DECOR_END = j["DECOR_END"].ToObject<Dictionary<string, string>>();
            foreach (var p in ((JObject)j["LOCS"]).Properties())
            {
                var t = p.Value.ToObject<Loc>(); t.id = p.Name; d.LOCList.Add(t); d.LOCS[p.Name] = t;
            }
            d.GREET = j["GREET"].ToObject<Dictionary<string, List<string>>>();
            d.SLOT_NAME = j["SLOT_NAME"].ToObject<List<string>>();
            d.SLOT_IC = j["SLOT_IC"].ToObject<List<string>>();
            d.SLOT_CLOCK = j["SLOT_CLOCK"].ToObject<List<string>>();
            d.SCRATCH_SYM = j["SCRATCH_SYM"].ToObject<List<string>>();
            d.CAS_TITLE = j["CAS_TITLE"].ToObject<Dictionary<string, string>>();
            d.SLOT_SYM = j["SLOT_SYM"].ToObject<List<string>>();
            d.RK = j["RK"].ToObject<List<string>>();
            d.SU = j["SU"].ToObject<List<string>>();
            d.HORSES = j["HORSES"].ToObject<List<string>>();
            foreach (var x in j["SC_PRIZE"]) d.SC_PRIZE.Add(((string)x[0], (double)x[1], (double)x[2]));
            foreach (var p in ((JObject)j["LOTTO_PRIZE"]).Properties()) d.LOTTO_PRIZE[int.Parse(p.Name)] = (double)p.Value;
            foreach (var x in j["CONV"]) d.CONV.Add(((string)x[0], (double)x[1], (string)x[2]));
            d.GAL = j["GAL"].ToObject<Dictionary<string, List<string[]>>>();
            d.GNKeys = ((JObject)j["GN"]).Properties().Select(p => p.Name).ToList();
            d.GN = j["GN"].ToObject<Dictionary<string, GnDef>>();
            d.FAME = j["FAME"].ToObject<Dictionary<string, double>>();
            foreach (var x in j["RANKS"]) d.RANKS.Add(((double)x[0], (string)x[1], (string)x[2]));
            d.TIPT = j["TIPT"].ToObject<Dictionary<string, List<string[]>>>();
            d.CM = j["CM"].ToObject<Dictionary<string, List<string>>>();
            d.TIP_RES = j["TIP_RES"].ToObject<Dictionary<string, List<string>>>();
            d.MYCM = j["MYCM"].ToObject<Dictionary<string, List<string>>>();
            d.GR_T = j["GR_T"].ToObject<Dictionary<string, string>>();
            d.HOT = j["HOT"].ToObject<Dictionary<string, int>>();
            d.ML = j["ML"].ToObject<Dictionary<string, List<string>>>();
            d.MEN_SETS = j["MEN_SETS"].ToObject<List<MenSet>>();
            d.IMPULSE = j["IMPULSE"].ToObject<List<ImpulseSet>>();
            d.MORNING_EV = j["MORNING_EV"].ToObject<List<RandEv>>();
            d.PC_EV = j["PC_EV"].ToObject<List<RandEv>>();
            d.KQ = j["KQ"].ToObject<List<KQDef>>();
            // unity_events.json (Unity 전용, 웹 데이터·골든 고정 데이터엔 없음): 문구 풀 추가분 + 돌발 이벤트
            void more<T>(List<T> to, string k) { if (j[k] != null) to.AddRange(j[k].ToObject<List<T>>()); }
            more(d.MORNING_EV, "MORNING_EV_X"); more(d.PC_EV, "PC_EV_X"); more(d.KQ, "KQ_X"); more(d.MEN_SETS, "MEN_SETS_X"); more(d.IMPULSE, "IMPULSE_X"); more(d.EVENTS, "EVENTS");
            d.KIM_DM = j["KIM_DM"].ToObject<Dictionary<string, List<string>>>();
            d.HY_TALK = j["HY_TALK"].ToObject<List<string>>();
            d.TIP_REACT = j["TIP_REACT"].ToObject<Dictionary<string, List<string>>>();
            d.ENDINGS = j["ENDINGS"].ToObject<Dictionary<string, EndingDef>>();
            d.STR = (JObject)j["STR"];
            foreach (var p in ((JObject)j["NPCS"]).Properties()) d.NPC_NAME[p.Name] = (string)p.Value["name"];
            return d;
        }

        public string S(string key)
        {
            var t = STR[key];
            if (t == null) throw new Exception("STR missing: " + key);
            return (string)t;
        }
        public List<string> SA(string key)
        {
            var t = STR[key] as JArray;
            if (t == null) throw new Exception("STR array missing: " + key);
            return t.Select(x => (string)x).ToList();
        }
        public string U(string k) => (string)STR["U"][k];
    }
}
