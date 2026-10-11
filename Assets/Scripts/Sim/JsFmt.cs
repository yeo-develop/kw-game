using System;
using System.Globalization;
using System.Numerics;
using System.Text;

namespace KwGame.Sim
{
    /// JS 숫자 → 문자열 변환을 그대로 흉내 (문구가 갤 글 중복 판정에 쓰이므로 정확해야 함).
    public static class JsFmt
    {
        static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        /// Number.prototype.toFixed(f): 정확한 이진값 기준, 동률이면 큰 쪽 (|x| < 1e21 가정)
        public static string ToFixed(double x, int f)
        {
            if (double.IsNaN(x)) return "NaN";
            bool neg = x < 0;
            double a = Math.Abs(x);
            long bitsL = BitConverter.DoubleToInt64Bits(a);
            int exp = (int)((bitsL >> 52) & 0x7FF);
            long frac = bitsL & 0xFFFFFFFFFFFFFL;
            BigInteger m; int e;
            if (exp == 0) { m = frac; e = -1074; }
            else { m = frac | (1L << 52); e = exp - 1075; }
            BigInteger p10 = BigInteger.Pow(10, f);
            BigInteger n;
            if (e >= 0) n = m * BigInteger.Pow(2, e) * p10;
            else
            {
                BigInteger den = BigInteger.Pow(2, -e);
                n = (2 * m * p10 + den) / (2 * den);   // floor(v·10^f + 1/2)
            }
            string s = n.ToString(Inv);
            if (f > 0)
            {
                if (s.Length <= f) s = new string('0', f - s.Length + 1) + s;
                s = s.Substring(0, s.Length - f) + "." + s.Substring(s.Length - f);
            }
            if (neg && n != 0) s = "-" + s;
            else if (neg && x != 0) s = "-" + s;   // JS: (-0.001).toFixed(1) = "-0.0"
            return s;
        }

        /// toLocaleString("ko-KR") — 정수만 (sim 은 항상 반올림 뒤에 부름)
        public static string Loc(double n)
        {
            if (n == Math.Floor(n) && Math.Abs(n) < 9e15) return ((long)n).ToString("#,0", Inv);
            // 소수: 최대 3자리 (JS 기본)
            string s = ToFixed(n, 3).TrimEnd('0').TrimEnd('.');
            int dot = s.IndexOf('.');
            string ip = dot < 0 ? s : s.Substring(0, dot);
            long iv = long.Parse(ip, Inv);
            string head = (ip.StartsWith("-") && iv == 0 ? "-" : "") + iv.ToString("#,0", Inv);
            return dot < 0 ? head : head + s.Substring(dot);
        }

        /// String(number)
        public static string Num(double x)
        {
            if (double.IsNaN(x)) return "NaN";
            if (double.IsPositiveInfinity(x)) return "Infinity";
            if (double.IsNegativeInfinity(x)) return "-Infinity";
            if (x == 0) return "0";
            if (x == Math.Floor(x) && Math.Abs(x) < 1e21)
            {
                if (Math.Abs(x) < 9e18) return ((long)x).ToString(Inv);
                return new BigInteger(x).ToString(Inv);
            }
            string r = null;
            for (int p = 1; p <= 17; p++)
            {
                r = x.ToString("E" + (p - 1), Inv);
                if (double.Parse(r, Inv) == x) break;
            }
            // r = d.ddddE+xxx → JS 형식
            int ei = r.IndexOf('E');
            string mant = r.Substring(0, ei);
            int ex = int.Parse(r.Substring(ei + 1), Inv);
            bool neg = mant.StartsWith("-");
            if (neg) mant = mant.Substring(1);
            string digits = mant.Replace(".", "");
            var sb = new StringBuilder();
            if (neg) sb.Append('-');
            int k = digits.Length, n = ex + 1;
            if (k <= n && n <= 21) { sb.Append(digits).Append('0', n - k); }
            else if (0 < n && n <= 21) { sb.Append(digits, 0, n).Append('.').Append(digits, n, k - n); }
            else if (-6 < n && n <= 0) { sb.Append("0.").Append('0', -n).Append(digits); }
            else
            {
                sb.Append(digits[0]);
                if (k > 1) sb.Append('.').Append(digits, 1, k - 1);
                sb.Append('e').Append(n - 1 >= 0 ? "+" : "-").Append(Math.Abs(n - 1));
            }
            return sb.ToString();
        }

        /// 템플릿 값 → 문자열 (JS String(v))
        public static string Str(object v)
        {
            switch (v)
            {
                case null: return "";
                case string s: return s;
                case double d: return Num(d);
                case int i: return i.ToString(Inv);
                case long l: return l.ToString(Inv);
                case float f: return Num(f);
                case bool b: return b ? "true" : "false";
                default: return v.ToString();
            }
        }
    }
}
