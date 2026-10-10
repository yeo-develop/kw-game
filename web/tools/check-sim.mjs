#!/usr/bin/env node
/* tools/check-sim.mjs — sim 순수성 검사: DOM·타이머·await·HTML·Math.random·시간 사용 금지, 한글 문자열 리터럴은 ids.js 에만.
   주석은 검사에서 뺀다. 위반이 있으면 exit 1. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/sim");
const BAN = [/\bdocument\b/, /\bwindow\b/, /\bsetTimeout\b/, /\bsetInterval\b/, /\bawait\b/, /\basync\b/, /\bPromise\b/, /\blocalStorage\b/, /Math\.random/, /Date\.now/, /\bperformance\b/, /<\/?(div|span|b|br|button|svg|small)\b/];
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
let bad = 0;
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith(".js")).sort()) {
  const src = strip(fs.readFileSync(path.join(DIR, f), "utf8"));
  src.split("\n").forEach((line, i) => {
    for (const re of BAN) if (re.test(line)) { bad++; console.log(`${f}:${i + 1} 금지 ${re}: ${line.trim().slice(0, 100)}`); }
    if (f !== "ids.js" && /["'`][^"'`]*[가-힣][^"'`]*["'`]/.test(line)) { bad++; console.log(`${f}:${i + 1} 한글 리터럴: ${line.trim().slice(0, 100)}`); }
  });
}
console.log(bad ? `sim 검사: 위반 ${bad}건` : "sim 검사: OK (DOM·타이머·await·HTML·Math.random 없음, 한글 리터럴은 ids.js 만)");
process.exit(bad ? 1 : 0);
