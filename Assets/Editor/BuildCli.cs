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
