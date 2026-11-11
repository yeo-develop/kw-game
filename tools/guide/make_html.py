# -*- coding: utf-8 -*-
# docs/PLAY_GUIDE.md → 인쇄용 HTML (그다음 tools/guide/pdf.js 가 PDF 로). 바깥 라이브러리 없이 이 문서가 쓰는 Markdown 만 다룬다:
# 제목(# ## ###) · 문단 · 인용(>) · 목록(- / 1. , 2칸 들여쓰기 중첩) · 표 · 그림 + 바로 아래 *설명* · **굵게** · *기울임* · `코드` · Q/A 문단
# 사용: python3 tools/guide/make_html.py <out.html>
import re, sys, os, html

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'docs', 'PLAY_GUIDE.md')
FONT = os.path.join(ROOT, 'Assets', 'Resources', 'Fonts')

def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r'`([^`]+)`', r'<code>\1</code>', s)
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'(?<![\*\w])\*(?!\*)([^*]+?)\*(?![\*\w])', r'<em>\1</em>', s)
    return s

def table(rows):
    cells = [[c.strip() for c in r.strip().strip('|').split('|')] for r in rows]
    head, body = cells[0], [r for r in cells[2:]] if len(cells) > 1 and re.match(r'^[\s:\-|]+$', rows[1].strip()) else ([], cells)
    if not head: head, body = None, cells
    o = ['<table>']
    if head and any(head): o.append('<thead><tr>' + ''.join('<th>%s</th>' % inline(c) for c in head) + '</tr></thead>')
    o.append('<tbody>')
    for r in body: o.append('<tr>' + ''.join('<td>%s</td>' % inline(c) for c in r) + '</tr>')
    o.append('</tbody></table>')
    return ''.join(o)

def convert(md):
    L = md.split('\n'); out = []; i = 0; stack = []   # stack: (들여쓰기, 태그)
    is_li = lambda s: re.match(r'^(\s*)(- |\d+\. )(.*)$', s)
    is_tbl = lambda s: s.strip().startswith('|')
    def close(to=-1):
        while stack and stack[-1][0] > to: out.append('</li></%s>' % stack.pop()[1])
    while i < len(L):
        s = L[i]
        if not s.strip():
            # 빈 줄: 다음 줄이 목록 항목이거나 들여 쓴 내용이면 목록을 이어 간다
            j = i + 1
            while j < len(L) and not L[j].strip(): j += 1
            if stack and not (j < len(L) and (is_li(L[j]) or L[j].startswith('  '))): close()
            i += 1; continue
        m = is_li(s)
        if m:
            ind = len(m.group(1)); tag = 'ul' if m.group(2) == '- ' else 'ol'
            if not stack or ind > stack[-1][0]: out.append('<%s>' % tag); stack.append((ind, tag)); out.append('<li>' + inline(m.group(3)))
            else:
                close(ind)
                if stack and stack[-1][0] == ind: out.append('</li><li>' + inline(m.group(3)))
                else: out.append('<%s>' % tag); stack.append((ind, tag)); out.append('<li>' + inline(m.group(3)))
            i += 1; continue
        if is_tbl(s):
            rows = []
            while i < len(L) and is_tbl(L[i]): rows.append(L[i]); i += 1
            if not (stack and s.startswith('  ')): close()
            out.append(table(rows)); continue
        if stack and s.startswith('  '): out.append(' ' + inline(s.strip())); i += 1; continue   # 목록 항목의 이어지는 줄
        close()
        t = s.strip()
        if t == '---': i += 1; continue
        h = re.match(r'^(#{1,3}) (.*)$', t)
        if h: n = len(h.group(1)); out.append('<h%d>%s</h%d>' % (n, inline(h.group(2)), n)); i += 1; continue
        if t.startswith('>'):
            q = []
            while i < len(L) and L[i].strip().startswith('>'): q.append(inline(L[i].strip()[1:].strip())); i += 1
            out.append('<blockquote>' + '<br>'.join(q) + '</blockquote>'); continue
        im = re.match(r'^!\[([^\]]*)\]\(([^)]+)\)$', t)
        if im:
            j = i + 1
            while j < len(L) and not L[j].strip(): j += 1
            cap = ''
            if j < len(L) and re.match(r'^\*[^*].*\*$', L[j].strip()): cap = L[j].strip()[1:-1]; i = j
            out.append('<figure><img alt="%s" src="%s">%s</figure>' % (html.escape(im.group(1)), im.group(2), '<figcaption>%s</figcaption>' % inline(cap) if cap else ''))
            i += 1; continue
        if t.startswith('**Q.'):
            out.append('<p class="q">%s</p>' % inline(t)); i += 1
            a = []
            while i < len(L) and L[i].strip() and not L[i].strip().startswith('**Q.'): a.append(inline(L[i].strip())); i += 1
            if a: out.append('<p class="a">%s</p>' % ' '.join(a))
            continue
        p = []
        while i < len(L) and L[i].strip() and not is_li(L[i]) and not is_tbl(L[i]) and not re.match(r'^(#{1,3} |>|!\[|---$)', L[i].strip()): p.append(inline(L[i].strip())); i += 1
        out.append('<p>%s</p>' % ' '.join(p))
    close()
    return '\n'.join(out)

