using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using KwGame.Sim;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Sirenix.Serialization;
using UnityEngine;

namespace KwGame.Persistence
{
    public sealed class SaveRecord
    {
        public GameState State { get; internal set; }
        public DateTime SavedUtc { get; internal set; }
        public bool FromBackup { get; internal set; }
        public string Summary => $"{State.month}개월 {State.day}일 · {SavedUtc.ToLocalTime():MM/dd HH:mm}" + (FromBackup ? " · 백업 복구" : "");
    }

    public sealed class SaveStore
    {
        public const int FormatVersion = 1;
        const int MaxFileBytes = 16 * 1024 * 1024;
        readonly string directory;
        public static SaveStore Default { get; } = new SaveStore(Path.Combine(Application.persistentDataPath, "Saves"));
        public string SavePath => Path.Combine(directory, "slot-1.json");
        public string BackupPath => SavePath + ".bak";
        public bool HasFiles => File.Exists(SavePath) || File.Exists(BackupPath);

        public SaveStore(string directory) { this.directory = directory; }

        public bool TrySave(GameState state, out string error)
        {
            var temporary = SavePath + ".tmp";
            try
            {
                Validate(state);
                var context = new SerializationContext();
                context.Config.SerializationPolicy = SerializationPolicies.Everything;
                context.Config.DebugContext.ErrorHandlingPolicy = ErrorHandlingPolicy.ThrowOnErrors;
                var payload = SerializationUtility.SerializeValue(state, DataFormat.Binary, context);
                var json = new JObject
                {
                    ["formatVersion"] = FormatVersion,
                    ["stateVersion"] = GameState.STATE_VERSION,
                    ["savedUtc"] = DateTime.UtcNow.ToString("O"),
                    ["checksum"] = Hash(payload),
                    ["payload"] = Convert.ToBase64String(payload)
                }.ToString(Formatting.None);
                Directory.CreateDirectory(directory);
                using (var stream = new FileStream(temporary, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    var bytes = System.Text.Encoding.UTF8.GetBytes(json);
                    if (bytes.Length > MaxFileBytes) throw new InvalidDataException("저장 데이터가 너무 큽니다.");
                    stream.Write(bytes, 0, bytes.Length);
                    stream.Flush(true);
                }
                if (File.Exists(SavePath))
                {
                    // 손상된 본문으로 정상 백업을 덮어쓰지 않는다.
                    bool validPrevious = TryRead(SavePath, out _, out _);
                    File.Replace(temporary, SavePath, validPrevious ? BackupPath : null);
                }
                else File.Move(temporary, SavePath);
                error = null;
                return true;
            }
            catch (Exception e)
            {
                error = "저장하지 못했습니다: " + e.Message;
                return false;
            }
            finally
            {
                try { if (File.Exists(temporary)) File.Delete(temporary); }
                catch (IOException) { }
                catch (UnauthorizedAccessException) { }
            }
        }

        public bool TryLoad(out SaveRecord record, out string error)
        {
            if (TryRead(SavePath, out record, out error)) return true;
            var primaryError = error;
            if (TryRead(BackupPath, out record, out var backupError))
            {
                record.FromBackup = true;
                error = null;
                return true;
            }
            error = HasFiles ? "저장 데이터를 읽을 수 없습니다. " + (primaryError ?? backupError) : null;
            return false;
        }

        static bool TryRead(string path, out SaveRecord record, out string error)
        {
            record = null;
            error = null;
            if (!File.Exists(path)) return false;
            try
            {
                if (new FileInfo(path).Length > MaxFileBytes) throw new InvalidDataException("파일 크기가 너무 큽니다.");
                var json = JObject.Parse(File.ReadAllText(path));
                if ((int?)json["formatVersion"] != FormatVersion || (int?)json["stateVersion"] != GameState.STATE_VERSION)
                    throw new InvalidDataException("호환되지 않는 저장 버전입니다.");
                var saved = DateTime.Parse((string)json["savedUtc"], System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.RoundtripKind);
                var payload = Convert.FromBase64String((string)json["payload"]);
                if (Hash(payload) != (string)json["checksum"]) throw new InvalidDataException("파일 검증에 실패했습니다.");
                var context = new DeserializationContext();
                context.Config.SerializationPolicy = SerializationPolicies.Everything;
                context.Config.DebugContext.ErrorHandlingPolicy = ErrorHandlingPolicy.ThrowOnErrors;
                var state = SerializationUtility.DeserializeValue<GameState>(payload, DataFormat.Binary, context);
                Validate(state);
                record = new SaveRecord { State = state, SavedUtc = saved.ToUniversalTime() };
                return true;
            }
            catch (Exception e) { error = e.Message; return false; }
        }

        public static bool IsCompatible(GameState state, GameData data, out string error)
        {
            bool valid = state.day <= data.RULES.MONTH_DAYS && state.slot < data.RULES.SLOTS &&
                state.mk.tk.All(kv => kv.Value?.hist != null) && state.mk.tk.Keys.All(k => data.TK.ContainsKey(k)) &&
                state.hold.All(h => data.TK.ContainsKey(h.Key)) &&
                state.cps.All(p => data.TK.ContainsKey(p.tk)) &&
                state.augs.All(id => data.AUGS.Any(a => a.id == id)) &&
                new[] { "m", "kim", "hy" }.All(room => state.kk.ContainsKey(room) && state.kun.ContainsKey(room));
            error = valid ? null : "현재 게임 데이터와 호환되지 않는 저장입니다.";
            return valid;
        }

        static string Hash(byte[] bytes)
        {
            using (var sha = SHA256.Create()) return Convert.ToBase64String(sha.ComputeHash(bytes));
        }

        static void Validate(GameState s)
        {
            if (s == null || s.version != GameState.STATE_VERSION || s.rngv != 2)
                throw new InvalidDataException("호환되지 않는 게임 상태입니다.");
            if (s.month < 1 || s.day < 1 || s.slot < 0 || s.pending == null || string.IsNullOrEmpty(s.pending.t) || s.pending.t == "start")
                throw new InvalidDataException("게임 시작 이후의 선택 대기 상태만 저장할 수 있습니다.");
            if (s.mk?.tk == null || s.mk.tk.Count == 0 || s.hold == null || s.owned == null || s.props == null ||
                s.st == null || s.augs == null || s.flow == null || s.cps == null || s.kk == null || s.kun == null ||
                s.posts == null || s.tips == null || s.today == null || s.yday == null)
                throw new InvalidDataException("필수 게임 데이터가 없습니다.");
            foreach (double value in new[] { s.cash, s.debt, s.hp, s.stress, s.addict })
                if (double.IsNaN(value) || double.IsInfinity(value)) throw new InvalidDataException("게임 수치가 유효하지 않습니다.");
        }
    }
}
