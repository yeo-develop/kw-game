using UnityEditor;
using UnityEngine;

namespace KwGame.EditorTools
{
    // Assets/Art 아래 이미지는 전부 UI용 스프라이트로 가져온다 (원본은 R2 kw-game/art-src/, docs/ART.md 참고).
    public class ArtImporter : AssetPostprocessor
    {
        void OnPreprocessTexture()
        {
            if (!assetPath.StartsWith("Assets/Art/")) return;
            var ti = (TextureImporter)assetImporter;
            ti.textureType = TextureImporterType.Sprite;
            ti.spriteImportMode = SpriteImportMode.Single;
            ti.mipmapEnabled = false;
            ti.alphaIsTransparency = true;
            ti.maxTextureSize = 2048;
            // 캐릭터는 발끝 기준으로 세우기 쉽게 피벗을 아래 가운데로.
            if (assetPath.StartsWith("Assets/Art/Characters/"))
            {
                var s = new TextureImporterSettings();
                ti.ReadTextureSettings(s);
                s.spriteAlignment = (int)SpriteAlignment.BottomCenter;
                ti.SetTextureSettings(s);
            }
        }
    }
}