CSS = '''
@font-face { font-family: "Pretendard"; font-weight: 400; src: url("file://%(font)s/Pretendard-Regular.ttf"); }
@font-face { font-family: "Pretendard"; font-weight: 700; src: url("file://%(font)s/Pretendard-Bold.ttf"); }
@page { size: A4; margin: 16mm 15mm 18mm 15mm; }
* { box-sizing: border-box; }
html { font-family: "Pretendard", "Apple SD Gothic Neo", sans-serif; font-size: 10.4pt; line-height: 1.62; color: #1d1f24; word-break: keep-all; }
body { margin: 0; }
h1 { font-size: 27pt; margin: 26mm 0 5mm; letter-spacing: -0.5px; line-height: 1.2; }
h1 + blockquote { border: 0; padding: 0; margin: 0 0 12mm; color: #5a606b; font-size: 10.4pt; background: none; }
h2 { font-size: 16.5pt; margin: 11mm 0 4mm; padding: 0 0 2.2mm; border-bottom: 2px solid #e8457f; letter-spacing: -0.3px; break-after: avoid; }
h1 + blockquote + h2 { margin-top: 4mm; }
h3 { font-size: 12.3pt; margin: 6.5mm 0 2mm; break-after: avoid; }
p { margin: 0 0 2.6mm; }
ul, ol { margin: 0 0 2.8mm; padding-left: 5.2mm; }
li { margin: 0 0 1.1mm; }
li > ul, li > ol { margin: 1mm 0 0.6mm; }
strong { font-weight: 700; }
em { font-style: normal; color: #5a606b; }
code { font-family: inherit; background: #f1f2f5; border-radius: 3px; padding: 0 3px; }
blockquote { margin: 0 0 3mm; padding: 2.2mm 3.5mm; border-left: 3px solid #e8457f; background: #fbf3f6; color: #3b3f47; }
table { border-collapse: collapse; width: calc(100%% - 1px); margin: 1mm 0 3.6mm; font-size: 9.5pt; line-height: 1.5; break-inside: avoid; }
th, td { border: 1px solid #d5d8de; padding: 1.5mm 2.3mm; text-align: left; vertical-align: top; }
th { background: #f3f4f7; font-weight: 700; }
li table { margin-top: 1.6mm; }
figure { margin: 2.6mm 0 4mm; break-inside: avoid; }
figure img { display: block; width: 100%%; border: 1px solid #c9ccd3; border-radius: 4px; }
figcaption { margin-top: 1.5mm; font-size: 9pt; color: #5a606b; line-height: 1.5; }
p.q { margin: 4mm 0 1mm; break-after: avoid; }
p.a { margin: 0 0 2mm; padding-left: 3.6mm; border-left: 2px solid #d5d8de; }
''' % {'font': FONT}

def main():
    out = sys.argv[1]
    md = open(SRC, encoding='utf-8').read()
    body = convert(md)
    base = 'file://' + os.path.join(ROOT, 'docs') + '/'
    doc = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><base href="%s"><title>롱잡고알바감 플레이 가이드</title><style>%s</style></head><body>%s</body></html>' % (base, CSS, body)
    open(out, 'w', encoding='utf-8').write(doc)
    miss = [m for m in re.findall(r'<img alt="[^"]*" src="([^"]+)"', body) if not os.path.exists(os.path.join(ROOT, 'docs', m))]
    print('html', len(doc), '그림', len(re.findall(r'<img ', body)), '없는 그림', miss)

if __name__ == '__main__': main()
