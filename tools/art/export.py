"""art/ 원본(webp) → Assets/Art 게임용 파일. 사용법: swiftc -O tools/art/cutout.swift -o /tmp/cutout && python3 tools/art/export.py
캐릭터·아이콘은 macOS Vision으로 배경 제거(투명 PNG), 배경·CG는 JPG(q90)."""
import glob, os, subprocess, tempfile
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
A, U, CUT = f"{ROOT}/art", f"{ROOT}/Assets/Art", "/tmp/cutout"

def cutout(src):
    out = tempfile.mktemp(suffix=".png")
    subprocess.run([CUT, src, out], check=True, capture_output=True)
    return Image.open(out).convert("RGBA")

def save_char(src, dst):  # 높이 1080, 원본 캔버스 유지(표정 바꿔도 위치 고정)
    im = cutout(src)
    im.resize((round(im.width * 1080 / im.height), 1080), Image.LANCZOS).save(dst, optimize=True)

def save_icon(src, dst):  # 내용만 잘라 정사각 256
    im = cutout(src); im = im.crop(im.getbbox()); s = max(im.size)
    c = Image.new("RGBA", (s, s)); c.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
    c.resize((256, 256), Image.LANCZOS).save(dst, optimize=True)

jobs = [("mirai/set_v1/mirai_*.webp", "Characters/Mirai", save_char), ("npc/*.webp", "Characters/NPC", save_char),
        ("relic/*.webp", "Icons/Relics", save_icon), ("relic/junk/*.webp", "Icons/Junk", save_icon)]
for pat, sub, fn in jobs:
    os.makedirs(f"{U}/{sub}", exist_ok=True)
    for p in glob.glob(f"{A}/{pat}"):
        fn(p, f"{U}/{sub}/{os.path.basename(p)[:-5]}.png")
for sub, out in [("bg", "Backgrounds"), ("cg", "CG")]:
    os.makedirs(f"{U}/{out}", exist_ok=True)
    for p in glob.glob(f"{A}/{sub}/*.webp"):
        Image.open(p).convert("RGB").save(f"{U}/{out}/{os.path.basename(p)[:-5]}.jpg", quality=90)
print("done")
