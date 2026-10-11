#!/usr/bin/env node
/* tests/llm/gen.mjs — LLM 녹화 응답 픽스처 생성 (docs/LLM.md §테스트).
   봇이 게임을 하는 동안 칸마다 newsReq 를 보고, 미리 써 둔 '녹화된 LLM 응답'(CANNED)을 newsFact 명령으로 끼워 넣는다.
   일부러 틀린 응답(목록 밖 종목·방향 틀림·글자 수 초과·지난 칸)과 무응답(→ 내장 생성기)도 섞는다.
   결과 fixture.json = {명령열, 중간 요청(newsReq) 기록, 기대값(해시·이벤트 수·뉴스 로그·뉴스 피드)} → JS(run.mjs)·C#(EditMode·simtest) 가 같은 값을 내야 함.
   사용: node web/tests/llm/gen.mjs */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadData } from "../../tools/load-data.mjs";
import * as SIM from "../../src/sim/index.js";
import { runGame } from "../../tools/bots.mjs";
import { expectLlm } from "./common.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
SIM.setData(loadData());

const CANNED = [
  { event: "실적 발표 서프라이즈", headline: "[단독] {n}, 분기 실적 '어닝 서프라이즈'… 갤 '내가 뭐랬냐'", body: "{n}이 시장 예상을 크게 웃도는 실적을 냈다. 증권가에선 '이 정도면 반칙'이라는 반응. 다만 일부 개미는 이미 손절한 뒤였다.", source: "한경제신문" },
  { event: "대표 SNS 설화", headline: "{n} 대표, 새벽 3시 SNS에 '떡상 각' 올렸다 삭제", body: "{n} 대표가 새벽에 의미심장한 글을 올렸다가 지웠다. 캡처본이 갤에 돌면서 해석이 분분하다. 회사 측은 '개인 계정'이라고만 밝혔다.", source: "코인데스크코리아" },
  { event: "규제 당국 조사설", headline: "금융당국, {n} 관련 '이상 거래' 들여다본다", body: "당국이 {n} 관련 단기 급등락 거래를 살펴보는 중이라고 한다. 아직 공식 발표는 없다. 지라시 출처는 '아는 형의 사촌'.", source: "찌라시닷컴" },
  { event: "해외 대형 계약", headline: "{n}, 해외 대형 계약 따냈다… 규모는 '비밀'", body: "{n}이 해외 업체와 대형 계약을 맺었다고 밝혔다. 계약 규모는 공개하지 않았다. 갤러들은 벌써 목표가를 두 배로 올렸다.", source: "머니투데이트" },
  { event: "서버 장애", headline: "{n} 거래 서버 40분 먹통… '손절도 못 했다' 분통", body: "{n} 관련 거래가 40분간 멈췄다. 그 사이 손절 못 한 개미들의 하소연이 이어졌다. 회사는 '트래픽 폭주'라며 보상안을 검토 중이다.", source: "IT조선소" },
  { event: "유명 유튜버 언급", headline: "구독자 300만 유튜버 '{n}은 무조건 간다'", body: "유명 재테크 유튜버가 방송에서 {n}을 콕 집어 언급했다. 영상 조회수는 하룻밤 새 100만을 넘겼다. 본인은 '투자 권유 아님'이라고 덧붙였다.", source: "유튜브 캡처" },
];

let i = 0, first = true, toggled = false;
const reqs = [], seen = new Set();
function inject(S, Q) {
  const out = [];
  if (first) { first = false; out.push({ t: "llmMode", on: true }); }
  if (!toggled && S.month === 1 && S.day === 5) { toggled = true; out.push({ t: "llmMode", on: false }, { t: "llmMode", on: true }); }   /* 껐다 켜기 = nfact 버림 */
  const q = Q("newsReq");
  if (q && !seen.has(q.slotId)) {
    seen.add(q.slotId);
    reqs.push({ at: -1, req: q });
    const k = i++, c = CANNED[k % CANNED.length], tk = q.tickers[k % q.tickers.length], nm = tk.name;
    const f = x => x.replace(/\{n\}/g, nm);
    const fact = { t: "newsFact", slotId: q.slotId, dir: q.dir, ticker: tk.k, strength: q.strengths[k % q.strengths.length], event: c.event, headline: f(c.headline), body: f(c.body), source: c.source };
    if (q.arcs.length && k % 3 === 0) { fact.arcId = q.arcs[0].id; fact.arcStep = q.arcs[0].step + 1; } else if (k % 4 === 1) { fact.arcId = "arc" + k; fact.arcStep = 1; }
    if (k % 13 === 2) { /* 무응답 → 내장 생성기 */ }
    else {
      if (k % 7 === 3) out.push(Object.assign({}, fact, { ticker: "INV" }));                 /* 목록 밖 종목 → 거부 */
      if (k % 11 === 5) out.push(Object.assign({}, fact, { headline: "가".repeat(61) }));   /* 글자 수 초과 → 거부 */
      if (k % 9 === 4) out.push(Object.assign({}, fact, { dir: -q.dir }));                  /* 방향 다름 → 거부 */
      if (k % 10 === 6) out.push(Object.assign({}, fact, { slotId: q.slotId - 1 }));        /* 지난 칸 → 거부 */
      if (k % 5 === 0) fact.headline = " \u0007" + fact.headline + "<script>{x}  ";        /* 제어문자·꺾쇠·중괄호 → 지우고 받음 */
      out.push(fact);
    }
  }
  return out;
}
/* runGame 은 봇 명령 1개 뒤마다 inject 를 부르고, 끼운 명령도 cmds 에 같이 녹화한다 */
const g = runGame(31, "invest", { record: true, maxMonth: 3, inject });
const v = { name: "llm_invest_31", seed: 31, strat: "invest", commands: g.cmds, reqs };
fixAt(v);
v.expected = expectLlm(SIM, v);
fs.writeFileSync(path.join(HERE, "fixture.json"), JSON.stringify(v, null, 0) + "\n");
console.log(`llm fixture: cmds=${v.commands.length} reqs=${reqs.length} facts=${v.commands.filter(c => c.t === "newsFact").length} hash=${v.expected.hash} end=${v.expected.end || "-"}`);

/* at = 그 요청을 볼 수 있게 되는 명령 위치 (그 앞까지 재생한 뒤 newsReq). reqs 는 녹화 순서대로이므로, 명령열을 재생하며 같은 slotId 요청이 처음 보이는 위치를 찾는다 */
function fixAt(v) {
  let S = SIM.createGame(v.seed, {});
  const want = v.reqs.map(r => r.req.slotId);
  let j = 0;
  const check = n => { if (j >= want.length) return; const q = SIM.query(S, SIM.Q.newsReq); if (q && q.slotId === want[j] && JSON.stringify(q) === JSON.stringify(v.reqs[j].req)) { v.reqs[j].at = n; j++; } };
  check(0);
  v.commands.forEach((c, n) => { S = SIM.apply(S, c).state; check(n + 1); });
  if (j !== want.length) throw new Error(`요청 위치 못 찾음 ${j}/${want.length}`);
}
