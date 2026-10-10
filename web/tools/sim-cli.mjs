#!/usr/bin/env node
/* web/tools/sim-cli.mjs — 브라우저 없이 봇으로 수백 판 돌려 결과 표를 찍는다 (밸런스 리포트).
   사용: node web/tools/sim-cli.mjs [--n 200] [--strat work,invest,gamble,random] [--seed0 1] [--rngv 1|2] [--json]
   미니게임 점수는 0.6~0.8 균등 (평균 사람 가정). */
import { loadData } from "./load-data.mjs";
import * as SIM from "../src/sim/index.js";
import { runGame } from "./bots.mjs";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const RNGV = +arg("rngv", 2), N = +arg("n", 200), SEED0 = +arg("seed0", 1), STRATS = arg("strat", "work,invest,gamble,random").split(","), JSONOUT = process.argv.includes("--json");
SIM.setData(loadData());

const ENDS = ["clear", "sea", "gall", "loop", "block"];
const rows = [];
const t0 = Date.now();
for (const strat of STRATS) {
  const t1 = Date.now(), res = [];
  for (let i = 0; i < N; i++) res.push(runGame(SEED0 + i, strat, { rngv: RNGV }));
  const ms = Date.now() - t1;
  const cnt = Object.fromEntries(ENDS.map(e => [e, res.filter(r => r.end === e).length]));
  const avg = f => res.reduce((a, r) => a + f(r), 0) / res.length;
  rows.push({ strat, n: N, ...cnt, other: N - ENDS.reduce((a, e) => a + cnt[e], 0), days: avg(r => r.days), debt: avg(r => r.debt), cash: avg(r => r.cash), liq: avg(r => r.liq), errs: res.reduce((a, r) => a + r.errs, 0), cmds: avg(r => r.steps), msPerGame: ms / N });
}
if (JSONOUT) { console.log(JSON.stringify(rows, null, 1)); process.exit(0); }
const pc = (k, r) => (r[k] / r.n * 100).toFixed(1) + "%";
const man = x => (x / 1e4).toFixed(0) + "만";
console.log(`sim-cli · 난수 v${RNGV} · ${N}판 × ${STRATS.length}전략 · seed ${SEED0}~${SEED0 + N - 1} · 총 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log("| 전략 | 판 | clear | sea | gall | loop | block | 평균 버틴 날 | 평균 최종 빚 | 평균 현금 | 평균 청산 | 명령/판 | ms/판 | sim 오류 |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const r of rows) console.log(`| ${r.strat} | ${r.n} | ${pc("clear", r)} | ${pc("sea", r)} | ${pc("gall", r)} | ${pc("loop", r)} | ${pc("block", r)} | ${r.days.toFixed(1)} | ${man(r.debt)} | ${man(r.cash)} | ${r.liq.toFixed(2)} | ${r.cmds.toFixed(0)} | ${r.msPerGame.toFixed(1)} | ${r.errs} |`);
