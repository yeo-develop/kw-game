"""피드백 포럼 봇 (Claude API 없음). 대상: #피드백노트, #있으면-좋겠다

launchd가 1분마다 한 번 실행한다. 피드백노트 포럼의 새 글·댓글을 찾아
👀 반응을 달고 ~/.config/kw-game/feedback/queue.jsonl 에 쌓는다.
분류(🕐/✅)는 Claude Code 세션이 queue를 읽고 status.json을 고친 뒤 `sync` 로 반영한다.

사용법:
  python3 fbbot.py          새 글 확인 (launchd가 부르는 기본 동작)
  python3 fbbot.py sync     status.json 기준으로 ✅/🕐 반응 맞추기
  python3 fbbot.py ack      status.json에 분류된 항목을 queue에서 지우기
  python3 fbbot.py dump     전체 스레드를 threads.json으로 저장
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HOME = os.path.expanduser("~/.config/kw-game")
DIR = os.path.join(HOME, "feedback")
TOKEN = open(os.path.join(HOME, "discord_token")).read().strip()
API = "https://discord.com/api/v10"
GUILD = "1558363090855403560"
FORUMS = {"1558363135625134171": "피드백노트", "1558383574934233219": "있으면-좋겠다"}
SEEN = "👀"
STATUS_EMOJI = {"done": "✅", "doing": "🕐"}


def call(method, path):
    for _ in range(5):
        req = urllib.request.Request(API + path, method=method, headers={
            "Authorization": "Bot " + TOKEN,
            "User-Agent": "kwgame-fbbot (local, 1.0)",
            "Content-Length": "0",
        })
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                body = r.read()
                return json.loads(body) if body else None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(float(json.load(e).get("retry_after", 1)) + 0.3)
                continue
            if e.code == 404:  # 글이 지워졌거나 반응이 이미 없음
                return None
            raise
    raise RuntimeError("rate limited: " + path)


def react(ch, mid, emoji, on=True):
    call("PUT" if on else "DELETE", f"/channels/{ch}/messages/{mid}/reactions/{urllib.parse.quote(emoji)}/@me")
    time.sleep(0.35)


def threads():
    out = [t for t in call("GET", f"/guilds/{GUILD}/threads/active")["threads"] if t["parent_id"] in FORUMS]
    for f in FORUMS:
        out += call("GET", f"/channels/{f}/threads/archived/public?limit=100")["threads"]
    return out


def load(name, default):
    p = os.path.join(DIR, name)
    return json.load(open(p)) if os.path.exists(p) else default


def save(name, data):
    p = os.path.join(DIR, name)
    json.dump(data, open(p + ".tmp", "w"), ensure_ascii=False, indent=1)
    os.replace(p + ".tmp", p)


def poll():
    status = load("status.json", {})
    seen = set(load("seen.json", []))
    known = seen | set(status)
    new = []
    for t in threads():
        for m in call("GET", f"/channels/{t['id']}/messages?limit=100")[::-1]:
            key = f"{t['id']}/{m['id']}"
            if key in known or m["author"].get("bot") or not (m["content"] or m.get("attachments")):
                continue
            react(t["id"], m["id"], SEEN)
            new.append({"key": key, "forum": FORUMS[t["parent_id"]], "thread": t["name"], "author": m["author"]["username"], "content": m["content"],
                        "attachments": [a["url"] for a in m.get("attachments", [])], "ts": m["timestamp"]})
            seen.add(key)
    if new:
        with open(os.path.join(DIR, "queue.jsonl"), "a") as f:
            for n in new:
                f.write(json.dumps(n, ensure_ascii=False) + "\n")
        save("seen.json", sorted(seen))
    print(time.strftime("%F %T"), "new", len(new), flush=True)


def sync():
    for key, v in load("status.json", {}).items():
        ch, mid = key.split("/")
        want = STATUS_EMOJI.get(v["status"])
        for e in STATUS_EMOJI.values():
            react(ch, mid, e, e == want)
        if v["status"] != "decide":  # 분류가 끝나면 👀는 뗀다 (note = 질문·대화라 표시 없음)
            react(ch, mid, SEEN, False)
        print(want or "—", v["item"])


def ack():
    """status.json에 분류된 항목만 queue에서 지운다 (통째로 비우면 그사이 들어온 글이 사라짐)."""
    done = set(load("status.json", {}))
    p = os.path.join(DIR, "queue.jsonl")
    if not os.path.exists(p):
        return
    rest = [l for l in open(p) if l.strip() and json.loads(l)["key"] not in done]
    open(p + ".tmp", "w").writelines(rest)
    os.replace(p + ".tmp", p)
    print("queue 남은 항목", len(rest))


def dump():
    out = []
    for t in threads():
        msgs = call("GET", f"/channels/{t['id']}/messages?limit=100")[::-1]
        out.append({"id": t["id"], "forum": FORUMS[t["parent_id"]], "title": t["name"], "msgs": [
            {"id": m["id"], "author": m["author"]["username"], "content": m["content"],
             "reactions": [r["emoji"]["name"] for r in m.get("reactions", [])], "ts": m["timestamp"]} for m in msgs]})
    save("threads.json", out)
    print(len(out), "threads")


if __name__ == "__main__":
    os.makedirs(DIR, exist_ok=True)
    {"sync": sync, "ack": ack, "dump": dump}.get(sys.argv[1] if len(sys.argv) > 1 else "", poll)()
