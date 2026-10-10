#!/usr/bin/env node
/* web/tools/sim-cli.mjs — 브라우저 없이 봇으로 수백 판 돌려 결과 표를 찍는다 (밸런스 리포트).
   사용: node web/tools/sim-cli.mjs [--n 200] [--strat work,invest,gamble,random] [--seed0 1] [--rngv 1|2] [--json]
   미니게임 점수는 0.6~0.8 균등 (평균 사람 가정). */
import { loadData } from "./load-data.mjs";
import * as SIM from "../src/sim/index.js";
import { runGame } from "./bots.mjs";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const RNGV = +arg("rngv", 2), N = +arg("n", 200), SEED0 = +arg("seed0", 1), STRATS = arg("strat", "steady,work,invest,gamble,random").split(","), MAXM = +arg("maxMonth", 12), JSONOUT = process.argv.includes("--json");
const DATA = loadData();
/* --rules '{"KEY":값,...}' : 밸런스 실험용 RULES 덮어쓰기 (파일은 안 바꿈) */
if (arg("rules")) Object.assign(DATA.RULES, JSON.parse(arg("rules")));
SIM.setData(DATA);

const ENDS = ["clear", "bad1", "bad2"];
const rows = [];
const t0 = Date.now();
for (const strat of STRATS) {
  const t1 = Date.now(), res = [];
  for (let i = 0; i < N; i++) res.push(runGame(SEED0 + i, strat, { rngv: RNGV, maxMonth: MAXM }));
  const ms = Date.now() - t1;
  const cnt = Object.fromEntries(ENDS.map(e => [e, res.filter(r => r.end === e).length]));
  const avg = f => res.reduce((a, r) => a + f(r), 0) / res.length;
  const cl = res.filter(r => r.end === "clear"), med = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
  const by = m => res.filter(r => r.end === "clear" && r.month <= m).length / N;
  rows.push({ strat, n: N, ...cnt, clearM: cl.length ? cl.reduce((a, r) => a + r.month, 0) / cl.length : 0, clearMed: med(cl.map(r => r.month)), by3: by(3), by5: by(5), by8: by(8), addict: avg(r => r.addict), faint: avg(r => r.faint), impulse: avg(r => r.impulse), secret: avg(r => r.secret), earned: avg(r => r.earned), gnet: avg(r => r.gnet), profit: avg(r => r.profit), gclear: cl.filter(r => r.variant === "gamble").length, other: N - ENDS.reduce((a, e) => a + cnt[e], 0), days: avg(r => r.days), debt: avg(r => r.debt), cash: avg(r => r.cash), liq: avg(r => r.liq), errs: res.reduce((a, r) => a + r.errs, 0), cmds: avg(r => r.steps), msPerGame: ms / N });
}
if (JSONOUT) { console.log(JSON.stringify(rows, null, 1)); process.exit(0); }
const pc = (k, r) => (r[k] / r.n * 100).toFixed(1) + "%";
const man = x => (x / 1e4).toFixed(0) + "만";
console.log(`sim-cli · 난수 v${RNGV} · ${N}판 × ${STRATS.length}전략 · seed ${SEED0}~${SEED0 + N - 1} · 최대 ${MAXM}개월 · 총 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log("| 전략 | 판 | clear | ≤3개월 | ≤5개월 | ≤8개월 | 클리어 평균/중앙 개월 | bad1 | bad2 | 미결(none) | 평균 버틴 날 | 평균 최종 빚 | 알바 수입 | 도박 순손익 | 투자 실현 | 중독도 | 기절 | 돌발매수 | 몰래카지노 | 청산 | ms/판 | sim 오류 |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
const p1 = x => (x * 100).toFixed(1) + "%";
for (const r of rows) console.log(`| ${r.strat} | ${r.n} | ${pc("clear", r)} | ${p1(r.by3)} | ${p1(r.by5)} | ${p1(r.by8)} | ${r.clearM.toFixed(1)} / ${r.clearMed} | ${pc("bad1", r)} | ${pc("bad2", r)} | ${pc("other", r)} | ${r.days.toFixed(1)} | ${man(r.debt)} | ${man(r.earned)} | ${man(r.gnet)} | ${man(r.profit)} | ${r.addict.toFixed(0)} | ${r.faint.toFixed(2)} | ${r.impulse.toFixed(2)} | ${r.secret.toFixed(2)} | ${r.liq.toFixed(2)} | ${r.msPerGame.toFixed(1)} | ${r.errs} |`);
