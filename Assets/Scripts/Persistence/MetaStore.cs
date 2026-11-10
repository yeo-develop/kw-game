using System;
using System.IO;
using KwGame.Sim;
using UnityEngine;

namespace KwGame.Persistence
{
    /// 판을 넘어 쌓이는 기록 (엔딩 도감·업적·최근 판) 파일. 저장 슬롯과 같은 폴더의 meta.json
    public sealed class MetaStore
    {
        const int MaxFileBytes = 4 * 1024 * 1024;
        readonly string directory;
        public static MetaStore Default { get; } = new MetaStore(Path.Combine(Application.persistentDataPath, "Saves"));
        public string MetaPath => Path.Combine(directory, "meta.json");

        public MetaStore(string directory) { this.directory = directory; }

        /// 없거나 망가졌으면 새 기록 (예외 안 던짐)
        public MetaProgress Load()
        {
            try
            {
                if (!File.Exists(MetaPath) || new FileInfo(MetaPath).Length > MaxFileBytes) return new MetaProgress();
                return MetaProgress.FromJson(File.ReadAllText(MetaPath));
            }
            catch (Exception) { return new MetaProgress(); }
        }

        /// 임시 파일에 쓰고 바꿔치기 (SaveStore 와 같은 방식)
        public bool TrySave(MetaProgress m, out string error)
        {
            var temporary = MetaPath + ".tmp";
            try
            {
                if (m == null) throw new ArgumentNullException(nameof(m));
                var bytes = System.Text.Encoding.UTF8.GetBytes(m.ToJson());
                if (bytes.Length > MaxFileBytes) throw new InvalidDataException("기록 데이터가 너무 큽니다.");
                Directory.CreateDirectory(directory);
                using (var stream = new FileStream(temporary, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    stream.Write(bytes, 0, bytes.Length);
                    stream.Flush(true);
                }
                if (File.Exists(MetaPath)) File.Replace(temporary, MetaPath, null);
                else File.Move(temporary, MetaPath);
                error = null;
                return true;
            }
            catch (Exception e)
            {
                error = "기록을 저장하지 못했습니다: " + e.Message;
                return false;
            }
            finally
            {
                try { if (File.Exists(temporary)) File.Delete(temporary); }
                catch (IOException) { }
                catch (UnauthorizedAccessException) { }
            }
        }
    }
}
