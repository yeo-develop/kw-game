using System;
using System.Collections.Generic;
using System.Linq;

namespace KwGame.Sim
{
    // effects.js (수치 변화·알림 기록) + talk.js (대사·연출 이벤트, react)
    public partial class GameSim
    {
        void hp(double d, string why = null)
        {
            d = rhu(d); if (d == 0) return;
            double b = S.hp;
            S.hp = clamp(S.hp + d, 0, R.HP_MAX);
            if (S.hp != b) Emit("hp", "d", S.hp - b, "why", why ?? "");
        }
        void addict(double d, bool notMe = false)
        {
            double b = S.addict;
            S.addict = clamp(rhu(S.addict + d), 0, 100);
            if (d > 0 && !notMe) { S.gday = absDay(); S.gT = Tnow(); }
            if (S.addict != b) Emit("addict", "d", S.addict - b, "v", S.addict);
        }
        void stress(double d)
        {
            if (d > 0 && has("posi")) d *= 0.7;
            string before = mental();
            S.stress = clamp(S.stress + d, 0, 100);
            if (mental() != before) Emit("ment", "m", mental());
        }
        void money(double d, string kind, string label) { S.cash += d; S.today.Add(new Ledger { kind = kind, amt = d, label = label }); Emit("cash", "d", d); }
        void addDebt(double d, string label) { S.debt += d; S.st.maxDebt = Math.Max(S.st.maxDebt, S.debt); S.today.Add(new Ledger { kind = "debt", amt = -d, label = label }); Emit("debt", "d", d); }
        void coverNeg() { if (S.cash < 0) { double d = Math.Ceiling(-S.cash); S.cash = 0; addDebt(d, T("lbl.cover")); } }
        void augFx(string id, string text) => Emit("augfx", "id", id, "text", text);
        void toast(string text, string kind = null, string app = null, string room = null) => Emit("toast", "text", text, "kind", kind ?? "", "app", app, "room", room);
        void fame(double d)
        {
            var before = rankOf(S.galFame);
            S.galFame = Math.Max(0, S.galFame + d);
            var after = rankOf(S.galFame);
            if (after.f > before.f) { toast(T("fame.toast", "r", after.name, "d", after.desc), "gal", "gall"); pushF("🏅", T("fame.feed", "r", after.name, "f", S.galFame, "d", after.desc), "fame"); }
        }
        void pushK(string w, string x) => pushKR(w == "kim" ? "kim" : "m", w, x);
        void pushKR(string room, string w, string x)
        {
            var L = S.kk[room]; L.Add(new KMsg { w = w, x = x, t = clockNow(), d = absDay() }); if (L.Count > 60) L.RemoveRange(0, L.Count - 60);
            if (w != "me" && w != "sys") S.kun[room]++;
            if (room == "kim" && w == "kim") toast(T("kim.toast", "x", x), "kim", "kakao", "kim");
            Emit("kakao", "room", room);
        }
        void pushF(string ic, string x, string kind = null, List<string> rows = null)
        {
            S.feed.Add(new Feed { ic = ic, x = x, kind = kind ?? "", lab = T("feedLab", "m", S.month, "d", S.day, "s", D.SLOT_NAME[S.slot]), rows = rows });
            if (S.feed.Count > 90) S.feed.RemoveAt(0);
            S.fUnread++;
            Emit("feed");
        }

        // ---------- talk.js ----------
        void say(string who, string text, string face = null, string name = null) => Emit("say", "who", who, "text", text, "face", face, "name", name);
        void M(string text, string face = null) => say("m", text, face);
        void N(string text) => say("nar", text);
        void KIM(string text) => say("kim", text);
        void NPC(string name, string text) => say("npc", text, null, name);
        void hideDlg() => Emit("hideDlg");
        void bubble(string text, double ms, string face = null) => Emit("bubble", "text", text, "ms", ms, "face", face);
        void face(string f) => Emit("face", "f", f);
        void fx(string k, params object[] kv) { var a = new List<object> { "k", k }; a.AddRange(kv); Emit("fx", a.ToArray()); }
        void scene(string bg, params object[] kv) { var a = new List<object> { "bg", bg }; a.AddRange(kv); Emit("scene", a.ToArray()); }
        void npc(string kind, string mood = null) => Emit("npc", "kind", kind, "mood", mood);
        void kim(bool on, string f = null) => Emit("kim", "on", on, "face", f);
        void tut(string k) => Emit("tut", "k", k);

        class ReactCtx { public double before; public bool gamble, jackpot, liq; public double lev; }
        void react(double net, ReactCtx ctx = null)
        {
            ctx = ctx ?? new ReactCtx();
            double before = Math.Max(1, ctx.before != 0 ? ctx.before : 1);
            bool big = Math.Abs(net) >= 1000000 || (Math.Abs(net) >= 300000 && Math.Abs(net) >= before * 0.5);
            var gctx = V("amt", sgnMan(net), "conv", conv(net), "lev", ctx.lev != 0 ? (object)ctx.lev : null, "liqp", ctx.lev != 0 ? JsFmt.ToFixed(90 / ctx.lev, 1) : "");
            double lm = ctx.gamble && has("addict") ? 2 : 1;
            Func<string> tail = () => T("react.tail", "amt", sgnWon(net), "conv", conv(net));
            if (ctx.liq)
            {
                fame(1);
                toast(T("liq.toast", "lev", ctx.lev, "amt", sgnWon(net)), "liq", "stock"); pushF("💀", T("liq.feed", "lev", ctx.lev, "amt", sgnWon(net), "conv", conv(net)), "liq");
                fx("ash");
                galReact("liq", gctx, 3); pushK("m", T("liq.k1")); pushK("m", T("liq.k2"));
                stress(35);
                M(fpick(D.ML["liq"]), "cry");
            }
            else if (net > 0 && big)
            {
                S.st.bigWin++; fame(1);
                fx("flex", "amt", net); galReact(ctx.jackpot ? "jackpot" : "bigwin", gctx, 3); pushK("m", T("bigwin.k"));
                stress(-15);
                var a = fpick(D.ML["bigwin"]); M(a + tail(), "flex");
            }
            else if (net > 0)
            {
                galReact("win", gctx, 2); stress(-8);
                var a = fpick(D.ML["win"]); M(a + tail(), "happy");
            }
            else if (net < 0 && big)
            {
                fame(1);
                fx("crack", "amt", net); galReact("bigloss", gctx, 3); pushK("m", T("bigloss.k1")); pushK("m", T("bigloss.k2"));
                stress(22 * lm);
                if (lm > 1) augFx("addict", T("aug.addictLoss"));
                var a = fpick(D.ML["bigloss"]); M(a + tail(), "cry");
            }
            else if (net < 0)
            {
                galReact("loss", gctx, 2); stress(8 * lm);
                var a = fpick(D.ML["loss"]); M(a + tail(), "angry");
            }
            else M(T("react.even"), "tired");
            hideDlg();
        }
    }
}
