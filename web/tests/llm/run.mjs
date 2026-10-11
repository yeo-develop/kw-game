#!/usr/bin/env node
/* tests/llm/run.mjs — LLM 녹화 응답 픽스처 검증 (JS). 사용: node web/tests/llm/run.mjs */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadData } from "../../tools/load-data.mjs";
import * as SIM from "../../src/sim/index.js";
import { expectLlm } from "./common.mjs";
const v = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "fixture.json"), "utf8"));
SIM.setData(loadData());
const got = expectLlm(SIM, v);
const bad = Object.keys(v.expected).filter(k => JSON.stringify(v.expected[k]) !== JSON.stringify(got[k]));
console.log(bad.length ? `llm fixture FAIL: ${bad.join(", ")}` : `llm fixture: pass (cmds ${v.commands.length}, 요청 ${v.reqs.length}, hash ${got.hash})`);
process.exit(bad.length ? 1 : 0);
