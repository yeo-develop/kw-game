using System;
using KwGame.Audio;
using UnityEditor;
using UnityEngine;

namespace KwGame.EditorTools
{
    public static class SoundDefaults
    {
        public const string CatalogPath = "Assets/Resources/Audio/SoundCatalog.asset";
        static readonly string[,] Files =
        {
            { "freesound_gamestudio-clear-combo-1-394489.mp3", "SFX_TradeSuccess.mp3" },
            { "freesound_gamestudio-fall-394469.mp3", "SFX_ButtonClick.mp3" },
            { "freesound_gamestudio-material-gold-394476.mp3", "SFX_Income.mp3" },
            { "freesound_community-damage-40114.mp3", "SFX_Loss.mp3" },
            { "moodmode-no-copyright-music-201745.mp3", "BGM_DefaultLoop.mp3" },
            { "juniorsoundays-ui-sound-22-527807.mp3", "SFX_UI_Alternate.mp3" }
        };

        public static void Initialize()
        {
            EnsureCatalog();
            Debug.Log("[Audio] 기본 음원 5개 연결 완료.");
        }

        public static SoundCatalog EnsureCatalog()
        {
            if (!AssetDatabase.IsValidFolder("Assets/Resources/Audio")) AssetDatabase.CreateFolder("Assets/Resources", "Audio");
            for (int i = 0; i < Files.GetLength(0); i++)
            {
                string oldPath = "Assets/Sound/" + Files[i, 0], newPath = "Assets/Sound/" + Files[i, 1];
                if (AssetDatabase.LoadAssetAtPath<AudioClip>(oldPath) == null) continue;
                if (AssetDatabase.LoadAssetAtPath<AudioClip>(newPath) != null) throw new InvalidOperationException("음원 이름이 중복됩니다: " + newPath);
                string error = AssetDatabase.MoveAsset(oldPath, newPath);
                if (!string.IsNullOrEmpty(error)) throw new InvalidOperationException(error);
            }
            var catalog = AssetDatabase.LoadAssetAtPath<SoundCatalog>(CatalogPath);
            if (catalog == null)
            {
                catalog = ScriptableObject.CreateInstance<SoundCatalog>();
                AssetDatabase.CreateAsset(catalog, CatalogPath);
            }
            Undo.RecordObject(catalog, "기본 사운드 연결");
            Assign(catalog.tradeSuccess, "SFX_TradeSuccess.mp3");
            Assign(catalog.buttonClick, "SFX_ButtonClick.mp3");
            Assign(catalog.income, "SFX_Income.mp3");
            Assign(catalog.loss, "SFX_Loss.mp3");
            Assign(catalog.backgroundMusic, "BGM_DefaultLoop.mp3");
            EditorUtility.SetDirty(catalog);
            AssetDatabase.SaveAssetIfDirty(catalog);
            return catalog;
        }

        static void Assign(SoundClip sound, string filename)
        {
            string path = "Assets/Sound/" + filename;
            if (sound.clip == null) sound.clip = AssetDatabase.LoadAssetAtPath<AudioClip>(path);
            var importer = AssetImporter.GetAtPath(path) as AudioImporter;
            if (importer == null) return;
            bool music = filename.StartsWith("BGM_", StringComparison.Ordinal);
            var settings = importer.defaultSampleSettings;
            var loadType = music ? AudioClipLoadType.Streaming : AudioClipLoadType.DecompressOnLoad;
            if (settings.loadType == loadType && settings.preloadAudioData == !music && importer.loadInBackground == music) return;
            settings.loadType = loadType;
            settings.preloadAudioData = !music;
            importer.defaultSampleSettings = settings;
            importer.loadInBackground = music;
            importer.SaveAndReimport();
        }
    }
}
