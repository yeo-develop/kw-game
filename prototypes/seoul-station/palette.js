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
