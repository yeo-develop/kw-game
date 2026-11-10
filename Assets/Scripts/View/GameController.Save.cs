using System.Linq;
using KwGame.Persistence;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UIElements;

namespace KwGame.View
{
    public partial class GameController
    {
        VisualElement saveControls;
        string saveMessage = "선택 완료 후 자동 저장";
        bool CanSave => G != null && !playing && S.pending != null && S.pending.t != "start" && !(S.pending.t == "work" && S.pending.setup != null);   // 알바 미니게임 중엔 저장 X (불러와서 결과를 보고 폰 볼 순간을 고르는 수 방지)

        /// 대사창 아래 퀵메뉴 (옛 칸 방식만, 문예부식): 집 행동 · 폰 · 저장 · 타이틀 · 시간 속도
        void RenderSaveControls()
        {
            saveControls.Clear();
            if (G == null || S.pending?.t == "start") return;
            if (G.v4) { RenderPlanFoot(); return; }   // v4: 퀵메뉴 없음 — 폰 · 저장 · 타이틀은 계획판 아래 작은 줄 (GameController.Plan.cs) · 상태 카드
            bool home = S.pending?.t == "home" && !playing;
            Button Q(string text, System.Action a, bool dis = false, Color? bg = null)
            {
                var b = Ui.Chip(text, a, dis, bg ?? new Color(1, 1, 1, 0.06f)); b.style.flexShrink = 0; b.Q<Label>().style.whiteSpace = WhiteSpace.NoWrap;
                saveControls.Add(b); return b;
            }
            // 집 행동은 큰 타일 (피드백: 외출·쉬기·빚 갚기·대출이 잘 안 보임) — 왼쪽 색 띠 + 이름 + 한 줄 설명.
            // 동그라미 글자는 진짜 단축키(P)에만 (예전 장·미·→·Z 동그라미는 키처럼 보였지만 눌러도 안 됐음)
            bool compact = phoneOpen;   // 폰 열리면 대사창이 좁아져서 작게
            saveControls.style.flexWrap = compact ? Wrap.Wrap : Wrap.NoWrap;   // 좁을 때 넘치면 다음 줄로 (예전엔 오른쪽 버튼이 잘림)
            Button A(string glyph, Color c, string text, string hint, System.Action a, bool dis = false, Color? bg = null)
            {
                var b = Ui.Button("", a, null, dis, bg ?? new Color(1, 1, 1, 0.08f));
                if (compact && dis && glyph == null) { b.style.display = DisplayStyle.None; return b; }   // 폰이 열려 좁을 땐 지금 못 누르는 큰 타일(장 보는 중의 놀기·외출·쉬기)은 뺌
                b.Clear(); b.style.flexDirection = FlexDirection.Row; b.style.alignItems = Align.Center; b.style.flexShrink = 0;
                b.style.marginRight = compact ? 6 : 10; b.style.marginBottom = 0; b.style.paddingTop = 8; b.style.paddingBottom = 8; b.style.paddingLeft = 10; b.style.paddingRight = 16;
                if (!dis) Ui.Border(b, new Color(c.r, c.g, c.b, 0.7f), 2);
                bool light = !dis && bg.HasValue && Ui.IsLight(bg.Value);   // 분홍 배경(폰 열림)이면 글자를 어둡게
                if (glyph != null)
                {   // 진짜 키: 동그라미 안에 키 글자
                    var badge = Ui.Box(dis ? new Color(1, 1, 1, 0.1f) : c, 0, 22); badge.style.width = badge.style.height = compact ? 34 : 44; badge.style.alignItems = Align.Center; badge.style.justifyContent = Justify.Center; badge.style.marginRight = 10; badge.pickingMode = PickingMode.Ignore;
                    var g = Ui.Label(glyph, compact ? 19 : 24, dis ? Ui.Dim : Ui.IsLight(c) ? Ui.Ink : Color.white, true); g.pickingMode = PickingMode.Ignore; g.style.unityTextAlign = TextAnchor.MiddleCenter; badge.Add(g); b.Add(badge);
                }
                else { b.style.borderLeftWidth = 8; b.style.borderLeftColor = dis ? new Color(1, 1, 1, 0.15f) : c; b.style.paddingLeft = 14; }
                var col = new VisualElement(); col.pickingMode = PickingMode.Ignore; b.Add(col);
                var t = Ui.Label(text, compact ? 20 : 24, dis ? Ui.Dim : light ? Ui.Ink : Ui.Text, true); t.pickingMode = PickingMode.Ignore; t.style.whiteSpace = WhiteSpace.NoWrap; col.Add(t);
                if (!compact && !string.IsNullOrEmpty(hint)) { var h = Ui.Label(hint, 18, light ? Ui.InkSub : Ui.Dim); h.pickingMode = PickingMode.Ignore; h.style.whiteSpace = WhiteSpace.NoWrap; col.Add(h); }
                saveControls.Add(b); return b;
            }
            bool eve = G.isEve();
            A(null, new Color(0.25f, 0.5f, 0.95f), "외출", "알바·증권사·카지노…", () => Send("map"), !home);
            A(null, new Color(0.5f, 0.38f, 0.85f), eve ? "자기" : "쉬기", S.rt ? (eve ? $"내일 아침까지 · 체력 +{D.RULES.RT_HP_REST_EVE + D.RULES.RT_HP_SLEEP}" : $"{D.RULES.RT_REST / 60}시간 · 체력 +{D.RULES.RT_HP_REST}") : $"체력 +{(eve ? D.RULES.HP_REST_EVE : D.RULES.HP_REST)}", () => Send("rest"), !home).tooltip = (S.rt ? (eve ? "자정까지 잠 · " : $"{D.RULES.RT_REST / 60}시간 · ") : "") + (S.rt ? $"체력 +{(eve ? D.RULES.RT_HP_REST_EVE + D.RULES.RT_HP_SLEEP : D.RULES.RT_HP_REST)} · 스트레스 {D.RULES.RT_REST_ST:0}" + (G.sickName() != null ? $" · {G.sickName()} 반쯤 확률로 하루 빨리 나음" : "") : $"체력 +{(eve ? D.RULES.HP_REST_EVE : D.RULES.HP_REST)} · 스트레스 −22");
            bool canPay = home && S.cash >= 10000 && S.debt > 0;
            A(null, new Color(0.2f, 0.62f, 0.38f), "빚 갚기", $"남은 빚 {G.man(S.debt)}", () => Send("repayOpen"), !canPay, canPay ? new Color(0.16f, 0.36f, 0.24f, 1f) : (Color?)null).tooltip = $"남은 빚 {G.won(S.debt)} · 김사장 계좌로 바로 이체 (시간 안 씀)";
            A(null, new Color(0.85f, 0.25f, 0.25f), "김사장 대출", $"선이자 {G.loanFee() * 100:0}% · 한도 {G.man(G.loanCap())}", () => Send("loanOpen"), !home).tooltip = $"선이자 {G.loanFee() * 100:0}% · 한도 {G.man(G.loanCap())}";
            int unread = G.kUnread();
            A("P", new Color(0.95f, 0.4f, 0.6f), phoneOpen ? "폰 닫기" : "폰", phoneOpen ? "P 키" : unread > 0 ? $"안 읽은 카톡 {unread}" : "주식·코인·카톡·주갤", TogglePhone, false, phoneOpen ? Ui.Accent : (Color?)null);
            Q("설정", OpenSettings, playing).name = "settingsButton";
            var sp = new VisualElement(); sp.style.flexGrow = 1; saveControls.Add(sp);
            var status = Ui.Label(saveMessage, 18, Ui.Dim); status.name = "saveStatus"; status.style.marginRight = 10; status.style.whiteSpace = WhiteSpace.NoWrap; if (!compact) saveControls.Add(status);
            var save = Q("저장", () => SaveCheckpoint(true), !CanSave); save.name = "saveGameButton";
            var title = Q("타이틀", ReturnToTitle, playing); title.name = "returnToTitleButton";
        }
        static bool GameController_PhoneOk(string t) => PHONE_OK.Contains(t);

