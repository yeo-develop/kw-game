#!/usr/bin/env node
/* tools/llm-smoke.mjs — LLM 워커 실제 호출 스모크 (docs/LLM.md).
   /news 1번 + /line 1번을 보내고 응답 스키마·게임 규칙(목록 안 종목·방향·세기·글자 수)을 검사한다.
   - ANTHROPIC_API_KEY 가 환경에 있으면: server/llm-worker 를 wrangler dev 로 로컬에 띄워(키는 프로세스 환경으로만 전달, 파일·출력 없음) 거기로 보냄.
   - 없으면: 배포된 워커(LLM_URL, 기본 아래 URL)로 보냄. 워커에 키가 없으면(/health hasKey=false) "건너뜀"으로 끝(exit 0).
   사용: node tools/llm-smoke.mjs   ·   LLM_URL=https://… node tools/llm-smoke.mjs */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEPLOYED = "https://kw-game-llm.kw-game-llm-worker.workers.dev";
const LIM = { headline: 60, body: 300, source: 20, event: 60, line: 80, kakao: 60 };

let dev = null, base = process.env.LLM_URL || DEPLOYED;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function startLocal() {
  const port = 8797;
  dev = spawn("npx", ["wrangler", "dev", "--port", String(port)], { cwd: path.join(ROOT, "server/llm-worker"), env: { ...process.env, CLOUDFLARE_INCLUDE_PROCESS_ENV: "true" }, stdio: "ignore", detached: true });
  base = `http://localhost:${port}`;
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base + "/health")).ok) return; } catch { /* 아직 */ } await sleep(1000); }
  throw new Error("wrangler dev 가 안 뜸");
}
const stop = () => { if (dev) try { process.kill(-dev.pid); } catch { /* 이미 끝남 */ } };

async function post(p, body) {
  const t0 = Date.now();
  const r = await fetch(base + p, { method: "POST", headers: { "content-type": "application/json", "x-device-id": "smoke-test-0001" }, body: JSON.stringify(body) });
  const j = await r.json();
  return { j, ms: Date.now() - t0, status: r.status };
}
const str = (x, n) => typeof x === "string" && x.length > 0 && x.length <= n;

let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? "  ✓" : "  ✗"} ${msg}`); if (!ok) fails++; };

try {
  if (process.env.ANTHROPIC_API_KEY) { console.log("ANTHROPIC_API_KEY 있음 → 로컬 wrangler dev 로 실제 호출"); await startLocal(); }
  else console.log(`ANTHROPIC_API_KEY 없음 → 배포된 워커 ${base}`);
  const h = await (await fetch(base + "/health")).json();
  console.log(`health: ${JSON.stringify(h)}`);
  if (!h.hasKey) {
    const r = await post("/line", { month: 1, day: 1, slot: 0, debt: 3e7, cash: 5e5, hold: 0, todayPnl: 0, interest: 9e5, dday: 6, paid: false, hp: 100, stress: 20, addict: 0, mood: "neutral", relics: [], recent: [] });
    check(r.j.ok === false && r.j.error === "no_key", `키 없음 응답: ${JSON.stringify(r.j)} (${r.ms}ms)`);
    console.log(fails ? "llm-smoke: 실패" : "llm-smoke: 건너뜀 (워커에 키 없음 — 게임은 내장 문구로 폴백)");
  } else {
    const fx = JSON.parse(fs.readFileSync(path.join(ROOT, "web/tests/llm/fixture.json"), "utf8"));
    const q = fx.reqs.find(r => r.req.arcs.length)?.req ?? fx.reqs[0].req;
    const n = await post("/news", q);
    console.log(`/news ${n.status} ${n.ms}ms: ${JSON.stringify(n.j)}`);
    const f = n.j.fact || {};
    check(n.j.ok === true, "/news ok");
    check(f.slotId === q.slotId && f.dir === q.dir, "slotId·dir = 요청");
    check(q.tickers.some(t => t.k === f.ticker), `ticker ${f.ticker} ∈ 목록`);
    check(q.strengths.includes(f.strength), `strength ${f.strength} ∈ ${q.strengths}`);
    check(str(f.headline, LIM.headline) && str(f.body, LIM.body) && str(f.source, LIM.source) && str(f.event, LIM.event), "글자 수 한도");
    check(f.arcId === undefined || (/^[a-z0-9_-]{1,24}$/.test(f.arcId) && Number.isInteger(f.arcStep)), "arcId 형식");
    const l = await post("/line", { month: 1, day: 6, slot: 2, debt: 31200000, cash: 420000, hold: 1800000, todayPnl: -650000, interest: 936000, dday: 1, paid: false, hp: 35, stress: 62, addict: 41, mood: "tired", relics: ["목장갑", "산삼주"], recent: ["빚트코인 ▼12.4%", "🔔 저녁 끝 · 평가손익 −650,000원"] });
    console.log(`/line ${l.status} ${l.ms}ms: ${JSON.stringify(l.j)}`);
    check(l.j.ok === true && str(l.j.line, LIM.line) && str(l.j.kakao, LIM.kakao), "/line ok + 글자 수");
    console.log(fails ? `llm-smoke: 실패 ${fails}건` : "llm-smoke: 통과");
  }
} catch (e) { console.log("llm-smoke 에러: " + e.message); fails++; }
finally { stop(); }
process.exit(fails ? 1 : 0);
