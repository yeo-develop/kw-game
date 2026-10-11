// 롱잡고알바감 LLM 워커 — POST /news · /line · /gall (GET /health). docs/LLM.md 참고.
// API 키는 Worker secret ANTHROPIC_API_KEY 로만 (저장소·클라이언트에 없음). 무슨 에러든 {ok:false, error} 를 빨리 돌려주고 게임은 내장 문구로 넘어간다.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type * as z from "zod/v4";
import { SHARED, NEWS_TASK, LINE_TASK, GALL_TASK } from "./prompts";
import { NewsReq, LineReq, GallReq, NewsOut, LineOut, GallOut, MAX_BODY_BYTES, checkNews, checkLine, checkGall } from "./validate";
import type { Quota } from "./quota";
export { Quota } from "./quota";

export interface Env {
  ANTHROPIC_API_KEY?: string;
  QUOTA: DurableObjectNamespace<Quota>;
  MODEL: string;
  PER_MIN_DEVICE: string; PER_DAY_DEVICE: string; PER_MIN_IP: string; PER_DAY_IP: string; PER_DAY_GLOBAL: string;
}

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, GET, OPTIONS", "access-control-allow-headers": "content-type, x-device-id" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json; charset=utf-8", ...CORS } });
const fail = (error: string, status: number, message?: string) => json({ ok: false, error, ...(message ? { message } : {}) }, status);

// 엔드포인트별: 입력 스키마 · 출력 스키마 · 작업 지시 · 후검증 · 타임아웃(ms) · 최대 토큰
const ROUTES = {
  "/news": { req: NewsReq, out: NewsOut, task: NEWS_TASK, check: (r: unknown, o: unknown) => { const f = checkNews(r as z.infer<typeof NewsReq>, o as z.infer<typeof NewsOut>); return f && { fact: f }; }, timeout: 12000, maxTokens: 3000 },
  "/line": { req: LineReq, out: LineOut, task: LINE_TASK, check: (_r: unknown, o: unknown) => checkLine(o as z.infer<typeof LineOut>), timeout: 6000, maxTokens: 1500 },
  "/gall": { req: GallReq, out: GallOut, task: GALL_TASK, check: (_r: unknown, o: unknown) => { const p = checkGall(o as z.infer<typeof GallOut>); return p && { post: p }; }, timeout: 10000, maxTokens: 2500 },
} as const;
type Path = keyof typeof ROUTES;

async function quota(env: Env, req: Request): Promise<string | null> {
  const dev = req.headers.get("x-device-id") ?? "", ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  const keys: [string, number, number][] = [
    ["ip:" + ip, +env.PER_MIN_IP, +env.PER_DAY_IP],
    ["global", 1e9, +env.PER_DAY_GLOBAL],
  ];
  if (/^[A-Za-z0-9_-]{8,64}$/.test(dev)) keys.push(["dev:" + dev, +env.PER_MIN_DEVICE, +env.PER_DAY_DEVICE]);
  const r = await Promise.all(keys.map(([k, m, d]) => env.QUOTA.get(env.QUOTA.idFromName(k)).hit(m, d)));
  const bad = r.find(x => !x.ok);
  return bad && !bad.ok ? bad.reason : null;
}

async function handle(req: Request, env: Env, path: Path): Promise<Response> {
  const R = ROUTES[path];
  const len = +(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) return fail("too_large", 413);
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return fail("too_large", 413);
  let body: unknown;
  try { body = JSON.parse(text); } catch { return fail("bad_json", 400); }
  const parsed = R.req.safeParse(body);
  if (!parsed.success) return fail("bad_request", 400, parsed.error.issues.slice(0, 3).map(i => `${i.path.join(".")}: ${i.message}`).join("; "));
  if (!env.ANTHROPIC_API_KEY) return fail("no_key", 503, "ANTHROPIC_API_KEY secret 이 설정되지 않음 (cd server/llm-worker && npx wrangler secret put ANTHROPIC_API_KEY)");
  const q = await quota(env, req);
  if (q) return fail("rate_limited", 429, q);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: R.timeout });
  try {
    const res = await client.messages.parse({
      model: env.MODEL,
      max_tokens: R.maxTokens,
      // 공용 시스템 프롬프트(고정) 에 캐시 지점 → 엔드포인트별 지시는 그 뒤 (요청마다 바뀌는 건 user 메시지)
      system: [
        { type: "text", text: SHARED, cache_control: { type: "ephemeral" } },
        { type: "text", text: R.task },
      ],
      messages: [{ role: "user", content: JSON.stringify(parsed.data) }],
      // Haiku 5.5: temperature/top_p/top_k 안 보냄(400). 생각은 기본 adaptive — 지연 줄이려고 effort low.
      output_config: { effort: "low", format: zodOutputFormat(R.out as z.ZodType) },
    });
    const u = res.usage;
    console.log(JSON.stringify({ path, stop: res.stop_reason, in: u.input_tokens, out: u.output_tokens, cw: u.cache_creation_input_tokens, cr: u.cache_read_input_tokens }));
    if (res.stop_reason === "refusal") return fail("refusal", 502);
    if (res.stop_reason === "max_tokens") return fail("truncated", 502);
    if (!res.parsed_output) return fail("bad_output", 502);
    const out = R.check(parsed.data, res.parsed_output);
    if (!out) return fail("policy", 502, "출력 검증 실패 (목록 밖 값·길이 초과·금지어)");
    return json({ ok: true, ...out });
  } catch (e) {
    // 구체적인 것부터 (APIConnectionTimeoutError ⊂ APIConnectionError ⊂ APIError)
    if (e instanceof Anthropic.AuthenticationError) return fail("bad_key", 502, "API 키가 유효하지 않음");
    if (e instanceof Anthropic.RateLimitError) return fail("upstream_rate_limited", 503);
    if (e instanceof Anthropic.APIConnectionTimeoutError) return fail("timeout", 504);
    if (e instanceof Anthropic.APIConnectionError) return fail("network", 502);
    if (e instanceof Anthropic.APIError) { console.log(JSON.stringify({ path, status: e.status, type: e.type })); return fail("upstream", 502, `status ${e.status ?? "?"}`); }
    console.log(JSON.stringify({ path, err: String(e).slice(0, 200) }));
    return fail("bad_output", 502);
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (req.method === "GET" && url.pathname === "/health") return json({ ok: true, hasKey: !!env.ANTHROPIC_API_KEY, model: env.MODEL });
    if (req.method !== "POST" || !(url.pathname in ROUTES)) return fail("not_found", 404);
    try { return await handle(req, env, url.pathname as Path); }
    catch (e) { console.log(JSON.stringify({ err: String(e).slice(0, 200) })); return fail("internal", 500); }
  },
} satisfies ExportedHandler<Env>;
