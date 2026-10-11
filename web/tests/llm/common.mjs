/* tests/llm/common.mjs — LLM 픽스처 재생·기대값 (gen.mjs · run.mjs 공용). C# 쪽은 Assets/Tests/EditMode/LlmTests.cs · dotnet/SimHarness 가 같은 걸 계산. */
export function expectLlm(SIM, v) {
  let S = SIM.createGame(v.seed, {}), nev = 0, errs = 0, ri = 0;
  const reqOk = () => { while (ri < v.reqs.length && v.reqs[ri].at === n) { const q = SIM.query(S, SIM.Q.newsReq); if (JSON.stringify(q) !== JSON.stringify(v.reqs[ri].req)) throw new Error(`요청 다름 #${ri}`); ri++; } };
  let n = 0;
  reqOk();
  for (const c of v.commands) { const r = SIM.apply(S, c); S = r.state; nev += r.events.length; errs += r.events.filter(e => e.t === "error" && e.msg === "newsFact").length; n++; reqOk(); }
  if (ri !== v.reqs.length) throw new Error(`요청 확인 ${ri}/${v.reqs.length}`);
  return {
    hash: SIM.stateHash(S), events: nev, factErrors: errs, end: S.ending || "", month: S.month, day: S.day, slot: S.slot, rng: S.rng >>> 0, fx: S.fx >>> 0,
    nstr: S.nstr, nlog: S.nlog, newsFeed: S.feed.filter(f => f.kind === "news").map(f => ({ x: f.x, rows: f.rows || null })),
  };
}
