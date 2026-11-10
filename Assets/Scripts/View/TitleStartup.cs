using KwGame.Sim;

namespace KwGame.View
{
    public static class TitleStartup
    {
        private static bool requested;
        private static GameState restoredState;
        /// 새 게임 판 코드 시드 (0 = 무작위) · 난이도 ("easy"|"normal"|"hard")
        public static int Seed;
        public static string Diff = "normal";

        public static void RequestNewGame() => RequestNewGame(0, "normal");
        public static void RequestNewGame(int seed, string diff) { requested = true; restoredState = null; Seed = seed; Diff = string.IsNullOrEmpty(diff) ? "normal" : diff; }
        public static void RequestContinue(GameState state) { requested = true; restoredState = state; Seed = 0; Diff = "normal"; }

        public static bool Consume(out GameState state)
        {
            state = restoredState;
            bool result = requested;
            requested = false;
            restoredState = null;
            return result;
        }
    }
}
