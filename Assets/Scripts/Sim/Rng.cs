// 난수 규격 rngv 2 (docs/ARCHITECTURE.md §6). web/src/sim/rng.js 와 비트 단위로 같아야 한다.
// 모든 파생값은 IEEE-754 double 사칙연산만 쓴다 (Math.Exp/Log/Pow 금지).
namespace KwGame.Sim
{
    public static class Rng
    {
        public const double LN2 = 0.6931471805599453;
        const double U32 = 4294967296.0;

        /// mulberry32 한 걸음: 상태 a 를 진행하고 uint32 출력을 돌려준다.
        public static uint Next(ref uint a)
        {
            unchecked
            {
                a += 0x6D2B79F5u;
                uint t = (a ^ (a >> 15)) * (a | 1u);
                t = (t + ((t ^ (t >> 7)) * (t | 61u))) ^ t;
                return t ^ (t >> 14);
            }
        }

        /// 0 ≤ x < 1
        public static double Float(ref uint a) => Next(ref a) / U32;

        /// Irwin–Hall: float 12개 합 − 6
        public static double Gauss(ref uint a)
        {
            double s = 0;
            for (int i = 0; i < 12; i++) s += Float(ref a);
            return s - 6;
        }

        /// e^x (x = k·ln2 + r, 테일러 20항, 2^k 는 곱셈/나눗셈 반복)
        public static double PExp(double x)
        {
            if (x > 700) x = 700;
            if (x < -700) return 0;
            double k = System.Math.Floor(x / LN2 + 0.5), r = x - k * LN2;
            double term = 1, sum = 1;
            for (int i = 1; i <= 20; i++) { term = term * r / i; sum += term; }
            double y = sum;
            if (k > 0) for (int i = 0; i < k; i++) y *= 2;
            else for (int i = 0; i < -k; i++) y /= 2;
            return y;
        }

        /// ln x (x = m·2^e, 1 ≤ m < 2, 2·atanh 급수 30항)
        public static double PLog(double x)
        {
            if (!(x > 0)) return double.NegativeInfinity;
            double m = x; int e = 0;
            while (m >= 2) { m /= 2; e++; }
            while (m < 1) { m *= 2; e--; }
            double s = (m - 1) / (m + 1), s2 = s * s;
            double term = s, sum = 0;
            for (int i = 0; i < 30; i++) { sum += term / (2 * i + 1); term *= s2; }
            return 2 * sum + e * LN2;
        }
    }

    public static class MathK
    {
        /// floor(x + 0.5). Math.Round(은행가 반올림) 쓰지 말 것.
        public static double RoundHalfUp(double x) => System.Math.Floor(x + 0.5);
        public static double Round1k(double x) => RoundHalfUp(x / 1000) * 1000;
        public static double Clamp(double v, double a, double b) => System.Math.Max(a, System.Math.Min(b, v));
        public static int Floor(double x) => (int)System.Math.Floor(x);
    }

    /// FNV-1a 32 (문자 코드 & 0xff — digest 는 ASCII)
    public static class Fnv
    {
        public static string Fnv1a(string s)
        {
            unchecked
            {
                uint h = 0x811c9dc5;
                for (int i = 0; i < s.Length; i++) { h ^= (uint)(s[i] & 0xff); h *= 0x01000193; }
                return h.ToString("x8");
            }
        }
    }
}
