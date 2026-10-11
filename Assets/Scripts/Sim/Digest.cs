using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace KwGame.Sim
{
    /// 골든 벡터용 상태 요약·해시 (web/src/sim/digest.js 와 같은 문자열)
    public static class Digest
    {
        static string Bits(double x) => BitConverter.DoubleToInt64Bits(x).ToString("x16");
        /// 정수면 10진, 아니면 "f"+IEEE 비트
        public static string Num(double x)
        {
            if (!double.IsNaN(x) && !double.IsInfinity(x) && x == Math.Floor(x)) return JsFmt.Num(x);
            return "f" + Bits(x);
        }
        static string I(int x) => x.ToString(CultureInfo.InvariantCulture);

        public static string Of(GameState S)
        {
            var p = new List<string>();
            void put(string k, string v) => p.Add(k + "=" + v);
            put("v", I(S.version)); put("rngv", I(S.rngv)); put("rng", S.rng.ToString(CultureInfo.InvariantCulture)); put("fx", S.fx.ToString(CultureInfo.InvariantCulture));
            put("m", I(S.month)); put("d", I(S.day)); put("s", I(S.slot)); put("ph", S.phase); put("end", S.ending ?? "");
            put("cash", Num(S.cash)); put("debt", Num(S.debt)); put("hp", Num(S.hp)); put("addict", Num(S.addict)); put("faint", I(S.faint)); put("cleared", I(S.cleared)); put("stress", Num(S.stress)); put("fame", Num(S.galFame)); put("paid", I(S.paidMonth));
            put("realized", Num(S.realized)); put("augs", string.Join(",", S.augs));
            foreach (var kv in S.st.Numbers().OrderBy(k => k.Key, StringComparer.Ordinal)) put("st." + kv.Key, Num(kv.Value));
            put("n.posts", I(S.posts.Count)); put("n.tips", I(S.tips.Count)); put("n.feed", I(S.feed.Count)); put("gid", I(S.gid)); put("pid", I(S.pid));
            if (S.mk != null)
            {
                var keys = S.mk.tk.Keys.Concat(new[] { "reg" }).OrderBy(k => k, StringComparer.Ordinal);
                foreach (var k in keys)
                {
                    if (k == "reg") { put("reg", I(S.mk.reg)); continue; }
                    put("p." + k, Num(S.mk.tk[k].p)); put("tr." + k, I(S.mk.tk[k].tr));
                }
            }
            foreach (var k in S.hold.Keys.OrderBy(k => k, StringComparer.Ordinal)) { put("h." + k + ".q", Num(S.hold[k].q)); put("h." + k + ".c", Num(S.hold[k].cost)); }
            foreach (var c in S.cps) put("c." + c.id, string.Join(":", c.tk, I(c.dir), JsFmt.Num(c.lev), Num(c.margin), Num(c.entry), I(c.t0)));
            put("pend", S.pending != null ? S.pending.t : "");
            return string.Join(";", p);
        }
        public static string Hash(GameState S) => Fnv.Fnv1a(Of(S));
    }
}
