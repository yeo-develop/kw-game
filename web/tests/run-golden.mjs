#!/usr/bin/env node
/* tests/run-golden.mjs — 골든 벡터 검증: 명령열을 재생해 상태 해시·주요 수치가 기대값과 같은지. 실패하면 exit 1. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadData } from "../tools/load-data.mjs";
import * as SIM from "../src/sim/index.js";
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "golden/vectors");
SIM.setData(loadData());
let pass = 0, fail = 0;
const t0 = Date.now();
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith(".json")).sort()) {
  const v = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
  let S = SIM.createGame(v.seed, v.opts || {}), nev = 0;
  for (const c of v.commands) { const r = SIM.apply(S, c); S = r.state; nev += r.events.length; }
  const got = { hash: SIM.stateHash(S), events: nev, end: S.ending || "", month: S.month, day: S.day, slot: S.slot, cash: S.cash, debt: S.debt, galFame: S.galFame, augs: S.augs.slice(), rng: S.rng >>> 0, fx: S.fx >>> 0, pending: S.pending ? S.pending.t : "" };
  const bad = Object.keys(v.expected).filter(k => JSON.stringify(v.expected[k]) !== JSON.stringify(got[k]));
  if (bad.length) {
    fail++;
    console.log(`FAIL ${v.name}: ` + bad.map(k => `${k} expected ${JSON.stringify(v.expected[k])} got ${JSON.stringify(got[k])}`).join(" · "));
    if (v.digest) { const a = v.digest.split(";"), b = SIM.digest(S).split(";"); const i = a.findIndex((x, j) => x !== b[j]); if (i >= 0) console.log(`  첫 차이 digest[${i}]: ${a[i]} ≠ ${b[i]}`); }
  } else pass++;
}
console.log(`golden: ${pass} pass, ${fail} fail (${Date.now() - t0}ms)`);
process.exit(fail ? 1 : 0);
