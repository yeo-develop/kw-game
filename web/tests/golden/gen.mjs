#!/usr/bin/env node
/* tests/golden/gen.mjs — 골든 벡터 생성. 헤드리스 봇으로 명령열을 녹화하고, 처음부터 다시 재생해 최종 상태를 기대값으로 적는다.
   벡터 = {name, seed, opts, commands[], expected:{hash, digest 일부 수치}}. 유니티 EditMode 테스트가 같은 파일로 C# sim 을 검증.
   사용: node web/tests/golden/gen.mjs   (sim 규칙/난수가 바뀌면 다시 생성하고 차이를 리뷰) */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadData } from "../../tools/load-data.mjs";
import * as SIM from "../../src/sim/index.js";
import { runGame } from "../../tools/bots.mjs";
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "vectors");
SIM.setData(loadData());
fs.mkdirSync(DIR, { recursive: true });
for (const f of fs.readdirSync(DIR)) if (f.endsWith(".json")) fs.unlinkSync(path.join(DIR, f));

export function replay(v) {
  let S = SIM.createGame(v.seed, v.opts || {});
  let nev = 0;
  for (const c of v.commands) { const r = SIM.apply(S, c); S = r.state; nev += r.events.length; }
  return { S, nev };
}
export function expectOf(S, nev) {
  return { hash: SIM.stateHash(S), events: nev, end: S.ending || "", month: S.month, day: S.day, slot: S.slot, cash: S.cash, debt: S.debt, galFame: S.galFame, augs: S.augs.slice(), rng: S.rng >>> 0, fx: S.fx >>> 0, pending: S.pending ? S.pending.t : "" };
}
const specs = [];
for (const strat of ["work", "invest", "gamble", "random"]) for (const seed of [11, 22, 33, 1201]) specs.push({ name: `${strat}_${seed}`, strat, seed });
for (const [seed, k] of [[7, 20], [7, 60], [42, 150], [42, 300]]) specs.push({ name: `random_${seed}_first${k}`, strat: "random", seed, cut: k });
let n = 0;
for (const sp of specs) {
  const g = runGame(sp.seed, sp.strat, { record: true });
  const commands = sp.cut ? g.cmds.slice(0, sp.cut) : g.cmds;
  const v = { name: sp.name, seed: sp.seed, opts: {}, strat: sp.strat, commands };
  const { S, nev } = replay(v);
  v.expected = expectOf(S, nev);
  v.digest = SIM.digest(S);
  fs.writeFileSync(path.join(DIR, sp.name + ".json"), JSON.stringify(v) + "\n");
  n++;
  console.log(`${sp.name.padEnd(22)} cmds=${String(commands.length).padStart(4)} end=${v.expected.end || "-"} hash=${v.expected.hash}`);
}
console.log(`${n} vectors → ${DIR}`);
