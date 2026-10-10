#!/usr/bin/env node
/* web/build.mjs — 의존성 없는 번들러. src/sim (ES 모듈) + src/data (JSON) + src/view (클래식 스크립트·CSS·HTML)
   → 한 파일 prototype/index.html.
   sim 모듈 문법 제한(번들러가 이해하는 것만): 한 줄 import { a, b as c } / import * as X · export function / export const ·
   export { a, b } from "./x.js" · export { a, b }. (export let·default·순환 import 금지 — 순환이면 빌드 실패)
   사용: node web/build.mjs [--out 경로] */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadData } from "./tools/load-data.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, "src");
const argOut = process.argv.indexOf("--out");
const OUT = argOut > 0 ? path.resolve(process.argv[argOut + 1]) : path.resolve(ROOT, "../prototype/index.html");
/* view 스크립트 순서 (전부 같은 전역 스코프를 공유하는 클래식 스크립트) */
const VIEW_JS = ["base.js", "art.js", "ui.js", "fx.js", "phone.js", "phone2.js", "tut.js", "minigames.js", "panels.js", "panels2.js", "events.js", "main.js"];

/* ---------- sim 번들 ---------- */
const mods = new Map(); const order = []; const visiting = new Set();
const rel = p => path.relative(SRC, p).split(path.sep).join("/");
function load(file) {
  const id = rel(file);
  if (mods.has(id)) return id;
  if (visiting.has(id)) throw new Error("순환 import: " + id);
  visiting.add(id);
  const src = fs.readFileSync(file, "utf8"), exp = [], out = [];
  const dep = spec => load(path.resolve(path.dirname(file), spec));
  const names = s => s.split(",").map(x => x.trim()).filter(Boolean).map(x => { const m = /^(\w+)(?:\s+as\s+(\w+))?$/.exec(x); if (!m) throw new Error(`${id}: 이해 못 하는 이름 '${x}'`); return [m[1], m[2] || m[1]]; });
  for (const line of src.split("\n")) {
    let m;
    if ((m = /^import\s*\{([^}]*)\}\s*from\s*"([^"]+)";?\s*$/.exec(line))) { out.push(`const { ${names(m[1]).map(([a, b]) => a === b ? a : `${a}: ${b}`).join(", ")} } = __m["${dep(m[2])}"];`); continue; }
    if ((m = /^import\s*\*\s*as\s+(\w+)\s+from\s*"([^"]+)";?\s*$/.exec(line))) { out.push(`const ${m[1]} = __m["${dep(m[2])}"];`); continue; }
    if ((m = /^export\s*\{([^}]*)\}\s*from\s*"([^"]+)";?\s*$/.exec(line))) { const ns = names(m[1]); out.push(`const { ${ns.map(([a, b]) => a === b ? a : `${a}: ${b}`).join(", ")} } = __m["${dep(m[2])}"];`); ns.forEach(([, b]) => exp.push(b)); continue; }
    if ((m = /^export\s*\{([^}]*)\};?\s*$/.exec(line))) { names(m[1]).forEach(([a, b]) => exp.push(a === b ? a : `${b}: ${a}`)); continue; }
    if ((m = /^export\s+(async\s+)?function\s+(\w+)/.exec(line))) { exp.push(m[2]); out.push(line.replace(/^export\s+/, "")); continue; }
    if ((m = /^export\s+const\s+(\w+)/.exec(line))) { exp.push(m[1]); out.push(line.replace(/^export\s+/, "")); continue; }
    if (/^\s*(import|export)\b/.test(line)) throw new Error(`${id}: 지원 안 하는 문법: ${line}`);
    out.push(line);
  }
  visiting.delete(id);
  mods.set(id, `__m["${id}"] = (function () {\n${out.join("\n")}\nreturn { ${exp.join(", ")} };\n})();`);
  order.push(id);
  return id;
}
load(path.join(SRC, "sim/index.js"));
const simJs = `const SIM = (function () {\n"use strict";\nconst __m = {};\n${order.map(id => mods.get(id)).join("\n")}\nreturn __m["sim/index.js"];\n})();`;

/* ---------- 데이터 ---------- */
const DATA = loadData();
const dataJs = `const DATA = ${JSON.stringify(DATA)};\nSIM.setData(DATA);`;

/* ---------- view ---------- */
const html = fs.readFileSync(path.join(SRC, "view/index.html"), "utf8");
const css = fs.readFileSync(path.join(SRC, "view/style.css"), "utf8");
const viewJs = VIEW_JS.map(f => `/* ===== view/${f} ===== */\n` + fs.readFileSync(path.join(SRC, "view", f), "utf8")).join("\n");
const script = `<script>\n"use strict";\n${simJs}\n${dataJs}\n${viewJs}\n</script>`;
if (!html.includes("/*@CSS@*/") || !html.includes("<!--@SCRIPT@-->")) throw new Error("index.html 자리표시자 없음");
const outHtml = html.replace("/*@CSS@*/", () => css).replace("<!--@SCRIPT@-->", () => script);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, outHtml);
console.log(`build ok → ${OUT} (${outHtml.length.toLocaleString()} bytes · sim ${order.length} modules · data ${Object.keys(DATA).length} tables)`);
