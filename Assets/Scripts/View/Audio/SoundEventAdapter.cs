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
                case "fx": return null;   // 청산 = EventCue (Liquidation)
                default: return null;
            }
            return amount > 0 ? SoundCue.Income : amount < 0 ? SoundCue.Loss : (SoundCue?)null;
        }

        /// 돈 말고 게임 흐름 이벤트 소리: 청산 · 카톡 · 호감 · 해금 · 속보 · 상환 · 엔딩 · 기절 · 아침 · 카톡 폭탄
        public static SoundCue? EventCue(SimEvent e)
        {
            switch (e.t)
            {
                case "fx": return e.Str("k") == "ash" ? SoundCue.Liquidation : (SoundCue?)null;
                case "liveLiq": return SoundCue.Liquidation;
                case "kakao": return e.Str("room") == "kim" ? SoundCue.Kim : SoundCue.Kakao;
                case "aff": return e.Num("d") > 0 ? SoundCue.AffUp : e.Num("d") < 0 ? SoundCue.AffDown : (SoundCue?)null;
                case "toast":
                    if (e.Str("kind") == "good" && e.Str("app") == "kakao" && e.Str("room") == "kim") return SoundCue.Unlock;   // 대출 · 레버리지 · 숏 해금
                    return e.Str("kind") == "news" ? SoundCue.News : (SoundCue?)null;
                case "repaid": return e.Num("a") > 0 ? SoundCue.Repaid : (SoundCue?)null;
                case "ending": return e.Str("kind") == "clear" ? SoundCue.Clear : SoundCue.BadEnding;
                case "faint": return SoundCue.Faint;
                case "morning": return SoundCue.Morning;
                case "menhera": return SoundCue.Menhera;
                default: return null;
            }
        }

        public static void Play(SimEvent e, int closedCoins)
        {
            if (IsSuccessfulOrder(e, closedCoins)) GameAudioManager.Play(SoundCue.TradeSuccess);
            var financial = FinancialCue(e, closedCoins);
            if (financial.HasValue) GameAudioManager.Play(financial.Value);
            var cue = EventCue(e);
            if (cue.HasValue) GameAudioManager.Play(cue.Value);
        }
    }
}
