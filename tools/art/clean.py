import sys, subprocess, tempfile, numpy as np
from PIL import Image
from scipy import ndimage as nd
CUT = '/tmp/cutout'

def clean_cutout(src, tol=14, min_area=120, halo_tol=60, halo_px=3):
    """Vision 마스크 + 원본 흰 배경 제거 보정: 배경색과 같은 큰 영역(팔·몸 사이 빈틈 포함) 투명,
    가장자리 배경색 띠 제거, 반투명 픽셀은 배경색을 빼서 색 복원."""
    tmp = tempfile.mktemp(suffix='.png'); subprocess.run([CUT, src, tmp], check=True, capture_output=True)
    a = np.array(Image.open(tmp).convert('RGBA'))[..., 3].astype(np.float32) / 255
    p = np.array(Image.open(src).convert('RGB')).astype(np.float32)
    # 배경은 완전한 흰색이 아니라 은은한 그라데이션 → 확실한 배경(a==0)에서 주변 배경색을 번져서 추정
    sure = (a == 0).astype(np.float32)
    w = nd.gaussian_filter(sure, 25) + 1e-6
    bgf = np.dstack([nd.gaussian_filter(p[..., c] * sure, 25) / w for c in range(3)])
    glob_bg = np.median(p[a == 0], axis=0) if (a == 0).any() else np.array([240., 240., 240.])
    bgf = np.where((w < 1e-3)[..., None], glob_bg, bgf)
    bg = bgf
    d = np.abs(p - bg).max(-1)
    near = d <= tol
    lab, n = nd.label(near)
    sizes = nd.sum(near, lab, range(1, n + 1))
    # 배경색 덩어리 중, 둘레가 어두운 선(머리카락·외곽선)으로 둘러싸인 것은 통째로 지운다(머리카락 사이 빈틈).
    # 둘레가 밝은 것(흰 옷·베개 안쪽)은 바깥에 닿아 있어도 바깥 경계 4px만 지운다.
    outside = a < 0.5
    dist_out = nd.distance_transform_edt(~outside)
    big = np.zeros_like(near)
    for k, sl in enumerate(nd.find_objects(lab), 1):
        if sizes[k - 1] < 4: continue
        sub = lab[sl] == k
        ring = nd.binary_dilation(sub, iterations=2) & ~sub
        flat = p[sl][sub].std(0).max() < 3.5  # 배경 빈틈은 평평, 얼굴·장갑·옷은 음영이 있다
        if sizes[k - 1] <= 2500 and flat and ring.any() and d[sl][ring].mean() > 60:
            big[sl] |= sub
        else:
            big[sl] |= sub & (dist_out[sl] <= 4)
    a[big] = 0
    for _ in range(halo_px):  # 투명 영역에 붙은 배경색 비슷한 테두리 픽셀 제거
        edge = (a > 0) & nd.binary_dilation(a == 0) & (d <= halo_tol)
        a[edge] = 0
    # 가장자리 1px 초크: 바깥 경계 픽셀을 반투명으로 → 아래 언믹스로 흰 테두리 대신 원래 색
    a = np.minimum(a, (a + nd.grey_erosion(a, size=3)) / 2)
    a = np.where(a < 0.04, 0, a)
    m = (a > 0) & (a < 1)
    out = p.copy()
    out[m] = np.clip((p[m] - (1 - a[m, None]) * bg[m]) / a[m, None], 0, 255)
    rgba = np.dstack([out, a * 255]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')

if __name__ == '__main__':
    clean_cutout(sys.argv[1]).save(sys.argv[2])
