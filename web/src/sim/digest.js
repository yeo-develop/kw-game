/* sim/digest.js — 골든 벡터용 상태 요약·해시 (C# 이식 시 같은 함수를 구현해 비교).
   digest = 숫자 필드만 고정 순서로 이어 붙인 문자열 (문구·표시용 텍스트 제외).
   실수(double)는 IEEE-754 비트(16진 16자리)로 적는다 → 반올림 표기 차이 없이 비트 단위 비교.
   hash = FNV-1a 32비트 (UTF-8 바이트 = 여기선 전부 ASCII). */
const bits = x => { const dv = new DataView(new ArrayBuffer(8)); dv.setFloat64(0, x); return dv.getUint32(0).toString(16).padStart(8, "0") + dv.getUint32(4).toString(16).padStart(8, "0"); };
const num = x => Number.isInteger(x) ? String(x) : "f" + bits(x);
export function digest(S) {
  const p = [];
  const put = (k, v) => p.push(k + "=" + v);
  put("v", S.version); put("rngv", S.rngv); put("rng", S.rng >>> 0); put("fx", S.fx >>> 0);
  put("m", S.month); put("d", S.day); put("s", S.slot); put("ph", S.phase); put("end", S.ending || "");
  put("cash", num(S.cash)); put("debt", num(S.debt)); put("hp", num(S.hp)); put("addict", num(S.addict)); put("faint", S.faint); put("cleared", S.cleared); put("stress", num(S.stress)); put("fame", num(S.galFame)); put("paid", S.paidMonth);
  put("realized", num(S.realized)); put("augs", S.augs.join(","));
  for (const k of Object.keys(S.st).sort()) if (typeof S.st[k] === "number") put("st." + k, num(S.st[k]));
  put("n.posts", S.posts.length); put("n.tips", S.tips.length); put("n.feed", S.feed.length); put("gid", S.gid); put("pid", S.pid);
  for (const k of Object.keys(S.mk || {}).sort()) { if (k === "reg") { put("reg", S.mk.reg); continue; } put("p." + k, num(S.mk[k].p)); put("tr." + k, S.mk[k].tr); }
  for (const k of Object.keys(S.hold).sort()) { put("h." + k + ".q", num(S.hold[k].q)); put("h." + k + ".c", num(S.hold[k].cost)); }
  for (const c of S.cps) put("c." + c.id, [c.tk, c.dir, c.lev, num(c.margin), num(c.entry), c.t0].join(":"));
  put("pend", S.pending ? S.pending.t : "");
  return p.join(";");
}
export function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i) & 0xff; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}
export const stateHash = S => fnv1a(digest(S));
