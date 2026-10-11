import sys, subprocess, tempfile, numpy as np
from PIL import Image
from scipy import ndimage as nd
CUT = '/tmp/cutout'

def clean_cutout(src, tol=6, min_area=120, halo_tol=60, halo_px=3):
    """Vision 마스크 + 원본 흰 배경 제거 보정: 배경색과 같은 큰 영역(팔·몸 사이 빈틈 포함) 투명,
    가장자리 배경색 띠 제거, 반투명 픽셀은 배경색을 빼서 색 복원."""
    tmp = tempfile.mktemp(suffix='.png'); subprocess.run([CUT, src, tmp], check=True, capture_output=True)
    a = np.array(Image.open(tmp).convert('RGBA'))[..., 3].astype(np.float32) / 255
    p = np.array(Image.open(src).convert('RGB')).astype(np.float32)
    border = np.concatenate([p[0], p[-1], p[:, 0], p[:, -1]])
    bg = np.median(border, axis=0)
    d = np.abs(p - bg).max(-1)
    near = d <= tol
    lab, n = nd.label(near)
    sizes = nd.sum(near, lab, range(1, n + 1))
    # 바깥(Vision이 투명으로 본 영역)에 닿은 배경색 덩어리만 지운다 — 흰 옷·베개 내부는 보존
    touch = np.unique(lab[nd.binary_dilation(a < 0.5, iterations=2) & near])
    touch = touch[touch > 0]
    big = np.isin(lab, touch[sizes[touch - 1] >= min_area])
    # 머리카락·팔 사이에 갇힌 배경 빈틈: 테두리가 어두운(선·머리·옷) 배경색 덩어리는 지운다.
    # 흰 옷·베개 안의 밝은 면은 테두리가 연회색이라 남는다.
    objs = nd.find_objects(lab)
    for k, sl in enumerate(objs, 1):
        if sizes[k - 1] < 30 or k in touch: continue
        sub = lab[sl] == k
        ring = nd.binary_dilation(sub, iterations=2) & ~sub
        if ring.any() and d[sl][ring].mean() > 70:
            big[sl] |= sub
    a[big] = 0
    for _ in range(halo_px):  # 투명 영역에 붙은 배경색 비슷한 테두리 픽셀 제거
        edge = (a > 0) & nd.binary_dilation(a == 0) & (d <= halo_tol)
        a[edge] = 0
    # 가장자리 1px 초크: 바깥 경계 픽셀을 반투명으로 → 아래 언믹스로 흰 테두리 대신 원래 색
    a = np.minimum(a, (a + nd.grey_erosion(a, size=3)) / 2)
    a = np.where(a < 0.04, 0, a)
    m = (a > 0) & (a < 1)
    out = p.copy()
    out[m] = np.clip((p[m] - (1 - a[m, None]) * bg) / a[m, None], 0, 255)
    rgba = np.dstack([out, a * 255]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')

if __name__ == '__main__':
    clean_cutout(sys.argv[1]).save(sys.argv[2])
