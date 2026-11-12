// PROTOTYPE - NOT FOR PRODUCTION
// 게임이 불러오지 않는 개발용 도구. 화면 없는 브라우저(Playwright)는 KW_PLAYWRIGHT 환경 변수로 위치를 줄 수 있다.
// 규칙만으로 한 판을 끝까지 굴려 보는 간단한 봇 (균형 감 잡기용 · 게임 폴더 밖)
const path = require('path');
const dir = require('path').resolve(process.argv[2] || require('path').join(__dirname, '..'));
global.window = {};
require(path.join(dir, 'config.js'));
const R = require(path.join(dir, 'rules.js'));
const C = window.CONFIG;
const over = {};
for (const a of process.argv.slice(4)) { const [k, v] = a.split('='); over[k] = Number(v); }
const T = new Proxy({}, { get: (_, k) => (k in over ? over[k] : (C[k] && typeof C[k] === 'object' ? C[k].value : C[k])) });
R.setTune(T);
const N = Number(process.argv[3] || 300);
const M = 10000;

// 봇 공통: 주거는 돈이 되면 바로 올림(upTo 까지), 칸마다 pickAct, 칸 사이에 trade
function play(seed, bot) {
  const s = R.create(seed, 'bot');
  let guard = 0;
  while (!s.ended && guard++ < 2000) {
    if (s.phase === 'night') { R.nextDay(s); continue; }
    // 주거
    if (s.tier < bot.upTo) {
      const info = R.moveInfo(s, s.tier + 1);
      const reserve = s.tier + 1 === 3 ? 300 * M : s.tier + 1 === 2 ? 5 * M : 0;
      if (!info.ok && s.tier + 1 === 3 && bot.sellToMove && R.worth(s) >= T.oneroom_deposit + reserve) { for (const a of R.ASSETS) if (s.hold[a.id].units > 0) R.sell(s, a.id, 1); }
      const i2 = R.moveInfo(s, s.tier + 1);
      if (i2.ok && s.cash >= i2.need + reserve) R.move(s, s.tier + 1);
    }
    if (R.worth(s) >= R.housePrice(s)) { R.buyHouse(s); break; }
    if (s.slot >= 3) {
      const b = R.bill(s);
      if (b && b.inDays === 0 && s.cash < b.amt + 3 * M && bot.trade) { // 고정비 현금 마련
        for (const a of R.ASSETS) if (s.cash < b.amt + 3 * M && s.hold[a.id].units > 0) R.sell(s, a.id, 1);
        if (s.cash < b.amt + 3 * M && s.lev) R.levClose(s);
      }
      R.endDay(s); continue;
    }
    if (bot.trade) bot.trade(s);
    const acts = R.acts(s);
    const act = bot.pick(s, acts);
    if (act.kind === 'job') R.doJob(s, act.id, bot.score(s)); else if (act.kind === 'study') R.doStudy(s); else R.doRest(s);
    s.ev.length = 0;
  }
  return s;
}
const bestJob = (s, acts) => { const j = acts.filter(a => a.kind === 'job' && a.ok).sort((a, b) => b.pay - a.pay)[0]; return j || acts.find(a => a.kind === 'rest'); };
// 체력을 봐 가며: 가장 돈 되는 알바, 안 되면 다음 것, 다 안 되면 쉬기
const bots = {
  // 알바만 (미니게임 "잘함" 수준), 고시원까지만
  alba: { upTo: 2, score: () => 0.75, pick: bestJob },
  albaPerfect: { upTo: 2, score: () => 0.95, pick: bestJob },
  // 알바 + 남는 돈은 전부 대장전자에 묻어 둠
  hold: { upTo: 2, score: () => 0.75, pick: bestJob, trade: s => { if (s.tier >= 2 && s.cash > 60 * M) R.buy(s, 'daejang', s.cash - 55 * M); } },
  // 뉴스를 믿을 만한 것만 따라가는 사람: 공시 · 기사 호재면 화끈식품, 원룸 뒤엔 코인 3배 (공부는 안 함)
  news: { upTo: 3, sellToMove: true, score: () => 0.75, pick: bestJob, trade: s => newsTrade(s, false) },
  // 공부까지 하는 사람: 자산이 500만을 넘으면 오전 칸을 공부에 씀
  study: { upTo: 3, sellToMove: true, score: () => 0.75, pick: (s, acts) => (s.slot === 2 && R.worth(s) > 500 * M && acts.find(a => a.kind === 'study')) || bestJob(s, acts), trade: s => newsTrade(s, true) },
  // 공부 + 과감: 5배, 남는 현금의 90%
  studyAggro: { upTo: 3, sellToMove: true, score: () => 0.75, pick: (s, acts) => (s.slot === 2 && R.worth(s) > 500 * M && acts.find(a => a.kind === 'study')) || bestJob(s, acts), trade: s => newsTrade(s, true, 5, 0.9) },
  // 주식만 (원룸에 안 감): 공부 + 화끈식품/대장전자
  stockOnly: { upTo: 2, score: () => 0.75, pick: (s, acts) => (s.slot === 2 && R.worth(s) > 300 * M && acts.find(a => a.kind === 'study')) || bestJob(s, acts), trade: s => newsTrade(s, true) },
  // 처음 해 보는 조심스러운 사람: 미니게임은 보통, 공부 안 함, 믿을 만한 소식에만 2배로 현금의 25%
  firstTimer: { upTo: 3, sellToMove: true, score: () => 0.6, pick: bestJob, trade: s => newsTrade(s, false, 2, 0.25) },
  // 두 번째 판쯤: 미니게임 잘함, 저녁에 공부, 3배로 현금의 절반
  second: { upTo: 3, sellToMove: true, score: () => 0.8, pick: (s, acts) => (s.slot === 2 && R.worth(s) > 500 * M && acts.find(a => a.kind === 'study')) || bestJob(s, acts), trade: s => newsTrade(s, true, 3, 0.5) },
  // 무지성: 원룸까지는 알바, 그 뒤 전 재산 5배 롱/숏 아무거나
  gamble: { upTo: 3, sellToMove: true, score: () => 0.75, pick: bestJob, trade: s => { if (s.tier >= 3 && !s.lev && s.cash > 50 * M) R.levOpen(s, R.rnd2(s) < 0.5 ? 1 : -1, s.cash - 20 * M, 5); } },
};
function newsTrade(s, useReport, lev = 3, share = 0) {
  if (s.tier < 2) return;
  const keep = (R.bill(s) ? R.bill(s).amt : 0) + 10 * M;
  if (s.slot === 0) { // 아침: 어제 들고 온 것 정리 후 오늘 소식에 맞춰 다시 잡음
    const news = R.todayNews(s);
    const sig = n => (useReport && n.report ? n.report * 2 : n.src === 'official' ? n.dir * 1.5 : n.src === 'article' ? n.dir : 0);
    const b = news.find(n => n.asset === 'buldak'), c = news.find(n => n.asset === 'coin');
    const bs = b ? sig(b) : 0, cs = c ? sig(c) : 0;
    if (s.hold.buldak.units > 0 && bs <= 0) R.sell(s, 'buldak', 1);
    if (s.lev) R.levClose(s);
    const d = news.find(n => n.asset === 'daejang'), ds = d ? sig(d) : 0;
    if (s.hold.daejang.units > 0 && (ds < 0 || bs > 0 || (s.tier >= 3 && cs !== 0))) R.sell(s, 'daejang', 1);
    if (s.tier >= 3 && cs !== 0 && s.cash > keep + 30 * M) { R.levOpen(s, cs > 0 ? 1 : -1, (s.cash - keep) * (share || (Math.abs(cs) >= 1.5 ? 0.6 : 0.4)), lev); }
    if (bs > 0 && s.cash > keep + 10 * M) R.buy(s, 'buldak', s.cash - keep);
    else if (ds >= 0 && s.cash > keep + 30 * M && s.hold.buldak.units === 0) R.buy(s, 'daejang', (s.cash - keep) * 0.8);
  }
}
const names = (process.env.BOTS || Object.keys(bots).join(',')).split(',');
for (const name of names) {
  let win = 0, sumPct = 0, days = 0, liq = 0, minPct = 9, maxPct = 0; const pcts = [];
  for (let i = 1; i <= N; i++) {
    const s = play(i * 7 + 1, bots[name]);
    const e = s.ended || { kind: 'stuck', worth: R.worth(s), price: R.housePrice(s) };
    const pct = e.worth / e.price; pcts.push(pct);
    if (e.kind === 'home') { win++; days += e.day; }
    sumPct += pct; liq += s.stats.liq;
  }
  pcts.sort((a, b) => a - b);
  console.log(name.padEnd(12), 'win', (100 * win / N).toFixed(0).padStart(3) + '%', ' avgDay', win ? (days / win).toFixed(1) : '-', ' 순자산/집값 p10', pcts[Math.floor(N * .1)].toFixed(2), 'p50', pcts[Math.floor(N * .5)].toFixed(2), 'p90', pcts[Math.floor(N * .9)].toFixed(2), ' 청산/판', (liq / N).toFixed(2));
}
