# 글꼴

`DungGeunMo.subset.woff` — 둥근모꼴(DungGeunMo). 글꼴 파일의 저작권 칸에 "Public Domain" 이라고 적혀 있다.

원본 TTF(7.3MB, 글리프 17,651개)에서 게임에 쓰는 글자만 남긴 것이다(280KB):
이 폴더 위의 `*.js` · `index.html` 에 나오는 모든 글자 + KS X 1001 한글 2,350자 + ASCII + 한글 낱자 + 자주 쓰는 기호.
같은 화면을 원본과 줄인 것으로 찍어 점 단위로 같음을 확인했다(2026-11-16).

게임 글에 새 글자(위 범위 밖의 한글 · 기호)를 쓰게 되면 다시 만든다:

```
python -m fontTools.subset DungGeunMo.ttf --text-file=chars.txt --output-file=DungGeunMo.subset.woff \
  --flavor=woff --name-IDs='*' --notdef-outline --layout-features='*'
```

글꼴에 없는 글자(예: ①②③)는 브라우저의 `monospace` 로 대신 나온다.
