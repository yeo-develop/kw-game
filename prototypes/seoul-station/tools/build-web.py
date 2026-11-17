# 서울역 상태창(픽셀 UI) → 웹 게시용 묶음.
#   pub/  게시할 것: seoul-station.html (틀 없는 본문, 글꼴은 data URI 로 넣음) + index.html 이 부르는 js 전부
#   sim/  게시 틀을 흉내 낸 것: index.html + 같은 js (창 없는 점검용)
#   one/  index.html 한 장에 글꼴 · js 를 다 넣은 것: 파일 하나만 올리는 곳(주소 하나 = 파일 하나인 저장소)에 그대로 올린다. 검색에 안 잡히게 noindex.
# python3 tools/build-web.py . <내보낼 폴더>
# 올리기 전 확인: node tools/tut.js <내보낼 폴더>/sim <찍을 폴더> · node tools/rt.js <내보낼 폴더>/sim  (one 도 같은 식으로: …/one)
import base64, re, shutil, sys
from pathlib import Path

src, out = Path(sys.argv[1]), Path(sys.argv[2])
html = (src / 'index.html').read_text(encoding='utf-8')

title = re.search(r'<title>.*?</title>', html, re.S).group(0)
style = re.search(r'<style>.*?</style>', html, re.S).group(0)
body = re.search(r'<body>(.*?)</body>', html, re.S).group(1).strip()
JS = re.findall(r'<script src="([\w.-]+\.js)"></script>', body)
assert JS and JS[0] == 'config.js' and JS[-1] == 'ui.js', JS
assert len(re.findall(r'<style>', html)) == 1 and len(re.findall(r'<script', html)) == len(JS), '따로 든 스크립트가 있음'
for name in JS:
    assert (src / name).is_file(), name

# 글꼴: 게시 틀에서는 같은 폴더의 글꼴 파일을 못 부를 수 있어 CSS 안에 넣는다
FONT = "url('fonts/DungGeunMo.subset.woff') format('woff')"
assert style.count(FONT) == 1, '글꼴 줄이 바뀜'
b64 = base64.b64encode((src / 'fonts' / 'DungGeunMo.subset.woff').read_bytes()).decode('ascii')
style = style.replace(FONT, "url('data:font/woff;base64,%s') format('woff')" % b64)
assert 'url(\'fonts/' not in style and 'url("fonts/' not in style and 'url(fonts/' not in style

# 게시 틀은 14px 글자 · 줄 높이 1.5 를 기본으로 깐다. 게임은 16px/20px · 밝은 한 가지 모습으로 짰다(게임의 <style> 이 뒤에 와서 덮지만 분명히 해 둔다).
page = '\n'.join([
    title,
    '<style>',
    '  :root { color-scheme: light; }',
    '</style>',
    style,
    "<script>document.documentElement.lang = 'ko';</script>",
    body,
    '',
])
for bad in ('<!doctype', '<html', '<head', '<body', '</body', '</html'):
    assert bad not in page.lower(), bad

pub, sim = out / 'pub', out / 'sim'
for d in (pub, sim):
    if d.exists():
        shutil.rmtree(d)
    d.mkdir(parents=True)
    for name in JS:
        shutil.copyfile(src / name, d / name)
(pub / 'seoul-station.html').write_text(page, encoding='utf-8')

SKELETON = ('<!doctype html><html><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
            '<style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}'
            'body{margin:0;font:14px/1.5 system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>'
            '</head><body>\n')
(sim / 'index.html').write_text(SKELETON + page + '</body></html>\n', encoding='utf-8')
# 한 장짜리: 원래 index.html 그대로에 글꼴 · js 만 안으로 넣는다(순서 · 내용은 같음)
VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1">'
assert html.count(FONT) == 1 and html.count(VIEWPORT) == 1
doc = html.replace(FONT, "url('data:font/woff;base64,%s') format('woff')" % b64)
doc = doc.replace(VIEWPORT, VIEWPORT + '\n<meta name="robots" content="noindex">')
for name in JS:
    tag, js = '<script src="%s"></script>' % name, (src / name).read_text(encoding='utf-8')
    assert doc.count(tag) == 1, name
    assert '</script' not in js.lower() and '<!--' not in js, name + ': 안에 넣으면 깨지는 글자가 있음'
    doc = doc.replace(tag, '<script>/* %s */\n%s\n</script>' % (name, js))
assert '<script src=' not in doc and "url('fonts/" not in doc
one = out / 'one'
if one.exists():
    shutil.rmtree(one)
one.mkdir(parents=True)
(one / 'index.html').write_text(doc, encoding='utf-8')
print('one', (one / 'index.html').stat().st_size, 'bytes')
# 도구(tools/*.js)는 게임 폴더의 것을 그대로 쓴다: node <게임 폴더>/tools/tut.js <sim 폴더> <내보낼 폴더>
print('js', JS)
print('page', len(page), 'bytes ·', 'total', sum(p.stat().st_size for p in pub.iterdir()), 'bytes')
