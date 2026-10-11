// 요청 한도: Durable Object 하나 = 카운터 하나 (키: "dev:<기기 id>", "ip:<ip>", "global").
// 왜 DO 인가: KV 는 결과적 일관성(같은 키를 동시에 올리면 덮어씀)이고 무료 플랜 쓰기가 하루 1,000번이라 요청마다 올리는 카운터로 못 씀.
// DO 는 키마다 한 인스턴스가 요청을 순서대로 처리해 정확히 센다 (SQLite 백엔드 = 무료 플랜 가능).
import { DurableObject } from "cloudflare:workers";

type Counter = { day: number; dayN: number; min: number; minN: number };
export type Hit = { ok: true } | { ok: false; reason: "minute" | "daily" };

export class Quota extends DurableObject {
  async hit(perMin: number, perDay: number): Promise<Hit> {
    const now = Date.now(), day = Math.floor(now / 86400000), min = Math.floor(now / 60000);
    const c = (await this.ctx.storage.get<Counter>("c")) ?? { day, dayN: 0, min, minN: 0 };
    if (c.day !== day) { c.day = day; c.dayN = 0; }
    if (c.min !== min) { c.min = min; c.minN = 0; }
    if (c.dayN >= perDay) return { ok: false, reason: "daily" };
    if (c.minN >= perMin) return { ok: false, reason: "minute" };
    c.dayN++; c.minN++;
    await this.ctx.storage.put("c", c);
    return { ok: true };
  }
}
