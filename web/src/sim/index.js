/* sim/index.js — sim 공개 진입점. 브라우저 번들은 window.SIM, Node 는 import. */
import { won, sgnWon, man, sgnMan, pct, fmtP, stars, fill, T, TA, conv } from "./fmt.js";
export { setData, configure, D } from "./core.js";
export { createGame, apply } from "./api.js";
export { STATE_VERSION } from "./state.js";
export { query, Q } from "./query.js";
export { m32 } from "./rng.js";
export { roundHalfUp, clamp } from "./num.js";
/* 포맷 (view 공용) */
export const F = { won, sgnWon, man, sgnMan, pct, fmtP, stars, fill, T, TA, conv };
export { digest, stateHash, fnv1a } from "./digest.js";
