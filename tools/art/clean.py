"""캐릭터·아이콘 배경 제거. 애니 전용 분할 모델 isnet-anime(rembg)로 알파를 만들고,
반투명 가장자리는 배경색(원본 테두리 중앙값)을 빼서 흰 테두리 없이 원래 색으로 되돌린다.
필요: pip install "rembg[cpu]" numpy pillow  (모델 176MB는 첫 실행 때 U2NET_HOME 아래로 자동 다운로드)"""
import sys, numpy as np
from PIL import Image
from rembg import remove, new_session

_session = None

def clean_cutout(src, keep_fx=False):
    """keep_fx: 하트·오라 같은 효과 그림도 남김 — isnet 마스크에 '배경색과 충분히 다른 픽셀'을 더한다 (표정 연출이 효과에 달린 love·mental·yami용)"""
    global _session
    _session = _session or new_session("isnet-anime")
    rgb = Image.open(src).convert("RGB")
    a = np.array(remove(rgb, session=_session, only_mask=True)).astype(np.float32) / 255
    p = np.array(rgb).astype(np.float32)
    bg = np.median(np.concatenate([p[0], p[-1], p[:, 0], p[:, -1]]), axis=0)
    if keep_fx: a = np.maximum(a, np.clip((np.linalg.norm(p - bg, axis=2) - 22) / 40, 0, 1))
    a = np.where(a < 0.05, 0, np.where(a > 0.95, 1, a))
    m = (a > 0) & (a < 1)
    out = p.copy()
    out[m] = np.clip((p[m] - (1 - a[m, None]) * bg) / a[m, None], 0, 255)
    return Image.fromarray(np.dstack([out, a * 255]).astype(np.uint8), "RGBA")

def add_fx(char, src):
    """NovelAI Remove BG 결과(char)는 하트·오라 효과까지 지운다 → 원본(src)에서 배경색과 다른 픽셀을 캐릭터 뒤에 다시 깐다"""
    fx = clean_cutout(src, keep_fx=True).resize(char.size)
    fx.alpha_composite(char.convert("RGBA"))
    return fx

if __name__ == "__main__":
    clean_cutout(sys.argv[1]).save(sys.argv[2])
