using KwGame.Sim;

namespace KwGame.View
{
    public static class TitleStartup
    {
        private static bool requested;
        private static GameState restoredState;

        public static void RequestNewGame() { requested = true; restoredState = null; }
        public static void RequestContinue(GameState state) { requested = true; restoredState = state; }

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
