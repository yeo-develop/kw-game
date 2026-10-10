/* sim/talk.js — 대사·연출 이벤트 헬퍼 + 결과 반응(react). 문구는 전부 data(STR·ML) 에서. */
import { D, st, emit } from "./core.js";
import { fpick } from "./rng.js";
import { T, sgnWon, sgnMan, conv } from "./fmt.js";
import { has } from "./state.js";
import { stress, fame, toast, pushF, pushK, augFx } from "./effects.js";
import { galReact } from "./gall.js";

/* who: m(미래) · me(나) · kim(김사장) · nar(내레이션) · npc(이름 name) */
export const say = (who, text, face, name) => emit("say", { who, text, face: face || null, name: name || null });
export const M = (text, face) => say("m", text, face);
export const N = text => say("nar", text);
export const KIM = text => say("kim", text);
export const NPC = (name, text) => say("npc", text, null, name);
export const hideDlg = () => emit("hideDlg");
export const bubble = (text, ms, face) => emit("bubble", { text, ms, face: face || null });
export const face = f => emit("face", { f });
export const fx = (k, o) => emit("fx", Object.assign({ k }, o || {}));
export const scene = (bg, o) => emit("scene", Object.assign({ bg }, o || {}));
export const npc = (kind, mood) => emit("npc", { kind, mood: mood || null });
export const kim = (on, f) => emit("kim", { on: !!on, face: f || null });
export const tut = k => emit("tut", { k });

/* 도박·투자 결과 반응 */
export function react(net, ctx = {}) {
  const S = st();
  const before = Math.max(1, ctx.before || 1);
  const big = Math.abs(net) >= 1000000 || (Math.abs(net) >= 300000 && Math.abs(net) >= before * 0.5);   /* games.isBig 와 같은 기준 */
  const gctx = { amt: sgnMan(net), conv: conv(net), lev: ctx.lev, liqp: ctx.lev ? (90 / ctx.lev).toFixed(1) : "" };
  const lm = ctx.gamble && has("addict") ? 2 : 1;
  const tail = () => T("react.tail", { amt: sgnWon(net), conv: conv(net) });
  if (ctx.liq) {
    fame(1);
    toast(T("liq.toast", { lev: ctx.lev, amt: sgnWon(net) }), "liq", "stock"); pushF("💀", T("liq.feed", { lev: ctx.lev, amt: sgnWon(net), conv: conv(net) }), "liq");
    fx("ash");
    galReact("liq", gctx, 3); pushK("m", T("liq.k1")); pushK("m", T("liq.k2"));
    stress(35);
    M(fpick(D.ML.liq), "cry");
  } else if (net > 0 && big) {
    S.st.bigWin++; fame(1);
    fx("flex", { amt: net }); galReact(ctx.jackpot ? "jackpot" : "bigwin", gctx, 3); pushK("m", T("bigwin.k"));
    stress(-15);
    M(fpick(D.ML.bigwin) + tail(), "flex");
  } else if (net > 0) {
    galReact("win", gctx, 2); stress(-8);
    M(fpick(D.ML.win) + tail(), "happy");
  } else if (net < 0 && big) {
    fame(1);
    fx("crack", { amt: net }); galReact("bigloss", gctx, 3); pushK("m", T("bigloss.k1")); pushK("m", T("bigloss.k2"));
    stress(22 * lm);
    if (lm > 1) augFx("addict", T("aug.addictLoss"));
    M(fpick(D.ML.bigloss) + tail(), "cry");
  } else if (net < 0) {
    galReact("loss", gctx, 2); stress(8 * lm);
    M(fpick(D.ML.loss) + tail(), "angry");
  } else { M(T("react.even"), "tired"); }
  hideDlg();
}
