"""캐릭터·아이콘 배경 제거. 애니 전용 분할 모델 isnet-anime(rembg)로 알파를 만들고,
반투명 가장자리는 배경색(원본 테두리 중앙값)을 빼서 흰 테두리 없이 원래 색으로 되돌린다.
필요: pip install "rembg[cpu]" numpy pillow  (모델 176MB는 첫 실행 때 U2NET_HOME 아래로 자동 다운로드)"""
import sys, numpy as np
from PIL import Image
from rembg import remove, new_session

_session = None

def clean_cutout(src):
    global _session
    _session = _session or new_session("isnet-anime")
    rgb = Image.open(src).convert("RGB")
    a = np.array(remove(rgb, session=_session, only_mask=True)).astype(np.float32) / 255
    p = np.array(rgb).astype(np.float32)
    bg = np.median(np.concatenate([p[0], p[-1], p[:, 0], p[:, -1]]), axis=0)
    a = np.where(a < 0.05, 0, np.where(a > 0.95, 1, a))
    m = (a > 0) & (a < 1)
    out = p.copy()
    out[m] = np.clip((p[m] - (1 - a[m, None]) * bg) / a[m, None], 0, 255)
    return Image.fromarray(np.dstack([out, a * 255]).astype(np.uint8), "RGBA")

if __name__ == "__main__":
    clean_cutout(sys.argv[1]).save(sys.argv[2])
