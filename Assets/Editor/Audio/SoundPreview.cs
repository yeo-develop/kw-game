using System;
using System.Reflection;
using UnityEditor;
using UnityEngine;

namespace KwGame.EditorTools
{
    static class SoundPreview
    {
        static readonly Type AudioUtil = typeof(AudioImporter).Assembly.GetType("UnityEditor.AudioUtil");
        static readonly MethodInfo PlayMethod = AudioUtil?.GetMethod("PlayPreviewClip", BindingFlags.Public | BindingFlags.Static, null,
            new[] { typeof(AudioClip), typeof(int), typeof(bool) }, null);
        static readonly MethodInfo StopMethod = AudioUtil?.GetMethod("StopAllPreviewClips", BindingFlags.Public | BindingFlags.Static);
        static bool ownsPreview;

        public static void Play(AudioClip clip, bool loop)
        {
            if (clip == null) return;
            if (PlayMethod == null || StopMethod == null) { Debug.LogWarning("[Audio] 현재 Unity 버전에서 에디터 미리 듣기를 지원하지 않습니다."); return; }
            Stop();
            PlayMethod.Invoke(null, new object[] { clip, 0, loop });
            ownsPreview = true;
        }

        public static void Stop()
        {
            if (!ownsPreview) return;
            StopMethod?.Invoke(null, null);
            ownsPreview = false;
        }
    }
}
