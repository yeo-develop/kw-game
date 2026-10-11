using System;
using System.Collections;
using System.Text;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.Networking;

namespace KwGame.View
{
    /// LLM 워커(server/llm-worker) 설정. 저장 = PlayerPrefs. 명령줄: -kwLlmUrl <url> · -kwLlmOff · -kwLlmOn
    /// 기본: URL 이 있으면 켜짐. 끄면 게임은 예전과 똑같이(내장 문구·내장 뉴스) 돈다.
    public static class LlmSettings
    {
        public const string DefaultUrl = "https://kw-game-llm.kw-game-llm-worker.workers.dev";
        const string KUrl = "kw.llm.url", KOn = "kw.llm.on", KDev = "kw.llm.dev";

        public static string Url
        {
            get { var a = Arg("-kwLlmUrl"); return a ?? PlayerPrefs.GetString(KUrl, DefaultUrl); }
            set { PlayerPrefs.SetString(KUrl, value ?? ""); PlayerPrefs.Save(); }
        }
        public static bool On
        {
            get
            {
                if (HasArg("-kwLlmOff")) return false;
                if (HasArg("-kwLlmOn")) return !string.IsNullOrEmpty(Url);
                return !string.IsNullOrEmpty(Url) && PlayerPrefs.GetInt(KOn, 1) == 1;
            }
            set { PlayerPrefs.SetInt(KOn, value ? 1 : 0); PlayerPrefs.Save(); }
        }
        /// 기기 id (워커의 기기별 요청 한도 키). 무작위, 개인정보 아님.
        public static string DeviceId
        {
            get
            {
                var d = PlayerPrefs.GetString(KDev, "");
                if (d.Length < 8) { d = Guid.NewGuid().ToString("N"); PlayerPrefs.SetString(KDev, d); PlayerPrefs.Save(); }
                return d;
            }
        }
        static string Arg(string name) { var a = Environment.GetCommandLineArgs(); int i = Array.IndexOf(a, name); return i >= 0 && i + 1 < a.Length ? a[i + 1] : null; }
        static bool HasArg(string name) => Array.IndexOf(Environment.GetCommandLineArgs(), name) >= 0;
    }

    /// 워커 호출 (UnityWebRequest, 코루틴). 어떤 실패든 done(null 또는 {ok:false,…}) — 호출한 쪽은 내장 문구로 넘어간다.
    public static class LlmClient
    {
        public static int Sent, Ok, Failed; public static string LastError = "";

        public static IEnumerator Post(string path, JObject body, float timeout, Action<JObject> done)
        {
            string url = LlmSettings.Url;
            if (string.IsNullOrEmpty(url)) { done(null); yield break; }
            Sent++;
            using (var req = new UnityWebRequest(url.TrimEnd('/') + path, "POST"))
            {
                req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(body.ToString(Newtonsoft.Json.Formatting.None)));
                req.downloadHandler = new DownloadHandlerBuffer();
                req.SetRequestHeader("Content-Type", "application/json");
                req.SetRequestHeader("X-Device-Id", LlmSettings.DeviceId);
                req.timeout = Mathf.CeilToInt(timeout) + 1;
                var op = req.SendWebRequest();
                float t0 = Time.realtimeSinceStartup;
                while (!op.isDone)
                {
                    if (Time.realtimeSinceStartup - t0 > timeout) { req.Abort(); break; }
                    yield return null;
                }
                JObject res = null;
                string text = req.downloadHandler?.text;
                if (op.isDone && !string.IsNullOrEmpty(text)) { try { res = JObject.Parse(text); } catch (Exception) { res = null; } }
                bool ok = res != null && res.Value<bool?>("ok") == true;
                if (ok) Ok++;
                else
                {
                    Failed++;
                    LastError = res?.Value<string>("error") ?? (op.isDone ? (req.error ?? "bad_response") : "timeout");
                    Debug.Log($"[llm] {path} 실패: {LastError} → 내장 문구");
                }
                done(ok ? res : null);
            }
        }
    }
}
