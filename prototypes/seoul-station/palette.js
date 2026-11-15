// PROTOTYPE - NOT FOR PRODUCTION
// Question: 상태창이 시키는 대로 알바 → 방 → 투자 → 집으로 올라가는 한 판이, 뭘 해야 할지 늘 분명하면서 20분 동안 재미있는가?
// Date: 2026-11-12
// 색과 글꼴 — 그림(art.js) · 미니게임(minigames.js) · 화면(ui.js)이 함께 쓴다. 역할로 이름 붙임.
window.PAL = {
  // 밤 배경: 어두운 좁은 범위 (그림자는 더 차갑게)
  night0: '#0b1022', night1: '#131b36', night2: '#1d2850', night3: '#2a3768',
  ground: '#1a2038', stone: '#39415f', stoneLit: '#4c5780',
  // 따뜻한 빛: 가로등 · 실내 (강조)
  warm: '#ffb454', warmDim: '#c9853a', lamp: '#ffe2b0',
  // 시스템(상태창): 화면에서 가장 밝다
  sys: '#53e0ff', sysDim: '#2a8fb0', sysDeep: '#0f3a52', sysGlow: 'rgba(83,224,255,0.28)',
  // 글자
  text: '#eaf2ff', dim: '#93a0c0', ink: '#0b1022',
  // 돈 · 상태
  up: '#ff5d6c', down: '#5b8cff', gold: '#ffd166', good: '#6fe3a1', bad: '#ff8a5c',
  // 인물 (플레이어: 후드티)
  skin: '#f2c9a5', skinShade: '#d9a985', hair: '#2a2433', hood: '#7483a6', hoodShade: '#55638a', pants: '#39415f', shoe: '#dfe5f5',
};
window.FONT = '"Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", system-ui, sans-serif';

// 픽셀 UI 의 색 (2026-11-15~) — 28색. 화면 CSS · 픽셀 그림(pxicons.js · pxart.js)이 이것만 쓴다.
// 위의 PAL(예전 밤 색)은 아직 벡터 그림(art.js)과 미니게임(minigames.js)이 쓴다.
window.PX = {
  k: '#2b1d2e',                                            // 외곽선 · 글자
  w: '#ffffff', c: '#fff4d6', C: '#f6e3b4', d: '#e3c58c',  // 흰색 · 크림 패널 · 그 그늘
  b: '#3b6fd8', B: '#23449a', l: '#6fa0f0',                // 파랑: 제목 띠
  s: '#8fd3ff', S: '#c4ecff', q: '#b0e0f8',                // 하늘
  o: '#f28a2e', O: '#c45a1a',                              // 주황: 주된 버튼
  y: '#ffd23f', Y: '#fff09a',                              // 노랑: 돈 · 강조
  g: '#5cc04a', G: '#2f8a3a', h: '#a6e36b',                // 초록: 쉬기 · 좋은 것
  r: '#e8505b', R: '#a8323f',                              // 빨강: 체력 · 위험
  e: '#9aa0b0', E: '#5c6274', L: '#d4d8e0',                // 회색: 잠긴 것
  n: '#8a5a3a', N: '#c08a5a', H: '#4a3328',                // 갈색: 나무 · 머리카락
  p: '#ffd0a8', P: '#e8a27c',                              // 살색
};
window.PXFONT = "'DungGeunMo', monospace";
