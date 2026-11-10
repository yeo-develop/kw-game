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
                case "cash":
                    if (e.Str("k") == "work" || e.Str("k") == "interest") return null;   // 일당 · 이자 = EventCue
                    amount = e.Num("d"); break;
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

        /// 돈 말고 게임 흐름 이벤트 소리: 청산 · 카톡 · 호감 · 부탁 · 해금 · 속보 · 일당 · 이자 · 상환 · 엔딩 · 기절 · 아침 · 카톡 폭탄
        public static SoundCue? EventCue(SimEvent e)
        {
            switch (e.t)
            {
                case "fx": return e.Str("k") == "ash" ? SoundCue.Liquidation : (SoundCue?)null;
                case "liveLiq": return SoundCue.Liquidation;
                case "kakao":   // 내가 보낸 말 · 시스템 메시지는 조용히
                    if (e.Str("w") == "me" || e.Str("w") == "sys") return null;
                    return e.Str("room") == "kim" ? SoundCue.Kim : SoundCue.Kakao;
                case "aff": return e.Num("d") > 0 ? SoundCue.AffUp : e.Num("d") < 0 ? SoundCue.AffDown : (SoundCue?)null;
                case "prom": return e["ok"] is bool ok ? (ok ? SoundCue.AffUp : SoundCue.AffDown) : (SoundCue?)null;
                case "unlock": return SoundCue.Unlock;
                case "gate": return e["ok"] is bool gok ? (gok ? SoundCue.Repaid : SoundCue.Kim) : (SoundCue?)null;   // 납부 관문: 통과 / 미납
                case "toast": return e.Str("kind") == "news" && e.Str("room") == "flash" ? SoundCue.News : (SoundCue?)null;   // 칸 시작 속보만
                case "cash":
                    if (e.Str("k") == "work" && e.Num("d") > 0) return SoundCue.WorkPay;
                    if (e.Str("k") == "interest" && e.Num("d") < 0) return SoundCue.Repaid;   // 이자 냄 = 손실음 말고 '냈다'
                    return null;
                case "repaid": return e.Num("a") > 0 ? SoundCue.Repaid : (SoundCue?)null;
                case "ending":
                    string kind = e.Str("kind"), v = e.Str("variant");
                    if (kind == "clear") return v == "lonely" ? SoundCue.AffDown : SoundCue.Clear;   // 미래가 떠난 클리어는 씁쓸하게
                    return kind == "heist" ? SoundCue.Clear : SoundCue.BadEnding;
                case "faint": return SoundCue.Faint;
                case "morning": return SoundCue.Morning;
                case "menhera": return SoundCue.Menhera;
                default: return null;
            }
        }

        public static void Play(SimEvent e, int closedCoins)
        {
            var financial = FinancialCue(e, closedCoins);
            if (financial.HasValue) GameAudioManager.Play(financial.Value);
            else if (IsSuccessfulOrder(e, closedCoins)) GameAudioManager.Play(SoundCue.TradeSuccess);   // 매도·청산은 손익 소리 하나만 (겹침 방지)
            var cue = EventCue(e);
            if (cue.HasValue) GameAudioManager.Play(cue.Value);
        }
    }
}
