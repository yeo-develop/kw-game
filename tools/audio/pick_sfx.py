# 후보 수치 비교: 길이 · 피크 · RMS · 어택(피크까지 시간) · 스펙트럼 중심(밝기) · 무음 비율
import sys, glob, json
import numpy as np, soundfile as sf
from pathlib import Path
d = Path(sys.argv[1]); out = {}
for f in sorted(d.glob("SFX_*_v*.ogg")):
    a, sr = sf.read(f, always_2d=True); x = a.mean(1)
    if len(x) == 0: continue
    env = np.abs(x); pk = env.max()
    rms = float(np.sqrt((x**2).mean()))
    attack = float(np.argmax(env) / sr)
    spec = np.abs(np.fft.rfft(x)); fr = np.fft.rfftfreq(len(x), 1/sr)
    cent = float((spec*fr).sum()/max(spec.sum(),1e-9))
    win = int(sr*0.02); fr_rms = np.array([np.sqrt((x[i:i+win]**2).mean()) for i in range(0, len(x)-win, win)]) if len(x) > win else np.array([rms])
    silent = float((fr_rms < pk*0.03).mean())
    out[f.name] = dict(sec=round(len(x)/sr,2), peak=round(float(pk),2), rms=round(rms,3), attack=round(attack,2), centroid=int(cent), silent=round(silent,2))
for k,v in out.items(): print(k, v)
