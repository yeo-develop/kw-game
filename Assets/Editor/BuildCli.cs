using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace KwGame.EditorTools
{
    // ./unity 스크립트가 -executeMethod 로 호출하는 진입점 모음.
    public static class BuildCli
    {
        const string BootScenePath = "Assets/Scenes/Boot.unity";
        const string MainScenePath = "Assets/Scenes/Main.unity";

        // web/src/data/*.json → Assets/Resources/Data (JSON 단일 원본 유지). 메뉴 또는 ./unity exec KwGame.EditorTools.BuildCli.SyncData
        [MenuItem("KwGame/Sync Data (web → Resources)")]
        public static void SyncData()
        {
            var src = Path.GetFullPath(Path.Combine(Application.dataPath, "../web/src/data"));
            var dst = Path.Combine(Application.dataPath, "Resources/Data");
            Directory.CreateDirectory(dst);
            var names = Directory.GetFiles(src, "*.json").Select(Path.GetFileName).ToArray();
            foreach (var f in Directory.GetFiles(dst, "*.json"))
                if (!names.Contains(Path.GetFileName(f))) { File.Delete(f); if (File.Exists(f + ".meta")) File.Delete(f + ".meta"); }
            foreach (var n in names) File.Copy(Path.Combine(src, n), Path.Combine(dst, n), true);
            AssetDatabase.Refresh();
            Debug.Log($"[BuildCli] sync data: {names.Length} files {src} → {dst}");
        }

        // Main 씬(카메라 + GameController) 생성·빌드 설정 맨 앞에 등록. 여러 번 실행해도 안전.
        [MenuItem("KwGame/Make Main Scene")]
        public static void MakeMainScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var cam = new GameObject("Main Camera").AddComponent<Camera>();
            cam.tag = "MainCamera";
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color32(0x14, 0x14, 0x1c, 0xff);
            new GameObject("Game").AddComponent<KwGame.View.GameController>();
            Directory.CreateDirectory(Path.GetDirectoryName(MainScenePath));
            EditorSceneManager.SaveScene(scene, MainScenePath);
            var others = EditorBuildSettings.scenes.Where(s => s.path != MainScenePath).Select(s => new EditorBuildSettingsScene(s.path, false));
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(MainScenePath, true) }.Concat(others).ToArray();
            AssetDatabase.SaveAssets();
            Debug.Log("[BuildCli] main scene ready");
        }

        // ./unity init : 기본 씬·플레이어 설정을 만든다. 여러 번 실행해도 안전하다.
        public static void Init()
        {
            PlayerSettings.companyName = "kw-game";
            PlayerSettings.productName = "롱잡고알바감";
            PlayerSettings.defaultScreenWidth = 1920;
            PlayerSettings.defaultScreenHeight = 1080;
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.resizableWindow = true;
            PlayerSettings.runInBackground = true;
            PlayerSettings.SetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.Standalone, "uk.nolss.kwgame");

            if (!File.Exists(BootScenePath))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(BootScenePath));
                var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);
                EditorSceneManager.SaveScene(scene, BootScenePath);
            }

            if (!EditorBuildSettings.scenes.Any(s => s.path == BootScenePath))
            {
                EditorBuildSettings.scenes = EditorBuildSettings.scenes
                    .Prepend(new EditorBuildSettingsScene(BootScenePath, true))
                    .ToArray();
            }

            AssetDatabase.SaveAssets();
            MakeMainScene();
            Debug.Log("[BuildCli] init done");
        }

        public static void BuildMac() => Build(BuildTarget.StandaloneOSX, "Builds/Mac/롱잡고알바감.app");

        public static void BuildWindows() => Build(BuildTarget.StandaloneWindows64, "Builds/Windows/롱잡고알바감.exe");

        public static void BuildWebGL() => Build(BuildTarget.WebGL, "Builds/WebGL");

        static void Build(BuildTarget target, string defaultOutput)
        {
            var scenes = EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray();
            if (scenes.Length == 0)
            {
                Debug.LogError("[BuildCli] 빌드할 씬이 없다. ./unity init 을 먼저 실행할 것.");
                EditorApplication.Exit(2);
                return;
            }

            var options = new BuildPlayerOptions
            {
                scenes = scenes,
                target = target,
                locationPathName = GetArg("-outputPath") ?? defaultOutput,
                options = HasArg("-development") ? BuildOptions.Development : BuildOptions.None,
            };

            var report = BuildPipeline.BuildPlayer(options);
            var summary = report.summary;
            Debug.Log($"[BuildCli] {summary.result} {target} → {summary.outputPath} " +
                      $"({summary.totalSize / 1024 / 1024} MB, {summary.totalTime:mm\\:ss}, errors {summary.totalErrors})");
            EditorApplication.Exit(summary.result == BuildResult.Succeeded ? 0 : 1);
        }

        static string GetArg(string name)
        {
            var args = Environment.GetCommandLineArgs();
            var i = Array.IndexOf(args, name);
            return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
        }

        static bool HasArg(string name) => Environment.GetCommandLineArgs().Contains(name);
    }
}
