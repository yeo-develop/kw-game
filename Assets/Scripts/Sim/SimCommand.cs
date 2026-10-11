using System.Globalization;
using Newtonsoft.Json.Linq;

namespace KwGame.Sim
{
    /// 명령 (view → sim). 필드는 JSON 그대로 (ARCHITECTURE §3). k·id 는 문자열/숫자 둘 다 올 수 있어 JToken 로 둔다.
    public class SimCommand
    {
        public readonly JObject J;
        public SimCommand(JObject j) { J = j; }
        public SimCommand(string t, params object[] kv)
        {
            J = new JObject { ["t"] = t };
            for (int i = 0; i + 1 < kv.Length; i += 2) J[(string)kv[i]] = kv[i + 1] == null ? JValue.CreateNull() : JToken.FromObject(kv[i + 1]);
        }
        public static SimCommand Parse(string json) => new SimCommand(JObject.Parse(json));

        public string t => Str("t");
        public bool Has(string k) => J[k] != null && J[k].Type != JTokenType.Null && J[k].Type != JTokenType.Undefined;
        public string Str(string k) { var v = J[k]; if (v == null || v.Type == JTokenType.Null) return null; return v.Type == JTokenType.String ? (string)v : v.ToString(Newtonsoft.Json.Formatting.None); }
        /// JS +x (없으면 NaN)
        public double Num(string k)
        {
            var v = J[k];
            if (v == null || v.Type == JTokenType.Null) return double.NaN;
            if (v.Type == JTokenType.Integer || v.Type == JTokenType.Float) return (double)v;
            if (v.Type == JTokenType.Boolean) return (bool)v ? 1 : 0;
            if (v.Type == JTokenType.String) return double.TryParse((string)v, NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? d : double.NaN;
            return double.NaN;
        }
        /// JS 진릿값
        public bool Truthy(string k)
        {
            var v = J[k];
            if (v == null) return false;
            switch (v.Type)
            {
                case JTokenType.Null: case JTokenType.Undefined: return false;
                case JTokenType.Boolean: return (bool)v;
                case JTokenType.Integer: case JTokenType.Float: { double d = (double)v; return d != 0 && !double.IsNaN(d); }
                case JTokenType.String: return ((string)v).Length > 0;
                default: return true;
            }
        }
        public int Int(string k, int def = -1) { double d = Num(k); return double.IsNaN(d) ? def : (int)d; }
        public override string ToString() => J.ToString(Newtonsoft.Json.Formatting.None);
    }
}
