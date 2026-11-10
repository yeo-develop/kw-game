using System;
using System.Collections;
#if UNITY_WEBGL && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif
using UnityEngine;

namespace KwGame.View
{
    /// 웹 캡처 모드: WebGL 주소에 kwShots 가 있으면 켜짐 (예: …/index.html?kwShots=1).
    /// 화면을 하나씩 띄우고 콘솔에 "[shot] 05_home_day" 한 줄 → 바깥 드라이버(Playwright)가 그 순간 페이지를 찍음 → 0.8초(실시간) 그대로 멈춤.
    /// 켜져 있는 동안 저장 · 기록 · 설정 · 읽은 대사 표시는 쓰지 않고, 저장을 불러오지도 않음 (늘 새 판).
    /// 독립 실행형 `-kwShots <폴더>` (GameController.Demo.cs) 와는 따로 — 그쪽은 예전대로 파일로 저장.
    public static class ShotMode
    {
        public const float Hold = 0.8f, Limit = 540f;
        static int on = -1;
        static float deadline = -1;
        /// 다음 화면 순번 (타이틀 씬에서 시작해 게임 씬으로 이어짐)
        public static int N;

        public static bool On { get { if (on < 0) on = Detect() ? 1 : 0; return on == 1; } }

        static bool Detect()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            try { var u = Application.absoluteURL; return !string.IsNullOrEmpty(u) && u.IndexOf("kwShots", StringComparison.Ordinal) >= 0; }
            catch (Exception) { return false; }
#else
            return false;
#endif
        }

        /// 전체 제한 시간 시작 (처음 부를 때 한 번만)
        public static void Begin() { if (deadline < 0) deadline = Time.realtimeSinceStartup + Limit; }
        public static bool TimeUp => deadline > 0 && Time.realtimeSinceStartup > deadline;

        /// "05_home_day" (두 자리 순번 + 이름). 건너뛴 화면도 번호를 씀 → 다음 배포 때도 같은 화면은 같은 번호
        public static string Next(string name) => (N++).ToString("00") + "_" + name;

#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] static extern void KwShotLog(string s);
#endif
        public static void Log(string line)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            try { KwShotLog(line); return; } catch (Exception) { }
#endif
            Debug.Log(line);
        }

        /// 연출이 자리 잡을 때까지 settle 초 → 두 프레임 → "[shot] 이름" → 0.8초 멈춤 (Time.timeScale 무관)
        public static IEnumerator Shot(string name, float settle = 0.2f)
        {
            if (settle > 0) yield return new WaitForSecondsRealtime(settle);
            yield return null; yield return null;
            Log("[shot] " + Next(name));
            yield return new WaitForSecondsRealtime(Hold);
        }

        public static void Skip(string name, string why) => Log("[shot] skip " + Next(name) + ": " + why);
    }
}
