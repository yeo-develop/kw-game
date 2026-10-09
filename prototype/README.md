# 롱잡고알바감 · 웹 컨셉 프로토타입

`index.html` 한 파일로 돈다. 로컬에서는 `python3 -m http.server`로 띄운 뒤 `http://localhost:8000/` 접속(파일을 바로 열어도 동작). `?fast=1`을 붙이면 연출 없이 빠르게 진행되고, 게임 중 `D` 키로 수치 디버그를 켠다.

## 실제 QQQ CSV로 바꾸기
1. `index.html`에서 `const SAMPLE_CSV = \`` 부터 닫는 `` ` `` 까지를 실제 QQQ 1분봉 CSV 내용으로 통째로 바꾼다. 헤더는 `datetime,open,high,low,close,volume`, `datetime`은 미국 동부시간 `YYYY-MM-DD HH:MM`이다(정규장 09:30~15:59만 쓰고 나머지는 버림).
2. 날짜순 앞의 **거래일 2일**이 D+1(목)·D+2(금) 밤이 되고, `parseCsv` → `buildSessions`가 QQQ×41.2로 합성 MNQ를 만든다. 개입 창은 데이터를 보고 열린다(진입가 −29pt = 물타기 직전, 손절선 +10pt = 손절선 근처).
3. D+3(토) 밤은 `SAMPLE_BTC_CSV`(같은 형식, 시각은 KST, 앞 390개 사용)를 쓴다. BTC도 같은 방법으로 바꾸면 된다. 행이 240개보다 적은 날은 무시하고, 데이터가 모자라면 평평한 차트로 대체한다.
