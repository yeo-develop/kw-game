# 고른 후보를 Assets/Sound 로 복사 + .meta(고정 GUID) + SoundCatalog.asset 필드 추가
import sys, uuid, shutil, re, json
from pathlib import Path
SP = Path(sys.argv[1]); REPO = Path(sys.argv[2]); picks = json.loads(sys.argv[3])   # {field: "SFX_x_v1.ogg"}
META = """fileFormatVersion: 2
guid: {guid}
AudioImporter:
  externalObjects: {{}}
  serializedVersion: 8
  defaultSettings:
    serializedVersion: 2
    loadType: 0
    sampleRateSetting: 0
    sampleRateOverride: 44100
    compressionFormat: 1
    quality: 1
    conversionMode: 0
    preloadAudioData: 1
  platformSettingOverrides: {{}}
  forceToMono: 0
  normalize: 1
  loadInBackground: 0
  ambisonic: 0
  3D: 1
  userData:
  assetBundleName:
  assetBundleVariant:
"""
VOL = {"liquidation":0.9,"kakao":0.6,"kim":0.75,"affUp":0.6,"affDown":0.7,"unlock":0.85,"news":0.55,"repaid":0.85,"clear":0.9,"badEnding":0.9,"faint":0.8,"workPay":0.8,"minigameStart":0.7,"morning":0.5,"menhera":0.7}
cat = REPO/"Assets/Resources/Audio/SoundCatalog.asset"; s = cat.read_text()
block = ""
for field, src in picks.items():
    name = "SFX_" + field[0].upper() + field[1:] + ".ogg"
    dst = REPO/"Assets/Sound"/name; shutil.copy(SP/"sfx"/src, dst)
    meta = Path(str(dst)+".meta")
    guid = re.search(r"guid: (\w+)", meta.read_text()).group(1) if meta.exists() else uuid.uuid4().hex
    meta.write_text(META.format(guid=guid))
    s = re.sub(rf"  {field}:\n    clip: .*\n    volume: .*\n", "", s)
    block += f"  {field}:\n    clip: {{fileID: 8300000, guid: {guid}, type: 3}}\n    volume: {VOL[field]}\n"
s = s.replace("  backgroundMusic:\n", block + "  backgroundMusic:\n")
cat.write_text(s); print(s)
