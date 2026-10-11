using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace KwGame.Sim
{
    // gall.js — 주식 갤러리(글·댓글·찌라시·내 글) + 미래 카톡 질문 + 형나믿지 DM
    public partial class GameSim
    {
        public Post postById(int id) => S.posts.FirstOrDefault(p => p.id == id);
        List<Cm> genCm(int n)
        {
            var outp = new List<Cm>(); var seen = new HashSet<string>(); var GN = D.GNKeys;
            for (int i = 0; i < n * 2 && outp.Count < n; i++)
            {
                string who = frnd() < 0.45 ? ANON : fpick(GN);
                var lst = (D.CM.TryGetValue(who, out var l) ? l : new List<string>()).Concat(D.CM["any"]).ToList();
                string x = fpick(lst);
                if (seen.Contains(x)) continue; seen.Add(x);
                outp.Add(new Cm { au = who, x = x, up = Math.Floor(frnd() * 14) });
            }
            return outp;
        }
        Post addPost(Post p)
        {
            // JS: Object.assign({id, T, lab, up:0, dn:0, cm:[], tag, body:""}, o) — 기본값은 호출 쪽 Post 초기값으로
            p.id = S.gid++; p.T = Tnow(); p.lab = S.month + "-" + S.day + " " + D.SLOT_NAME[S.slot];
            if (p.tag == null) p.tag = T("tag.normal");
            if (p.body == null) p.body = "";
            p.best = p.up >= 50;
            S.posts.Add(p);
            while (S.posts.Count > 70) { int i = S.posts.FindIndex(x => x.mine == 0); if (i < 0) break; S.posts.RemoveAt(i); }
            S.gNew++;
            Emit("post", "id", p.id);
            return p;
        }
        void galReact(string cat, Dictionary<string, object> ctx = null, int n = 3)
        {
            Func<string, string> f = x => fill(x, ctx ?? new Dictionary<string, object>());
            int from = Math.Max(0, S.posts.Count - 12);
            var recent = new HashSet<string>(S.posts.Skip(from).SelectMany(p => p.cm.Select(c => c.x)));
            var pool = D.GAL[cat].Where(e => !recent.Contains(f(e[1]))).ToList();
            var outp = new List<string[]>();
            while (pool.Count > 0 && outp.Count < Math.Max(2, n)) { int j = (int)Math.Floor(frnd() * pool.Count); outp.Add(pool[j]); pool.RemoveAt(j); }
            if (outp.Count == 0) return;
            string au = outp[0][0], x0 = outp[0][1];
            // 객체 리터럴 평가 순서 그대로: au → tag → title → body → up → dn → cm
            string pau = au == KIM_OFF ? au : frnd() < 0.5 ? au : ANON;
            string tag = T(cat == "news" ? "tag.news" : "tag.react");
            string title = f(D.GR_T.TryGetValue(cat, out var gt) && gt != null ? gt : x0);
            string body = f(x0);
            double up = D.HOT.ContainsKey(cat) && D.HOT[cat] != 0 ? 40 + Math.Floor(frnd() * 140) : Math.Floor(frnd() * 42);
            double dn = Math.Floor(frnd() * 12);
            var cm = new List<Cm>();
            foreach (var e in outp.Skip(1)) { string cx = f(e[1]); double cu = Math.Floor(frnd() * 25); cm.Add(new Cm { au = e[0], x = cx, up = cu }); }
            cm.AddRange(genCm(1 + (int)Math.Floor(frnd() * 3)));
            addPost(new Post { au = pau, tag = tag, title = title, body = body, up = up, dn = dn, cm = cm });
        }
        Tip makeTip(string au, string via, string tk0 = null)
        {
            var t = rollTip(au, tk0); string dw = T(t.dir > 0 ? "dw.up" : "dw.dn"), nm = D.TK[t.tk].name, wl = whenLabel(t.Tr);
            if (via == "dm") pushKR("hy", "hy", au == MATH ? T("hy.mathTip", "nm", nm, "wl", wl, "dw", dw, "rec", srcRec(au)) : fill(fpick(TA("hy.tip")), V("nm", nm, "wl", wl, "dw", dw)));
            else if (via == "post")
            {
                var tb = fpick(D.TIPT[au]); string ti = tb[0], b = tb[1];
                Func<string, string> f = x => x.Replace("{tk}", nm).Replace("{dw}", dw);
                string title = f(ti); string body = f(b) + T("tip.when", "wl", wl);
                double up = Math.Floor(frnd() * 30), dn = Math.Floor(frnd() * 10);
                var cm = genCm(2 + (int)Math.Floor(frnd() * 3));
                t.pid = addPost(new Post { au = au, tag = T("tag.tip"), title = title, body = body, up = up, dn = dn, cm = cm, tip = t.id }).id;
            }
            tipAnnounce(t, via);
            return t;
        }
        void gallMarketPosts(Dictionary<string, Move> mv)
        {
            var ks = TKS().Where(k => tkOpen(k)).ToList();
            string top = ks[0]; foreach (var k in ks) top = Math.Abs(mv[k].r) > Math.Abs(mv[top].r) ? k : top;
            double r = mv[top].r; string nm = D.TK[top].name;
            if (frnd() < 0.6)
            {
                string title = T("mkt.title", "nm", nm, "p", pct(r));
                string body = T("mkt.body", "s", D.SLOT_NAME[S.slot], "nm", nm, "p", pct(r), "q", T(r < 0 ? "mkt.dn" : "mkt.up"));
                double up = Math.Floor(frnd() * 40), dn = Math.Floor(frnd() * 8);
                var cm = genCm(3 + (int)Math.Floor(frnd() * 4));
                addPost(new Post { au = ANON, tag = T("tag.mkt"), title = title, body = body, up = up, dn = dn, cm = cm });
            }
            if (frnd() < 0.3)
            {
                string au = fpick(TA("mktAu")); string tk = fpick(ks); double lev = fpick(new double[] { 1, 3, 10, 25, 50 }); bool loss = frnd() < 0.65; double amt = rhu(20 + frnd() * 900) * 10000;
                var v = V("tk", D.TK[tk].name, "lev", lev, "amt", man(amt));
                string title = T(loss ? "proof.lossT" : "proof.gainT", v);
                string body = T(loss ? "proof.lossB" : "proof.gainB", V("c", conv(amt)));
                double up = 20 + Math.Floor(frnd() * (loss ? 120 : 60)), dn = Math.Floor(frnd() * 20);
                var cm = genCm(3 + (int)Math.Floor(frnd() * 4));
                addPost(new Post { au = au, tag = T("tag.proof"), title = title, body = body, up = up, dn = dn, cm = cm });
            }
        }
        void gallTick()
        {
            if (rnd() < 0.5)
            {
                var list = D.GNKeys; double tot = 0; foreach (var k in list) tot = tot + D.GN[k].w;
                double r = rnd() * tot; string au = list[0];
                foreach (var k in list) { r -= D.GN[k].w; if (r <= 0) { au = k; break; } }
                makeTip(au, "post");
            }
            // JS for-of 는 도중에 바뀌는 배열을 인덱스로 따라감 (settleMine → addPost 가 앞 글을 지울 수 있음)
            for (int i = 0; i < S.posts.Count; i++) { var p = S.posts[i]; if (p.mine != 0 && p.pend != 0 && p.T < Tnow()) settleMine(p); }
        }

        // ---------- 내 글 ----------
        string holdText()
        {
            var a = STK().Where(k => S.hold.Has(k)).Select(k => { var h = S.hold[k]; double v = h.q * S.mk.tk[k].p; return D.TK[k].name + " " + pct(v / h.cost - 1); })
                .Concat(S.cps.Select(c => T("hold.coin", "n", D.TK[c.tk].name, "lev", c.lev, "d", T(c.dir > 0 ? "long" : "short"), "p", sgnMan(cpnl(c) + c.bonus)))).ToList();
            return a.Count > 0 ? T("hold.has", "l", string.Join(", ", a)) : T("hold.none");
        }
        (string tk, double r)? waterTarget()
        {
            var s = STK().FirstOrDefault(k => S.hold.Has(k) && S.hold[k].q * S.mk.tk[k].p < S.hold[k].cost);
            if (s != null) return (s, S.hold[s].q * S.mk.tk[s].p / S.hold[s].cost - 1);
            var c = S.cps.FirstOrDefault(x => cpnl(x) < 0); if (c != null) return (c.tk, cpnl(c) / c.margin);
            return null;
        }
        public class Draft { public bool ok, big; public string tk, tag, title, body, why; }
        public Draft draft(string k)
        {
            double pnl = todayPnl(); int decor = S.props.Count + S.owned.Count - 1;
            var bse = V("m", S.month, "d", S.day, "pnl", sgnWon(pnl), "pm", sgnMan(pnl), "c", pnl != 0 ? conv(pnl) : T("conv0"), "hold", holdText(), "debt", won(S.debt));
            switch (k)
            {
                case "gain": { bool big = pnl >= 1e6, ok = pnl >= 50000; return new Draft { ok = ok, big = big, tag = T("tag.proof"), title = T(ok ? (big ? "gw.gain.tBig" : "gw.gain.tOk") : "gw.gain.tNo", bse), body = T("gw.gain.b", bse), why = T(ok ? (big ? "gw.gain.wBig" : "gw.gain.wOk") : "gw.gain.wNo") }; }
                case "loss":
                    {
                        bool ok = pnl <= -50000 || todayLiq();
                        string tag = T("tag.proof"), title = T(ok ? "gw.loss.tOk" : "gw.loss.tNo", bse);
                        string pre = todayLiq() ? T("gw.loss.liq") : "";
                        var b2 = new Dictionary<string, object>(bse); b2["c"] = pnl != 0 ? conv(pnl) : T("zeroWon");
                        return new Draft { ok = ok, tag = tag, title = title, body = pre + T("gw.loss.b", b2), why = T(ok ? "gw.loss.wOk" : "gw.loss.wNo") };
                    }
                case "gf":
                    {
                        var it = D.ITEMS.FirstOrDefault(x => x.id == S.outfit);
                        return new Draft { ok = true, tag = T("tag.brag"), title = T("gw.gf.t"), body = T("gw.gf.b", "hp", rhu(S.hp), "o", it != null ? T("gw.gf.wear", "n", it.name) : T("gw.gf.hoodie"), "r", decor > 0 ? T("gw.gf.decor", "n", decor) : T("gw.gf.jail"), "day", absDay()), why = T("gw.gf.w") };
                    }
                case "water":
                    {
                        var w = waterTarget();
                        return new Draft { ok = w != null, tk = w?.tk, tag = T("tag.q"), title = w != null ? T("gw.water.t", "n", D.TK[w.Value.tk].name, "p", pct(w.Value.r)) : T("gw.water.tNo"), body = w != null ? T("gw.water.b", "p", pct(w.Value.r), "hold", bse["hold"]) : T("gw.water.bNo"), why = T(w != null ? "gw.water.w" : "gw.water.wNo") };
                    }
                case "kim": return new Draft { ok = true, tag = T("tag.sue"), title = T("gw.kim.t", "r", rhu(rate() * 100)), body = T("gw.kim.b", "debt", won(S.debt), "due", won(interestDue())), why = T("gw.kim.w") };
            }
            return null;
        }
        Post submitPost(string k)
        {
            if (string.IsNullOrEmpty(k) || wroteToday() >= R.WRITE_MAX) return null;
            var d = draft(k);
            if (d == null) return null;   // JS: 알 수 없는 k 면 d.ok 에서 예외 → 명령 실패 (봇은 안 보냄)
            S.wrote[absDay()] = wroteToday() + 1;
            var p = addPost(new Post { au = ME_AU, mine = 1, pend = 1, wk = k, ok = d.ok, big = d.big, wtk = d.tk, tag = d.tag, title = d.title, body = d.body, up = 0, dn = 0, pnl = todayPnl(), cm = new List<Cm>() });
            S.gNew = Math.Max(0, S.gNew - 1);
            Emit("bubble", "text", fpick(TA("post.bubble")), "ms", 1800.0, "face", "smug");
            return p;
        }
        void settleMine(Post p)
        {
            p.pend = 0;
            double pnl = p.pnl, mul = (0.75 + rnd() * 0.5) * (1 + S.galFame / 100) * (S.galFame >= 35 ? 1.3 : 1);
            double up = 0, dn = Math.Floor(rnd() * 8), fm = 0; string cmk = p.wk;
            if (!p.ok) { up = 2 + Math.Floor(rnd() * 6); dn = 60 + Math.Floor(rnd() * 60); fm = p.wk == "water" ? 0 : -3; cmk = p.wk == "water" ? "water" : "fake"; }
            else if (p.wk == "gain") { if (p.big) { up = Math.Min(420, 45 + pnl / 30000) * mul; cmk = "big"; } else up = Math.Min(60, 8 + pnl / 20000) * mul; }
            else if (p.wk == "loss") up = Math.Min(450, 40 + Math.Abs(pnl) / 20000) * mul;
            else if (p.wk == "gf") up = (10 + (100 - S.stress) * 0.4 + S.hp * 0.2 + (S.props.Count + S.owned.Count - 1) * 8) * mul;
            else if (p.wk == "water") up = (3 + rnd() * 14) * mul;
            else if (p.wk == "kim") up = (40 + rnd() * 50) * mul;
            up = rhu(up);
            if (p.ok)
            {
                double bs = p.wk == "loss" ? Math.Min(9, 3 + up / 50) : p.wk == "gain" ? (p.big ? Math.Min(9, 3 + up / 60) : Math.Min(3, up / 25)) : Math.Min(4, up / 40 + (p.wk == "kim" ? 1 : 0));
                fm = bs > 0 ? Math.Max(1, rhu(bs / (1 + S.galFame / 40))) : 0;
            }
            p.up = up; p.dn = dn; p.best = up >= 50; p.fm = fm;
            var pool = D.MYCM[cmk].ToList(); int kk = 3 + (int)Math.Floor(frnd() * 4); var GN = D.GNKeys;
            for (int i = 0; i < kk && pool.Count > 0; i++)
            {
                string au = frnd() < 0.5 ? ANON : fpick(GN);
                int j = (int)Math.Floor(frnd() * pool.Count); string px = pool[j]; pool.RemoveAt(j);
                string x = replace1(px, "{conv}", conv(pnl != 0 ? pnl : 10000));
                double cu = Math.Floor(frnd() * 40);
                p.cm.Add(new Cm { au = au, x = x, up = cu });
            }
            if (p.wk == "water" && p.ok)
            {
                string au = pick(TA("waterAu")); var t = makeTip(au, "cm", p.wtk);
                string x = T("water.cm", "n", D.TK[t.tk].name, "w", whenLabel(t.Tr), "dw", T(t.dir > 0 ? "dw.up" : "dw.dn"), "rec", srcRec(au));
                p.cm.Add(new Cm { au = au, x = x, up = Math.Floor(frnd() * 20), tipc = 1 });
            }
            if (p.wk == "kim") { if (S.phase != "ending") pushKR("kim", "kim", fpick(D.KIM_DM["sue"])); stress(6); }
            if (fm != 0) fame(fm);
            S.gReact++;
            string tt = p.title.Length > 22 ? p.title.Substring(0, 22) + "…" : p.title;
            string msg = T("mine.msg", "t", tt, "up", up, "b", p.best ? T("mine.best") : "", "f", fm != 0 ? T("mine.fame", "f", (fm > 0 ? "+" : "") + JsFmt.Num(fm)) : "");
            toast(msg, "gal", "gall"); pushF("📝", msg, "gal");
        }
        void upvote(int id) { var p = postById(id); if (p != null && p.myUp == 0) { p.myUp = 1; p.up++; p.best = p.up >= 50; } }

        // ---------- 미래 카톡 질문 ----------
        void kqMaybe()
        {
            if (S.kq != null || mental() == "men" || rnd() >= 0.32) return;
            int i = (int)Math.Floor(rnd() * D.KQ.Count); var q = D.KQ[i];
            var opts = new List<Opt> { new Opt { l = q.ok, ok = true }, new Opt { l = q.no[0] }, new Opt { l = q.no[1] } };
            for (int j = 2; j > 0; j--) { int r = (int)Math.Floor(rnd() * (j + 1)); var tmp = opts[j]; opts[j] = opts[r]; opts[r] = tmp; }
            S.kq = new KQState { i = i, opts = opts, T = Tnow() };
            pushKR("m", "m", q.q);
        }
        void kqExpire()
        {
            if (S.kq != null && Tnow() - S.kq.T >= 2) { S.kq = null; pushKR("m", "m", fpick(TA("kq.ignored"))); stress(3); }
        }
        void kqReply(int i)
        {
            if (S.kq == null) return;
            if (i < 0 || i >= S.kq.opts.Count) throw new SimCommandException("kqReply " + i);
            var o = S.kq.opts[i]; var q = D.KQ[S.kq.i]; S.kq = null;
            pushKR("m", "me", o.l);
            if (o.ok) { pushKR("m", "m", q.good); stress(-6); } else { pushKR("m", "m", q.bad); stress(3); }
        }
        void hyMaybe()
        {
            double r = rnd();
            if (S.galFame >= D.FAME["dm"] && r < 0.3) makeTip(MATH, "dm");
            else if (r < 0.25) makeTip(HY, "dm");
            else if (r < 0.4) pushKR("hy", "hy", fpick(D.HY_TALK));
        }
    }

    public class SimCommandException : Exception { public SimCommandException(string m) : base(m) { } }
}
