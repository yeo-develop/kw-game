using KwGame.Sim;

namespace KwGame.Audio
{
    public static class SoundEventAdapter
    {
        public static bool IsSuccessfulOrder(SimEvent e, int closedCoins)
        {
            if (e.t != "trade" || !(e["ok"] is bool ok) || !ok) return false;
            switch (e.Str("op"))
            {
                case "buy": case "sell": case "open": case "close": return true;
                case "closeCoins": return closedCoins > 0;
                default: return false;
            }
        }

        public static SoundCue? FinancialCue(SimEvent e, int closedCoins = 0)
        {
            double amount;
            switch (e.t)
            {
                case "trade":
                    if (!IsSuccessfulOrder(e, closedCoins)) return null;
                    string op = e.Str("op");
                    if (op != "sell" && op != "close" && op != "closeCoins") return null;
                    amount = e.Num("pnl"); break;
                case "cash": amount = e.Num("d"); break;
                case "casino": case "race": amount = e.Num("net"); break;
                case "scratch":
                    if (!(e["prize"] is object[] prize) || prize.Length < 2) return null;
                    amount = System.Convert.ToDouble(prize[1]);
                    return amount > 0 ? SoundCue.Income : (SoundCue?)null;
                case "lottoDraw": return e.Num("tot") > 0 ? SoundCue.Income : (SoundCue?)null;
                case "fx": return e.Str("k") == "ash" ? SoundCue.Loss : (SoundCue?)null;
                default: return null;
            }
            return amount > 0 ? SoundCue.Income : amount < 0 ? SoundCue.Loss : (SoundCue?)null;
        }

        public static void Play(SimEvent e, int closedCoins)
        {
            if (IsSuccessfulOrder(e, closedCoins)) GameAudioManager.Play(SoundCue.TradeSuccess);
            var financial = FinancialCue(e, closedCoins);
            if (financial.HasValue) GameAudioManager.Play(financial.Value);
        }
    }
}
