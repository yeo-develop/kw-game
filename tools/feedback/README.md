# 피드백노트 봇

디스코드 FX전사 서버의 `#피드백노트`, `#있으면-좋겠다` 포럼을 1분마다 확인한다. Claude API는 쓰지 않는다.

- 새 글·댓글 → 👀 반응 + `~/.config/kw-game/feedback/queue.jsonl`에 쌓음
- Claude Code가 queue를 읽고 `status.json`에 분류(`doing` 🕐 / `done` ✅ / `decide` 반응 없음)를 적은 뒤 `python3 fbbot.py sync`
- 토큰: `~/.config/kw-game/discord_token` (600, 레포에 넣지 않음)
- 상주: `~/Library/LaunchAgents/com.kwgame.fbbot.plist` (로그인 시 자동 시작, 60초 간격)
  - 끄기: `launchctl bootout gui/$(id -u)/com.kwgame.fbbot`
  - 로그: `~/.config/kw-game/feedback/bot.log`