        /// WebGL: PlayerPrefs.Save() 가 IndexedDB 동기화(FS.syncfs)를 걸어 persistentDataPath 파일(저장·기록)도 브라우저에 남음. 데스크톱은 그냥 설정 저장
        public static void FlushPrefs() { try { PlayerPrefs.Save(); } catch (System.Exception) { } }

        public bool SaveCheckpoint(bool notify)
        {
            if (!CanSave || ShotMode.On) return false;   // 웹 캡처 모드: 자동 저장 포함 저장 안 함
            bool success = SaveStore.Default.TrySave(S, out var error);
            if (success) FlushPrefs();
            saveMessage = success ? $"저장 완료 · {System.DateTime.Now:HH:mm}" : error;
            if (notify || !success) Toast(saveMessage, success ? "good" : "liq");
            if (notify) RenderSaveControls();
            return success;
        }

        public void ReturnToTitle()
        {
            if (playing) return;
            if (!Application.CanStreamedLevelBeLoaded("Title"))
            {
                Toast("Title 씬이 빌드 목록에 없습니다.", "liq");
                return;
            }
            if (CanSave && !SaveCheckpoint(true)) return;
            SceneManager.LoadScene("Title");
        }

        void OnApplicationPause(bool paused)
        {
            if (paused) SaveCheckpoint(false);
        }

        void OnApplicationQuit() => SaveCheckpoint(false);
    }
}
