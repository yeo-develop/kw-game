// 후검증 단위 테스트 (SDK·네트워크 없이). npm test
import assert from "node:assert/strict";
import { clean, checkNews, checkLine, checkGall, NewsReq, LineReq, policyOk } from "../src/validate.ts";

const req = NewsReq.parse({ slotId: 15, month: 1, day: 6, slot: 0, dir: 1, fake: true, tier: 0,
  tickers: [{ k: "BAT", name: "킹배터리", type: "stock" }, { k: "MKT", name: "시장 전체", type: "market" }], strengths: ["strong"], recent: [], arcs: [] });
const good = { ticker: "BAT", strength: "strong" as const, event: "수주", arcId: "bat-deal", arcStep: 2, headline: "킹배터리 해외 수주", body: "킹배터리가 수주했다.", source: "머니투데이트" };
assert.deepEqual(checkNews(req, good), { slotId: 15, dir: 1, ticker: "BAT", strength: "strong", event: "수주", headline: "킹배터리 해외 수주", body: "킹배터리가 수주했다.", source: "머니투데이트", arcId: "bat-deal", arcStep: 2 });
assert.equal(checkNews(req, { ...good, ticker: "GSE" }), null, "목록 밖 종목");
assert.equal(checkNews(req, { ...good, strength: "weak" }), null, "허용 안 된 세기");
assert.equal(checkNews(req, { ...good, headline: "가".repeat(61) }), null, "길이");
assert.equal(checkNews(req, { ...good, body: "자세한 건 https://x.com 참고" }), null, "링크");
assert.equal(checkNews(req, { ...good, arcId: "" })!.arcId, undefined, "단발성");
assert.equal(clean("  a <b>{c}  ", 10), "a b c");
assert.equal(clean("   ", 10), null);
assert.deepEqual(checkLine({ line: "자기야 이자 있지?", kakao: "국밥 먹자" }), { line: "자기야 이자 있지?", kakao: "국밥 먹자" });
assert.equal(checkLine({ line: "", kakao: "x" }), null);
assert.equal(checkGall({ title: "t", body: "b", comments: [{ au: "모르는사람", x: "ㅋㅋ" }] })!.comments[0].au, "ㅇㅇ");
assert.equal(policyOk("병신같네"), false);
assert.equal(policyOk("ㅅㅂ 조작임 ㅋㅋ"), true);
assert.throws(() => LineReq.parse({ month: 1 }));
console.log("validate: ok");
