# kw-game 효과음 일괄 생성 (Audio Studio MCP 함수 직접 호출)
# usage: .venv/bin/python gen_sfx.py <out_dir> [name ...]
import asyncio, json, sys, shutil
from pathlib import Path
from audio_studio_mcp import server as S

SFX = {
    # name: (seconds, source, action, material, space, extra prompt)
    "liquidation": (2.5, "cartoon explosion with shattering glass", "sudden loud boom then glass shards falling and a descending sad trombone slide", "punchy, comedic, crunchy", "close-up, dry", "comedic game sound for losing all your money"),
    "kakao": (1.0, "smartphone messenger notification", "two quick bright pings", "clean digital chime, short", "dry, close-up", "mobile chat app message alert"),
    "kim": (1.5, "ominous phone notification", "single low pluck followed by a short sinister low brass stab", "dark, comedic villain tone", "dry", "loan shark text message alert in a comedy game"),
    "aff_up": (1.5, "magical sparkle chime", "quick rising arpeggio of bells with a soft shimmer tail", "cute, glassy, bright", "light reverb", "romance game affection up sound"),
    "aff_down": (1.5, "cartoon heart breaking", "short crack followed by a sad descending two-note boop", "cute, comedic", "dry", "romance game affection down sound"),
    "unlock": (2.0, "game level up jingle", "bright ascending synth arpeggio ending on a sparkling major chord", "8-bit inspired, shiny, triumphant", "dry", "feature unlocked fanfare"),
    "news": (2.0, "breaking news stinger", "fast urgent synth brass hit with a ticking accent", "dramatic TV news style", "dry", "short breaking news alert"),
    "payday": (2.5, "cash register and coins", "register drawer opens with a ka-ching bell, coins clinking", "metallic, crisp", "close-up, dry", "paying money satisfying sound"),
    "repaid": (3.0, "victory fanfare", "short brass and bells fanfare rising to a joyful hit", "triumphant, comedic", "small hall", "debt repaid celebration jingle"),
    "bad_end": (4.0, "ship horn and seagulls", "a long low ship horn blast with seagulls and ocean waves", "melancholic, comedic", "outdoor harbor, wide", "being sent to a fishing boat"),
    "faint": (2.0, "cartoon dizzy fall", "spinning whistle descending then a soft thud", "comedic, boingy", "dry", "character faints"),
    "work_pay": (1.5, "coins dropping into a pile", "several gold coins clinking in quick succession", "bright metallic", "close-up, dry", "earning wages"),
    "mg_start": (1.5, "game start whistle", "short referee whistle blast with a snappy drum hit", "energetic, arcade", "dry", "minigame start"),
    "morning": (3.0, "morning birds and a gentle alarm", "light birdsong with a soft two-note marimba alarm", "fresh, calm, warm", "outdoor, light reverb", "new day begins"),
    "menhera": (2.0, "rapid phone vibrations and notification pings", "many overlapping message pings in a frantic burst", "chaotic, comedic, digital", "dry", "phone blowing up with messages"),
    "casino_win": (2.5, "slot machine jackpot", "bells ringing with coins pouring out", "bright, flashy, metallic", "casino, light reverb", "small jackpot win"),
}

async def one(name, out):
    sec, src, act, mat, spc, prompt = SFX[name]
    r = await S.generate_audio(prompt=prompt, audio_type="sfx", duration_seconds=sec + 1, variations=2,
                               sound_source=src, sound_action=act, sound_material=mat, sound_space=spc,
                               title=f"kw_{name}", original_idea=name)
    res = []
    for i, c in enumerate(r["candidates"]):
        p = await S.process_audio(input_audio=c["path"], trim_silence=True, silence_threshold_db=-45, mono=True,
                                  normalize="peak", peak_ceiling_db=-3, end_seconds=sec + 0.6, fade_out_ms=120,
                                  format="ogg", sample_rate=44100, title=f"SFX_{name}_v{i+1}")
        dst = out / f"SFX_{name}_v{i+1}.ogg"; shutil.copy(p["path"], dst); res.append(str(dst))
    print(json.dumps({name: res}), flush=True)

async def main():
    out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
    names = sys.argv[2:] or list(SFX)
    for n in names: await one(n, out)

asyncio.run(main())
