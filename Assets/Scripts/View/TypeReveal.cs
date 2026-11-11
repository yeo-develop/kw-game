namespace KwGame.View
{
    /// 대사 타자 효과의 상태 (화면과 분리 — 테스트 가능). 글자는 항상 앞에서부터 차례로 보인다.
    /// 화면 쪽(GameController.Type.cs)은 글자별 불투명도(Alpha)만 받아 글리프에 칠한다.
    /// 예전엔 글자별 메시를 추측으로 짝짓는 플러그인을 썼는데, 줄이 "…" 처럼 낮은 글자로 시작하면 짝이 한 칸씩 밀려 낱말 끝 글자가 사라졌다.
    public sealed class TypeReveal
    {
        /// 글자 · 쉼표류 · 마침표류 뒤에 쉬는 시간(초). 예전 값 그대로
        public const float Normal = 0.03f, Middle = 0.2f, Long = 0.6f;
        /// 방금 나온 글자 몇 개는 옅게 (툭툭 끊기지 않고 번지듯 나타남)
        public const int Tail = 2;

        public string Text { get; private set; } = "";
        /// 보이는 글자 수 (앞에서부터). 공백 · 이음표는 앞 글자와 함께 넘어감
        public int Shown { get; private set; }
        /// 쉬는 시간 배수 (설정의 글자 속도). 0 이하 = 즉시
        public float Speed = 1f;
        float wait;
        int[] ord = new int[0];   // i 번째 글자 앞에 있는 '보이는 글자' 수 (공백 · 이음표 제외)
        int shownOrd;

        public bool Typing => Shown < Text.Length;

        public void Start(string text)
        {
            Text = text ?? ""; Shown = 0; wait = 0; shownOrd = 0;
            if (ord.Length < Text.Length) ord = new int[Text.Length];
            for (int i = 0, n = 0; i < Text.Length; i++) { ord[i] = n; if (!Silent(Text[i])) n++; }
            if (Speed <= 0) Shown = Text.Length; else if (Text.Length > 0) Step();
        }

        public void Complete() { Shown = Text.Length; wait = 0; }

        /// dt 초가 흐름. 보이는 글자 수가 바뀌었으면 true
        public bool Tick(float dt)
        {
            if (!Typing) return false;
            if (Speed <= 0) { Complete(); return true; }
            int before = Shown;
            wait -= dt;
            for (int n = 0; Typing && wait <= 0 && n < 64; n++) Step();   // 한 프레임이 길어도 한꺼번에 쏟아지지 않게 상한
            return Shown != before;
        }

        void Step()
        {
            char c = Text[Shown++];
            if (!Silent(c)) shownOrd++;
            while (Shown < Text.Length && Silent(Text[Shown])) Shown++;
            if (Typing) wait += Delay(c, Text[Shown]) * Speed;
        }

        /// 자리만 차지하는 글자: 기다리지 않고 앞 글자와 함께 넘어감
        static bool Silent(char c) => char.IsWhiteSpace(c) || c == Ui.WJ;

        /// c 를 보여 준 뒤 다음 글자까지 쉬는 시간. 문장 부호가 이어지면("?!" · "…") 한 번만 길게
        public static float Delay(char c, char next)
        {
            if (char.IsPunctuation(c) && char.IsPunctuation(next)) return Normal;
            switch (c)
            {
                case ';': case ':': case ')': case '-': case ',': return Middle;
                case '!': case '?': case '.': return Long;
            }
            return Normal;
        }

        /// i 번째 글자의 불투명도 (0~255). 앞 글자는 뒷 글자보다 옅지 않다 — 순서가 뒤섞여 보일 수 없음
        public byte Alpha(int i)
        {
            if (i < 0 || i >= Shown) return 0;
            if (!Typing) return 255;
            int back = shownOrd - 1 - ord[i];   // 가장 최근에 나온 글자 = 0 (공백 · 이음표는 세지 않음)
            return back >= Tail ? (byte)255 : (byte)(255 * (back + 1) / (Tail + 1));
        }
    }
}
