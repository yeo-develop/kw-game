using System.Collections;
using System.IO;
using KwGame.Sim;
using UnityEngine;

namespace KwGame.View
{
    // 스크린샷 데모: 빌드 실행 시 `-kwShots <폴더>` → 화면 몇 개를 찍고 종료 (검증용)
    public partial class GameController
    {
        IEnumerator UntilIdle() { while (playing) yield return null; yield return null; yield return null; }
        IEnumerator Shot(string dir, string name)
        {
            yield return null; yield return new WaitForEndOfFrame();
            ScreenCapture.CaptureScreenshot(Path.Combine(dir, name + ".png"));
            for (int i = 0; i < 4; i++) yield return null;
            Debug.Log("[shot] " + name);
        }
        /// home 이 나올 때까지 단순 선택으로 넘김
        IEnumerator ToHome()
        {
            for (int guard = 0; guard < 30 && S.pending != null && S.pending.t != "home" && S.pending.t != "ending"; guard++)
            {
                var P = S.pending;
                switch (P.t)
                {
                    case "menhera": case "impulse": Send("reply", "i", P.opts.FindIndex(o => o.ok)); break;
                    case "tempt": Send("tempt", "k", "no"); break;
                    case "payday": Send("payday", "k", P.opts.Find(o => !o.dis)?.k ?? "pay"); break;
                    case "loc": Send("leave"); break;
                    case "map": Send("goTo", "loc", "home"); break;
                    case "encounter": Send("encounter", "ask", false); break;
                    default: yield break;
                }
                yield return UntilIdle();
            }
        }
        IEnumerator DemoShots(string dir)
        {
            Directory.CreateDirectory(dir);
            yield return new WaitForSeconds(1f);
            yield return Shot(dir, "01_title");
            autoSkipDialog = false;
            Send("start");
            yield return new WaitForSeconds(0.5f);
            clicked = true; yield return null; clicked = true; yield return null; clicked = true;
            yield return new WaitForSeconds(0.3f);
            yield return Shot(dir, "02_dialogue");
            autoSkipDialog = true; clicked = true;
            yield return UntilIdle();
            yield return Shot(dir, "03_relic");
            Send("pickRelic", "i", 0); yield return UntilIdle();
            yield return ToHome();
            yield return Shot(dir, "04_home");
            Send("map"); yield return UntilIdle();
            yield return Shot(dir, "05_map");
            Send("goTo", "loc", "work"); yield return UntilIdle();
            if (S.pending.t == "encounter") { yield return Shot(dir, "05b_encounter"); Send("encounter", "ask", false); yield return UntilIdle(); }
            yield return Shot(dir, "06_loc_work");
            Send("act", "k", "l-cafe"); yield return UntilIdle();
            Send("mgSetup"); yield return UntilIdle();
            yield return Shot(dir, "07_minigame");
            Send("mgResult", "score", 0.8); yield return UntilIdle();
            yield return ToHome();
            phoneOpen = true; phoneTab = "stock"; RenderAll();
            yield return Shot(dir, "08_phone_stock");
            phoneTab = "gall"; RenderAll();
            yield return Shot(dir, "09_phone_gall");
            phoneOpen = false; RenderAll();
            // 엔딩 화면: 헤드리스 봇으로 끝까지 돌린 판을 그대로 띄움
            foreach (var (sd, strat, nm) in new[] { (11, "steady", "10_ending_clear"), (22, "gamble", "11_ending_bad2"), (11, "random", "12_ending_bad1") })
            {
                var r = Bots.Run(D, sd, strat);
                G = r.game; G.Hud = true; RenderAll();
                yield return Shot(dir, nm);
            }
            // 봇 명령열을 화면 경로(Send → 이벤트 재생 → RenderAll)로 재생: 모든 pending 화면이 예외 없이 그려지는지 + 화면별 첫 스크린샷
            int exc = 0;
            Application.logMessageReceived += (c, st, type) => { if (type == LogType.Exception || type == LogType.Error) exc++; };
            QualitySettings.vSyncCount = 0; Application.targetFrameRate = 1000;
            var seen = new System.Collections.Generic.HashSet<string>();
            foreach (var (sd, strat) in new[] { (1201, "random"), (33, "gamble"), (22, "invest") })
            {
                var rec = Bots.Run(D, sd, strat, record: true);
                G = GameSim.Create(D, sd); G.Hud = true; phoneOpen = false; RenderAll();
                int n = 0;
                foreach (var c in rec.cmds)
                {
                    Send(new SimCommand(c)); n++;
                    while (playing) yield return null;
                    string pt = S.pending?.t ?? "";
                    if (pt != "" && seen.Add(pt) && pt != "home" && pt != "map" && pt != "start" && pt != "relic") { yield return null; yield return Shot(dir, "p_" + pt); }
                }
                Debug.Log($"[shot] replay {strat}_{sd}: {n} cmds, end={S.ending}, hash={Digest.Hash(S)}");
            }
            Debug.Log($"[shot] view replay exceptions/errors: {exc}");
            Debug.Log("[shot] done");
            Application.Quit();
        }
    }
}
