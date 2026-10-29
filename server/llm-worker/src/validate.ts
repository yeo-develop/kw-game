// 입력 검증 · 출력 스키마 · 출력 후검증 (SDK 없이 Node 에서도 테스트 가능한 순수 함수).
// 출력 글자 수 한도는 게임 sim 의 검증(web/src/sim/news.js LIMITS, C# GameSim.Llm.cs)과 같다 — 여기서 먼저 걸러야 sim 이 버리지 않음.
import * as z from "zod/v4";

export const LIMITS = { headline: 60, body: 300, source: 20, event: 60, line: 80, kakao: 60, title: 40, gallBody: 200, comment: 60 };
export const STRENGTHS = ["weak", "mid", "strong"] as const;
export const MAX_BODY_BYTES = 6000;

// ---------- 입력 (게임이 보내는 JSON) ----------
const short = (n: number) => z.string().max(n);
const int = z.number().int();
const NewsLog = z.object({ slotId: int, tk: short(8), dir: int, h: short(160), fake: z.boolean(), arc: short(24).nullable(), step: int.nullable() });
export const NewsReq = z.object({
  slotId: int.min(0).max(100000), month: int.min(1).max(1000), day: int.min(1).max(10000), slot: int.min(0).max(2),
  dir: z.union([z.literal(1), z.literal(-1)]), fake: z.boolean(), tier: int.min(0).max(2),
  tickers: z.array(z.object({ k: short(8), name: short(20), type: short(10) })).min(1).max(10),
  strengths: z.array(z.enum(STRENGTHS)).min(1).max(3),
  recent: z.array(NewsLog).max(6),
  arcs: z.array(z.object({ id: short(24), tk: short(8), step: int.nullable(), h: short(160), slotId: int })).max(6),
  // v4 (선택): 장 국면 · 부 · 김사장 금고 털기 준비 단계
  ch: int.min(1).max(4).optional(), part: int.min(1).max(9).optional(), kim: int.min(0).max(3).optional(),
});
export type NewsReq = z.infer<typeof NewsReq>;

const num = z.number().finite();
export const LineReq = z.object({
  month: int.min(1).max(1000), day: int.min(1).max(7), slot: int.min(0).max(2),
  debt: num, cash: num, hold: num, todayPnl: num, interest: num, dday: int.min(0).max(7), paid: z.boolean(),
  hp: num, stress: num, addict: num, mood: short(16), relics: z.array(short(20)).max(20),
  recent: z.array(short(120)).max(6),
  // v4 (선택): 장 · 미래 호감 · 털기 준비 단계 · 털기 각오 · 오늘 부탁
  ch: int.min(1).max(4).optional(), aff: num.optional(), kim: int.min(0).max(3).optional(), ready: z.boolean().optional(), prom: short(20).optional(),
});
export type LineReq = z.infer<typeof LineReq>;

export const GallReq = z.object({
  month: int.min(1).max(1000), day: int.min(1).max(7), slot: int.min(0).max(2),
  debt: num, cash: num, todayPnl: num, fame: num,
  topic: short(160), recent: z.array(short(120)).max(6),
});
export type GallReq = z.infer<typeof GallReq>;

// ---------- 출력 스키마 (structured outputs, output_config.format) ----------
// 길이 제한은 스키마에 안 넣고(지원 안 되는 제약) 프롬프트로 요구 + 아래 post 검증으로 거른다.
export const NewsOut = z.object({
  ticker: z.string(), strength: z.enum(STRENGTHS), event: z.string(),
  arcId: z.string(), arcStep: z.number().int(),
  headline: z.string(), body: z.string(), source: z.string(),
});
export const LineOut = z.object({ line: z.string(), kakao: z.string() });
export const GallOut = z.object({ title: z.string(), body: z.string(), comments: z.array(z.object({ au: z.string(), x: z.string() })) });

// ---------- 후검증 ----------
// sim 과 같은 정리 규칙: 제어문자·특수 공백·꺾쇠·중괄호·백틱·역슬래시 → 공백, 공백 연속 → 하나, 앞뒤 공백 제거. 길이 넘으면 거부.
const BAD = /[\u0000-\u001f\u007f-\u009f\u00a0\u2000-\u200f\u2028-\u202f\u205f\u3000\ufeff<>{}`\\]/g;
export function clean(s: unknown, max: number): string | null {
  if (typeof s !== "string") return null;
  const x = s.replace(BAD, " ").replace(/ {2,}/g, " ").replace(/^ +| +$/g, "");
  return x.length && x.length <= max ? x : null;
}
// 콘텐츠 정책 (서버 쪽 마지막 그물): 링크·연락처, 실제 집단 비하 멸칭, 성적 표현, 자해. 걸리면 응답 전체를 버림 → 게임은 내장 문구.
const BANNED: RegExp[] = [
  /https?:|www\.|\.com\b|\.kr\b|@[a-z0-9_]{3,}/i,
  /\d{2,3}-\d{3,4}-\d{4}/,
  /한남충?|김치녀|된장녀|맘충|틀딱|짱깨|쪽바리|흑형|홍어|조선족|급식충|애자|병신|ㅄ|장애인새끼|게이새끼|트젠|페미년/,
  /섹스|야동|자위|성관계|ㅅㅅ하/,
  /자살|자해|목\s*매|투신|죽어\s*버려|뒤져\s*라/,
];
export const policyOk = (...xs: string[]) => !xs.some(x => BANNED.some(re => re.test(x)));

export type NewsFact = { slotId: number; dir: number; ticker: string; strength: string; event: string; arcId?: string; arcStep?: number; headline: string; body: string; source: string };
export function checkNews(req: NewsReq, o: z.infer<typeof NewsOut>): NewsFact | null {
  if (!req.tickers.some(t => t.k === o.ticker)) return null;
  if (!req.strengths.includes(o.strength)) return null;
  const headline = clean(o.headline, LIMITS.headline), body = clean(o.body, LIMITS.body), source = clean(o.source, LIMITS.source), event = clean(o.event, LIMITS.event);
  if (!headline || !body || !source || !event || !policyOk(headline, body, source, event)) return null;
  const f: NewsFact = { slotId: req.slotId, dir: req.dir, ticker: o.ticker, strength: o.strength, event, headline, body, source };
  if (/^[a-z0-9_-]{1,24}$/.test(o.arcId)) { f.arcId = o.arcId; f.arcStep = Number.isInteger(o.arcStep) && o.arcStep >= 1 && o.arcStep <= 5 ? o.arcStep : 1; }
  return f;
}
export function checkLine(o: z.infer<typeof LineOut>) {
  const line = clean(o.line, LIMITS.line), kakao = clean(o.kakao, LIMITS.kakao);
  return line && kakao && policyOk(line, kakao) ? { line, kakao } : null;
}
const AUTHORS = ["수학자", "형나믿지", "농사꾼", "안티", "국밥론자", "존버충", "ㅇㅇ"];
export function checkGall(o: z.infer<typeof GallOut>) {
  const title = clean(o.title, LIMITS.title), body = clean(o.body, LIMITS.gallBody);
  if (!title || !body) return null;
  const comments = o.comments.slice(0, 4).map(c => ({ au: AUTHORS.includes(c.au) ? c.au : "ㅇㅇ", x: clean(c.x, LIMITS.comment) })).filter((c): c is { au: string; x: string } => !!c.x);
  if (!comments.length || !policyOk(title, body, ...comments.map(c => c.x))) return null;
  return { title, body, comments };
}
