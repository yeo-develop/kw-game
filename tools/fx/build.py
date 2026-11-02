#!/usr/bin/env python3
"""pixelfx(MIT, github.com/patch-gg/pixelfx) 이펙트 → Assets/Resources/Fx/<키>.png + index.json
사용: python3 tools/fx/build.py [pixelfx 작업본 경로, 기본 ~/projects/pixelfx]"""
import json, os, shutil, subprocess, sys

PFX = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else "~/projects/pixelfx")
OUT = os.path.join(os.path.dirname(__file__), "../../Assets/Resources/Fx")
RED = ["#1a0508", "#4a0a12", "#8c1420", "#d42a2a", "#ff5a4a", "#ffa08a", "#ffffff"]
# 키: (pixelfx id, fps, 옵션)
FX = {
    "coin":      ("ui/coin-collect", 20, {}),
    "rekt":      ("explosions/cartoon-pow", 30, {"text": "REKT!", "palette": RED}),
    "heart":     ("ui/heart-lost", 30, {}),
    "confetti":  ("ui/confetti", 20, {}),
    "clear":     ("ui/achievement", 20, {"title": "DEBT FREE", "text": "KIM IS GONE!"}),
    "countdown": ("ui/countdown", 20, {}),
    "iris":      ("transitions/iris", 20, {}),
}
os.makedirs(OUT, exist_ok=True)
items = []
for key, (fid, fps, opts) in FX.items():
    cmd = ["node", "tools/render.mjs", fid, "--sheet", "--fps", str(fps)]
    if opts: cmd += ["--opts", json.dumps(opts)]
    subprocess.run(cmd, cwd=PFX, check=True, stdout=subprocess.DEVNULL)
    name = fid.split("/")[1]
    rec = os.path.join(PFX, "records", fid)
    shutil.copy(os.path.join(rec, name + ".png"), os.path.join(OUT, key + ".png"))
    m = json.load(open(os.path.join(rec, name + ".json")))["meta"]["pixelfx"]
    items.append({"key": key, "fps": m["fps"], "n": m["frames"], "w": m["frameSize"][0], "h": m["frameSize"][1],
                  "cols": m["columns"], "px": m["pivot"][0], "py": m["pivot"][1]})
    print(key, fid, m["frames"], "frames", m["fps"], "fps")
json.dump({"items": items}, open(os.path.join(OUT, "index.json"), "w"), indent=1)   # JsonUtility 용 감싸기
