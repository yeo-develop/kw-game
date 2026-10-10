/* data/*.json 을 하나로 합쳐 sim 에 넣는다 (Node 용). 브라우저는 build.mjs 가 같은 결과를 인라인. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
export const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/data");
export function loadData() {
  const o = {};
  for (const f of fs.readdirSync(DATA_DIR).sort()) if (f.endsWith(".json")) Object.assign(o, JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf8")));
  return o;
}
