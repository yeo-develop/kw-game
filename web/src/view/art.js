/* ================= view/art.js — 그림: 미래·김사장·NPC SVG, 배경 SVG (v3.2 그대로) ================= */
/* ================= 그림: 미래 SVG ================= */
function eye(cx, cy, type, look = 0) {
  const ir = "#4f8fe6";
  if (type === "closed") return `<path d="M${cx - 17} ${cy + 3} Q${cx} ${cy - 13} ${cx + 17} ${cy + 3}" stroke="#2b2230" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  if (type === "half") return `<path d="M${cx - 17} ${cy - 2} L${cx + 17} ${cy - 2}" stroke="#2b2230" stroke-width="5" stroke-linecap="round"/>
    <path d="M${cx - 14} ${cy} Q${cx} ${cy + 13} ${cx + 14} ${cy}Z" fill="${ir}"/><circle cx="${cx + look}" cy="${cy + 5}" r="3.5" fill="#15233f"/>`;
  if (type === "down") return `<path d="M${cx - 16} ${cy + 2} Q${cx} ${cy + 10} ${cx + 16} ${cy + 2}" stroke="#2b2230" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  if (type === "dot") return `<ellipse cx="${cx}" cy="${cy}" rx="16" ry="20" fill="#fff"/><circle cx="${cx}" cy="${cy + 1}" r="11" fill="none" stroke="#ff5fa2" stroke-width="2.5"/>
    <circle cx="${cx}" cy="${cy + 1}" r="3.2" fill="#15233f"/><path d="M${cx - 18} ${cy - 16} Q${cx} ${cy - 28} ${cx + 18} ${cy - 16}" stroke="#2b2230" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
  const big = type === "wide", rx = big ? 15 : 14, ry = big ? 19 : 17, pr = big ? 5 : 7.5;
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff"/>
    <ellipse cx="${cx + look}" cy="${cy + 2}" rx="${rx - 3}" ry="${ry - 3}" fill="${ir}"/>
    <circle cx="${cx + look}" cy="${cy + 3}" r="${pr}" fill="#15233f"/><circle cx="${cx + look - 4}" cy="${cy - 4}" r="3.6" fill="#fff"/>
    <path d="M${cx - rx - 2} ${cy - ry + 4} Q${cx} ${cy - ry - 6} ${cx + rx + 2} ${cy - ry + 4}" stroke="#2b2230" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
}
const FACES = DATA.FACES;
function mouth(t) {
  switch (t) {
    case "open": return `<path d="M183 292 Q200 316 217 292Z" fill="#7a2b3a"/><path d="M186 293 L214 293" stroke="#7a2b3a" stroke-width="3"/>`;
    case "wave": return `<path d="M184 298 q6 -6 11 0 t11 0 t10 0" stroke="#7a2b3a" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    case "o": return `<ellipse cx="200" cy="300" rx="8" ry="10" fill="#7a2b3a"/>`;
    case "frown": return `<path d="M186 302 Q200 290 214 302" stroke="#7a2b3a" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
    case "smirk": return `<path d="M186 296 Q204 306 216 290" stroke="#7a2b3a" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
    case "flat": return `<path d="M189 298 L211 298" stroke="#7a2b3a" stroke-width="4.5" stroke-linecap="round"/>`;
    default: return `<path d="M188 295 Q200 304 212 295" stroke="#7a2b3a" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
  }
}
function brows(t) {
  const L = { flat: "M146 196 L180 198", up: "M146 194 Q163 186 180 194", worry: "M146 200 Q165 196 180 188", high: "M146 186 Q163 176 180 184", angry: "M146 186 L182 202" }[t];
  const R = { flat: "M220 198 L254 196", up: "M220 194 Q237 186 254 194", worry: "M220 188 Q235 196 254 200", high: "M220 184 Q237 176 254 186", angry: "M218 202 L254 186" }[t];
  return `<path d="${L}" stroke="#6e737c" stroke-width="5" fill="none" stroke-linecap="round"/><path d="${R}" stroke="#6e737c" stroke-width="5" fill="none" stroke-linecap="round"/>`;
}
const BODY = "M74 600 C74 476 118 402 200 396 C282 402 326 476 326 600Z";
function outfitSVG(o) {
  switch (o) {
    case "track": return `<path d="${BODY}" fill="#1f7a4a"/><path d="M98 600 C100 520 118 468 146 428 M302 600 C300 520 282 468 254 428" stroke="#fff" stroke-width="9" fill="none"/>
      <path d="M112 600 C114 524 130 474 156 434 M288 600 C286 524 270 474 244 434" stroke="#fff" stroke-width="5" fill="none"/>
      <path d="M200 404 L200 600" stroke="#dfe6e2" stroke-width="5"/><path d="M160 404 L200 430 L240 404 L240 392 L160 392Z" fill="#196640"/>`;
    case "dino": return `<path d="${BODY}" fill="#66b85a"/><ellipse cx="200" cy="540" rx="80" ry="90" fill="#d4ecac"/>
      <path d="M120 430 l12 -26 l14 24 M268 430 l12 -26 l14 24" fill="#4e9a45" stroke="#4e9a45" stroke-width="4"/>
      <circle cx="170" cy="520" r="6" fill="#4e9a45"/><circle cx="230" cy="560" r="6" fill="#4e9a45"/>`;
    case "suit": return `<path d="${BODY}" fill="#1d2a4a"/><path d="M158 398 L200 486 L242 398Z" fill="#f4f6fb"/>
      <path d="M193 408 L207 408 L213 494 L200 516 L187 494Z" fill="#d6283b"/><path d="M158 398 L186 470 L150 470Z M242 398 L214 470 L250 470Z" fill="#14203b"/>
      <rect x="248" y="500" width="34" height="8" fill="#ffd166"/>`;
    case "padding": return `<path d="${BODY}" fill="#d9a520"/>${[446, 486, 526, 566].map(y => `<path d="M84 ${y} Q200 ${y + 16} 316 ${y}" stroke="#a87c0a" stroke-width="5" fill="none"/>`).join("")}
      <path d="M140 404 Q200 432 260 404 L262 386 Q200 412 138 386Z" fill="#f2e9d0"/><rect x="214" y="470" width="62" height="28" rx="6" fill="#111"/>
      <text x="245" y="491" font-size="18" font-weight="900" text-anchor="middle" fill="#ffd166" font-family="sans-serif">FLEX</text>`;
    default: return `<path d="${BODY}" fill="#23252c"/><path d="M128 408 C150 446 250 446 272 408 C254 390 146 390 128 408Z" fill="#33363f"/>
      <path d="M176 430 L170 506 M224 430 L230 506" stroke="#cfd3da" stroke-width="4" stroke-linecap="round"/><circle cx="170" cy="510" r="5" fill="#cfd3da"/><circle cx="230" cy="510" r="5" fill="#cfd3da"/>`;
  }
}
function miraeSVG(face = "neutral", outfit = "hoodie", crop = false) {
  const f = FACES[face] || FACES.neutral;
  const hair = "#a9afb8", hairD = "#80868f", skin = "#f4dccb";
  const vb = crop ? "105 95 190 190" : "0 0 400 600";
  return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <path d="M92 175 C80 92 150 40 205 42 C272 44 332 98 318 182 C334 262 342 368 330 446 L284 446 C292 370 288 300 282 262 L126 262 C118 312 116 372 122 446 L70 446 C60 352 70 252 92 175Z" fill="${hairD}"/>
  ${outfitSVG(outfit)}
  <rect x="180" y="328" width="40" height="70" fill="${skin}"/><path d="M180 376 Q200 392 220 376 L220 396 L180 396Z" fill="#e3c4b0"/>
  <path d="M120 205 C118 122 282 122 280 205 C280 292 240 346 200 350 C160 346 120 292 120 205Z" fill="${skin}"/>
  ${f.bags ? `<path d="M150 252 Q165 260 180 252 M220 252 Q235 260 250 252" stroke="#c9a7a0" stroke-width="3" fill="none"/>` : ""}
  ${f.blush ? `<ellipse cx="150" cy="268" rx="17" ry="8" fill="#ff8fa3" opacity="${f.blush > 1 ? .7 : .45}"/><ellipse cx="250" cy="268" rx="17" ry="8" fill="#ff8fa3" opacity="${f.blush > 1 ? .7 : .45}"/>` : ""}
  ${eye(163, 236, f.e, f.look || 0)}${eye(237, 236, f.e, f.look || 0)}
  <circle cx="252" cy="262" r="2.6" fill="#6b4a3a"/>
  ${brows(f.b)}${mouth(f.m)}
  ${f.tooth ? `<path d="M206 294 L210 302 L213 294Z" fill="#fff"/>` : ""}
  ${f.sweat ? `<path d="M276 196 q8 14 0 20 q-8 -6 0 -20Z" fill="#9fd0ff"/>` : ""}
  ${f.tears ? `<path d="M156 246 q-6 40 -2 70 M244 246 q6 40 2 70" stroke="#7cc6fe" stroke-width="9" fill="none" stroke-linecap="round" opacity=".9"/>` : ""}
  ${f.vein ? `<path d="M262 170 l10 -4 l-4 10 l10 -4 M262 170 l-2 12" stroke="#e0283b" stroke-width="4" fill="none"/>` : ""}
  ${f.shades ? `<rect x="136" y="218" width="54" height="34" rx="12" fill="#0b0b0f"/><rect x="210" y="218" width="54" height="34" rx="12" fill="#0b0b0f"/><path d="M190 228 L210 228" stroke="#0b0b0f" stroke-width="6"/><path d="M146 226 L164 226" stroke="#fff" stroke-width="3" opacity=".6"/>` : ""}
  <path d="M106 214 C98 122 160 76 205 78 C262 78 308 122 296 218 C284 186 272 164 256 152 C252 176 238 188 226 192 C229 172 224 152 216 142 C202 172 182 186 160 192 C166 172 166 160 160 150 C140 170 128 192 106 214Z" fill="${hair}"/>
  <path d="M118 200 C102 262 108 326 124 366 C136 326 134 262 132 214Z M282 200 C298 262 292 326 276 366 C264 326 266 262 268 214Z" fill="${hair}"/>
  <path d="M206 80 C198 46 226 30 244 42 C224 42 212 58 216 80" fill="none" stroke="${hair}" stroke-width="7" stroke-linecap="round"/>
  ${outfit === "dino" ? `<path d="M120 150 C150 70 250 70 280 150 C250 112 150 112 120 150Z" fill="#66b85a"/><path d="M150 96 l14 -30 l14 26 l14 -32 l14 30 l14 -26 l14 32" fill="#4e9a45"/>` : ""}
  ${crop ? "" : `<g transform="rotate(-12 262 500)"><rect x="236" y="446" width="54" height="94" rx="10" fill="#15171d" stroke="#3a3e48" stroke-width="3"/>
  <rect x="242" y="456" width="42" height="70" rx="4" fill="#2d3a5a"/><path d="M246 510 l8 -10 l8 6 l8 -18 l8 8" stroke="#ff4d5e" stroke-width="3" fill="none"/></g>
  <ellipse cx="258" cy="528" rx="30" ry="22" fill="${skin}"/>`}
</svg>`;
}
function kimSVG(face = "smile") {
  const skin = "#e9c3a0";
  return `<svg viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg">
  <path d="M40 600 C40 450 110 380 200 376 C290 380 360 450 360 600Z" fill="#141418"/>
  <path d="M168 380 L200 470 L232 380Z" fill="#7a1d2a"/><path d="M150 384 L200 520 L120 600 L60 600Z M250 384 L200 520 L280 600 L340 600Z" fill="#0b0b0e"/>
  <path d="M146 410 Q200 470 254 410" stroke="#ffd166" stroke-width="10" fill="none" stroke-dasharray="14 6"/>
  <rect x="172" y="320" width="56" height="64" fill="${skin}"/>
  <ellipse cx="200" cy="230" rx="104" ry="118" fill="${skin}"/>
  <ellipse cx="166" cy="140" rx="36" ry="16" fill="#fff" opacity=".45"/>
  <rect x="112" y="196" width="76" height="46" rx="14" fill="#0b0b0f"/><rect x="212" y="196" width="76" height="46" rx="14" fill="#0b0b0f"/><path d="M188 212 L212 212" stroke="#0b0b0f" stroke-width="7"/>
  <path d="M126 206 L150 206" stroke="#fff" stroke-width="4" opacity=".5"/>
  <path d="M150 286 Q200 ${face === "angry" ? 270 : 322} 250 286" stroke="#5a2a20" stroke-width="8" fill="${face === "angry" ? "none" : "#5a2a20"}" stroke-linecap="round"/>
  ${face === "angry" ? "" : `<rect x="214" y="290" width="16" height="14" fill="#ffd166"/>`}
  <path d="M96 236 Q86 260 100 274 M304 236 Q314 260 300 274" stroke="${skin}" stroke-width="20" stroke-linecap="round"/>
  <path d="M232 300 L300 286" stroke="#c9a76a" stroke-width="5" stroke-linecap="round"/>
</svg>`;
}
/* ================= 그림: 장소 NPC (단순·병맛) ================= */
/* NPCS = DATA.NPCS (base.js) */
function npcSVG(kind, mood = "smile") {
  const c = NPCS[kind] || NPCS.broker, sk = "#f1d2bc", A = new Set(c.acc), hc = c.hair;
  const hair = {
    slick: `<path d="M104 214 C96 120 160 96 204 96 C256 96 310 124 298 214 C290 170 262 146 230 140 C210 150 170 150 140 146 C120 160 108 186 104 214Z" fill="${hc}"/><path d="M150 120 Q210 100 270 130" stroke="#fff" stroke-width="5" opacity=".25" fill="none"/>`,
    bald: `<path d="M100 250 C94 200 104 182 116 190 L118 262Z M300 250 C306 200 296 182 284 190 L282 262Z" fill="${hc}"/><ellipse cx="170" cy="140" rx="30" ry="12" fill="#fff" opacity=".5"/>`,
    perm: [[120, 160], [150, 120], [195, 106], [240, 118], [278, 156], [110, 205], [292, 205], [104, 250], [298, 250]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="34" fill="${hc}"/>`).join(""),
    messy: `<path d="M100 220 L110 150 L90 140 L130 120 L120 90 L165 105 L180 70 L210 100 L240 72 L250 108 L292 96 L282 130 L312 144 L296 170 L300 220 C280 170 240 150 200 150 C160 150 120 170 100 220Z" fill="${hc}"/>`,
    bun: `<circle cx="200" cy="92" r="38" fill="${hc}"/><path d="M100 230 C96 130 160 112 200 112 C240 112 304 130 300 230 C290 180 260 156 200 156 C140 156 110 180 100 230Z" fill="${hc}"/>`,
    beret: `<path d="M110 200 C110 160 150 150 200 150 C250 150 290 160 290 200Z" fill="${hc}"/><ellipse cx="186" cy="132" rx="112" ry="40" fill="#c8303f"/><circle cx="186" cy="92" r="8" fill="#c8303f"/>`,
    buzz: `<path d="M104 196 C104 118 296 118 296 196 C276 152 124 152 104 196Z" fill="${hc}" opacity=".9"/>`,
  }[c.hs] || "";
  const sl = c.eyes === "sleepy";
  const eyes = sl ? `<path d="M142 236 L182 236 M218 236 L258 236" stroke="#222" stroke-width="7" stroke-linecap="round"/><path d="M146 246 q16 8 32 0 M222 246 q16 8 32 0" stroke="#b9a0a0" stroke-width="3" fill="none"/>`
    : `<ellipse cx="162" cy="236" rx="11" ry="${mood === "shock" ? 16 : 12}" fill="#222"/><ellipse cx="238" cy="236" rx="11" ry="${mood === "shock" ? 16 : 12}" fill="#222"/><circle cx="166" cy="231" r="4" fill="#fff"/><circle cx="242" cy="231" r="4" fill="#fff"/>`;
  const bw = c.brow === "angry" ? `<path d="M138 206 L184 220 M262 206 L216 220" stroke="#333" stroke-width="8" stroke-linecap="round"/>` : `<path d="M140 210 Q162 198 184 210 M216 210 Q238 198 260 210" stroke="#333" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  const mo = mood === "shock" ? `<ellipse cx="200" cy="300" rx="16" ry="20" fill="#5a2a20"/>` : mood === "sad" ? `<path d="M170 306 Q200 286 230 306" stroke="#5a2a20" stroke-width="7" fill="none" stroke-linecap="round"/>`
    : `<path d="M162 286 Q200 330 238 286Z" fill="#5a2a20"/><path d="M170 290 L230 290" stroke="#fff" stroke-width="6"/>`;
  const acc = [
    A.has("vest") ? `<path d="M120 420 L200 600 L280 420 L320 600 L80 600Z" fill="#111" opacity=".85"/>` : "",
    A.has("apron") ? `<path d="M140 430 L260 430 L280 600 L120 600Z" fill="#fff4e0"/><text x="200" y="520" font-size="30" font-weight="900" text-anchor="middle" fill="#c8303f" font-family="sans-serif">1등 배출점</text>` : "",
    A.has("tie") ? `<path d="M168 380 L200 420 L232 380Z" fill="#f4f6fb"/><path d="M192 400 L208 400 L214 500 L200 522 L186 500Z" fill="#d6283b"/>` : "",
    A.has("bow") ? `<path d="M170 392 L200 404 L230 392 L230 420 L200 408 L170 420Z" fill="#ffd166"/>` : "",
    A.has("scarf") ? `<path d="M150 384 Q200 420 250 384 L262 410 Q200 450 138 410Z" fill="#ffd166"/><path d="M220 420 L250 480 L230 486 L210 430Z" fill="#ffd166"/>` : "",
    A.has("tag") ? `<rect x="236" y="450" width="86" height="40" rx="6" fill="#fff"/><text x="279" y="477" font-size="17" font-weight="900" text-anchor="middle" fill="#1d2a4a" font-family="sans-serif">${esc(c.tag || "")}</text>` : "",
    A.has("tape") ? `<path d="M120 390 Q200 470 280 390" stroke="#ffd166" stroke-width="12" fill="none" stroke-dasharray="6 6"/>` : "",
    A.has("clip") ? `<rect x="250" y="440" width="80" height="110" rx="8" fill="#c69a5c"/><rect x="262" y="456" width="56" height="80" fill="#fff"/><path d="M270 476 h40 M270 496 h40 M270 516 h30" stroke="#999" stroke-width="4"/>` : "",
    A.has("paper") ? `<rect x="40" y="440" width="120" height="150" rx="6" fill="#efe9d8" transform="rotate(-10 100 515)"/><text x="100" y="500" font-size="22" font-weight="900" text-anchor="middle" fill="#333" font-family="sans-serif" transform="rotate(-10 100 515)">경마 예상</text>` : "",
  ].join("");
  const head = [
    A.has("glasses") ? `<circle cx="162" cy="236" r="28" fill="none" stroke="#111" stroke-width="6"/><circle cx="238" cy="236" r="28" fill="none" stroke="#111" stroke-width="6"/><path d="M190 236 L210 236" stroke="#111" stroke-width="6"/>` : "",
    A.has("stache") ? `<path d="M150 276 Q175 258 200 274 Q225 258 250 276 Q225 284 200 280 Q175 284 150 276Z" fill="#2a1f1a"/>` : "",
    A.has("visor") ? `<path d="M96 170 Q200 120 304 170 L300 186 Q200 150 100 186Z" fill="#1f8a4c" opacity=".9"/>` : "",
    A.has("cap") ? `<path d="M100 186 C100 110 300 110 300 186Z" fill="#c8303f"/><path d="M280 180 L360 196 L290 200Z" fill="#a51f2e"/><text x="200" y="168" font-size="26" font-weight="900" text-anchor="middle" fill="#fff" font-family="sans-serif">必勝</text>` : "",
    A.has("pen") ? `<path d="M290 190 L330 150" stroke="#d6283b" stroke-width="9" stroke-linecap="round"/>` : "",
    A.has("headset") ? `<path d="M96 240 C90 120 310 120 304 240" stroke="#111" stroke-width="16" fill="none"/><rect x="80" y="220" width="34" height="60" rx="12" fill="#111"/><rect x="286" y="220" width="34" height="60" rx="12" fill="#111"/><path d="M98 270 Q120 320 170 310" stroke="#111" stroke-width="6" fill="none"/>` : "",
    A.has("sweat") ? `<path d="M300 200 q10 18 0 26 q-10 -8 0 -26Z" fill="#9fd0ff"/>` : "",
  ].join("");
  return `<svg viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg">
  <path d="M40 600 C40 450 110 380 200 376 C290 380 360 450 360 600Z" fill="${c.body}"/>${acc}
  <rect x="174" y="322" width="52" height="62" fill="${sk}"/>
  <ellipse cx="200" cy="232" rx="100" ry="112" fill="${sk}"/>
  <ellipse cx="146" cy="276" rx="16" ry="8" fill="#ff9aa6" opacity=".45"/><ellipse cx="254" cy="276" rx="16" ry="8" fill="#ff9aa6" opacity=".45"/>
  ${hair}${eyes}${bw}${mo}${head}
</svg>`;
}

/* ================= 배경 ================= */
function bgSVG(name, opt = {}) {
  const W = 1440, H = 1080;
  /* v3.2: 장면이 1920 전체 폭 → 1440 좌표 그대로 가운데 두고, 전체 폭 사각형은 양옆으로 늘림 */
  const wrap = inner => `<svg viewBox="-240 0 1920 1080" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${inner.replace(/<rect([^>]*?)\swidth="1440"/g, (m, a) => `<rect${a.replace(/\sx="0"/, "")} x="-240" width="1920"`)}</svg>`;
  const T = (x, y, s, t, c, a = "middle", w = 900) => `<text x="${x}" y="${y}" font-size="${s}" font-weight="${w}" text-anchor="${a}" fill="${c}" font-family="sans-serif">${t}</text>`;
  switch (name) {
    case "room": {
      const n = !!opt.night, P = opt.props || {};
      return wrap(`<rect width="${W}" height="${H}" fill="${n ? "#1d1a2c" : "#3a3346"}"/>
      <rect x="250" y="190" width="300" height="260" fill="${n ? "#0b1430" : "#8ec5ef"}"/>${n ? `<circle cx="490" cy="250" r="30" fill="#eef" opacity=".85"/>` : `<circle cx="300" cy="240" r="34" fill="#fff4b0"/>`}
      <rect x="240" y="180" width="320" height="280" fill="none" stroke="${n ? "#2c2842" : "#5a5168"}" stroke-width="16"/><line x1="400" y1="180" x2="400" y2="460" stroke="${n ? "#2c2842" : "#5a5168"}" stroke-width="10"/>
      <rect x="640" y="210" width="190" height="250" fill="#f2efe6" transform="rotate(-3 735 335)"/>
      <text x="735" y="300" font-size="40" font-weight="900" text-anchor="middle" fill="#d6283b" font-family="sans-serif" transform="rotate(-3 735 335)">손절은</text>
      <text x="735" y="356" font-size="40" font-weight="900" text-anchor="middle" fill="#d6283b" font-family="sans-serif" transform="rotate(-3 735 335)">과학</text>
      <text x="735" y="420" font-size="20" text-anchor="middle" fill="#555" font-family="sans-serif" transform="rotate(-3 735 335)">(안 지킴)</text>
      <rect x="0" y="780" width="${W}" height="300" fill="${n ? "#141220" : "#5b4a3e"}"/><rect x="0" y="780" width="${W}" height="8" fill="${n ? "#2a2540" : "#6d5a4b"}"/>
      <rect x="40" y="690" width="420" height="120" rx="14" fill="${n ? "#2e2a44" : "#d9d3e6"}"/><rect x="40" y="660" width="120" height="60" rx="12" fill="${n ? "#3a3555" : "#fff"}"/>
      <rect x="1180" y="840" width="150" height="90" rx="8" fill="#c96a3a"/><text x="1255" y="895" font-size="22" text-anchor="middle" fill="#fff" font-family="sans-serif">컵라면 박스</text>
      ${P.neon ? `<text x="760" y="160" font-size="80" font-weight="900" text-anchor="middle" fill="none" stroke="#ff5fa2" stroke-width="5" font-family="sans-serif" style="filter:drop-shadow(0 0 12px #ff5fa2)">LONG ♥</text>` : ""}
      ${P.monitor ? `<rect x="560" y="520" width="200" height="130" rx="8" fill="#0d0f16" stroke="#444" stroke-width="6"/><rect x="770" y="520" width="200" height="130" rx="8" fill="#0d0f16" stroke="#444" stroke-width="6"/>
        <path d="M575 630 l30 -30 l25 15 l35 -60 l30 25 l35 -30" stroke="#ff4d5e" stroke-width="5" fill="none"/><path d="M785 560 l40 30 l30 -10 l40 50 l40 -20" stroke="#4e8cff" stroke-width="5" fill="none"/>
        <rect x="560" y="650" width="410" height="20" fill="#3b3346"/><rect x="745" y="670" width="40" height="110" fill="#3b3346"/>` : `<rect x="600" y="650" width="330" height="20" fill="#5a4a3a"/><rect x="750" y="670" width="30" height="110" fill="#5a4a3a"/><rect x="700" y="600" width="120" height="50" rx="4" fill="#2a2e3a"/>`}
      ${P.chair ? `<path d="M840 600 L900 600 L910 780 L830 780Z" fill="#c8303f"/><rect x="840" y="620" width="60" height="18" fill="#111"/><rect x="815" y="760" width="110" height="26" rx="10" fill="#111"/>` : ""}
      ${P.lamp ? `<circle cx="140" cy="560" r="230" fill="#ff8fb1" opacity="${n ? .22 : .1}"/><rect x="125" y="600" width="30" height="90" fill="#ddd"/><ellipse cx="140" cy="590" rx="60" ry="34" fill="#ffc0d6"/>` : ""}
      ${P.bull ? `<g transform="translate(1000 820)"><rect x="0" y="40" width="190" height="60" rx="28" fill="#d9a520"/><circle cx="200" cy="50" r="30" fill="#d9a520"/><path d="M190 26 q20 -30 40 -10 M210 26 q30 -36 50 -6" stroke="#d9a520" stroke-width="10" fill="none"/>
        <rect x="16" y="90" width="18" height="50" fill="#b8860b"/><rect x="150" y="90" width="18" height="50" fill="#b8860b"/><rect x="-20" y="140" width="250" height="20" fill="#333"/><text x="105" y="76" font-size="22" font-weight="900" text-anchor="middle" fill="#7a5a00" font-family="sans-serif">BULL</text></g>` : ""}
      ${n ? `<rect width="${W}" height="${H}" fill="#05060f" opacity=".25"/>` : ""}`);
    }
    case "map": {
      const road = (x1, y1, x2, y2) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#4a4f5e" stroke-width="46" stroke-linecap="round"/><path d="M${x1} ${y1} L${x2} ${y2}" stroke="#e8e2c8" stroke-width="4" stroke-dasharray="22 18"/>`;
      const P = [[300, 330], [720, 300], [1140, 330], [230, 540], [1210, 540], [300, 750], [720, 780], [1140, 750]];
      return wrap(`<rect width="${W}" height="${H}" fill="#2f5d3a"/>
        ${Array.from({ length: 56 }, (_, k) => `<circle cx="${(k * 173) % 1920 - 240}" cy="${200 + (k * 97) % 700}" r="${10 + k % 3 * 6}" fill="#3f7a4c" opacity=".7"/>`).join("")}
        <path d="M-240 980 Q360 900 720 960 T1680 930 L1680 1080 L-240 1080Z" fill="#2a5d8a"/>${T(1240, 1030, 26, "한강 (라면은 여기서)", "#cfe6ff")}
        ${P.map(([x, y]) => road(720, 540, x, y)).join("")}
        <circle cx="720" cy="540" r="70" fill="#4a4f5e"/>
        ${T(720, 210, 28, "🗺️ 빚쟁이동 생활권 지도", "#e8f5e9")}`);
    }
    case "broker": return wrap(`<rect width="${W}" height="${H}" fill="#14202e"/>
      <rect x="60" y="200" width="1320" height="240" rx="18" fill="#05080d" stroke="#2f4a6a" stroke-width="8"/>
      ${["갓성전자 ▲0.8", "킹배터리 ▼2.1", "국밥홀딩스 ▲0.1", "곱버스 ▼1.6", "빚트코인 ▲3.3", "떡상코인 ▼7.7"].map((s, i) => T(120 + (i % 3) * 420, 300 + Math.floor(i / 3) * 90, 40, s, s.includes("▲") ? "#ff4d5e" : "#4e8cff", "start"))}
      <rect x="0" y="760" width="${W}" height="320" fill="#1f2c3c"/><rect x="0" y="740" width="${W}" height="40" fill="#2f4a6a"/>
      ${T(1150, 560, 44, "개미증권 · 빚쟁이동 지점", "#cfe2ff")}${T(1150, 610, 22, "“투자 손실은 고객 책임입니다 (수수료는 저희 책임)”", "#8fb0d8", "middle", 400)}`);
    case "casino": return wrap(`<defs><radialGradient id="cg" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#4a1236"/><stop offset="1" stop-color="#12060f"/></radialGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#cg)"/>
      ${Array.from({ length: 34 }, (_, k) => `<circle cx="${(k * 97) % 1920 - 240}" cy="${40 + (k * 37) % 90}" r="7" fill="${["#ffd166", "#ff5fa2", "#7ee0a8"][k % 3]}" opacity=".9"/>`).join("")}
      <text x="720" y="330" font-size="92" font-weight="900" text-anchor="middle" fill="none" stroke="#ffd166" stroke-width="4" font-family="sans-serif" style="filter:drop-shadow(0 0 14px #ffd166)">사장님이 미쳤어요</text>
      ${T(720, 390, 34, "(사장님 = 김사장 · 이 하우스도 김사장 꺼)", "#ff8fb1", "middle", 400)}
      <ellipse cx="720" cy="980" rx="900" ry="260" fill="#0f5a3a"/><ellipse cx="720" cy="980" rx="880" ry="240" fill="none" stroke="#c9a76a" stroke-width="14"/>`);
    case "race": return wrap(`<rect width="${W}" height="${H}" fill="#7cc0e8"/><circle cx="1200" cy="160" r="60" fill="#fff4b0"/>
      <rect x="0" y="330" width="${W}" height="120" fill="#c9cfd6"/>${Array.from({ length: 40 }, (_, k) => `<circle cx="${-220 + k * 48}" cy="${360 + (k % 3) * 22}" r="14" fill="${["#ff8fa3", "#ffd166", "#7cc6fe", "#7ee0a8"][k % 4]}"/>`).join("")}
      <rect x="0" y="450" width="${W}" height="630" fill="#3f8a3a"/><path d="M-240 580 Q720 500 1680 580 L1680 880 Q720 800 -240 880Z" fill="#b98a55"/>
      <path d="M-240 620 Q720 540 1680 620" stroke="#fff" stroke-width="6" fill="none" stroke-dasharray="30 20"/>
      ${T(720, 300, 56, "빚쟁이 경마공원", "#1d2a4a")}${T(720, 520, 26, "※ 말은 아무 잘못이 없습니다", "#fff", "middle", 400)}`);
    case "lotto": return wrap(`<rect width="${W}" height="${H}" fill="#3a1d2a"/><rect x="0" y="0" width="${W}" height="380" fill="#ffd166"/>
      ${T(720, 200, 110, "★ 1등 배출점 ★", "#c8303f")}${T(720, 300, 34, "(옆 가게 얘기임)", "#7a1d2a", "middle", 400)}
      ${Array.from({ length: 10 }, (_, k) => `<circle cx="${120 + k * 135}" cy="470" r="44" fill="${["#ffd166", "#4e8cff", "#ff4d5e", "#7ee0a8", "#b98cff"][k % 5]}"/>${T(120 + k * 135, 484, 38, (k * 7 + 3) % 20 + 1, "#111")}`).join("")}
      <rect x="0" y="760" width="${W}" height="320" fill="#5a2e3e"/>`);
    case "pc": return wrap(`<rect width="${W}" height="${H}" fill="#0b0d1a"/>
      ${Array.from({ length: 6 }, (_, k) => `<rect x="${40 + k * 235}" y="420" width="200" height="140" rx="8" fill="#111" stroke="#2a2f55" stroke-width="6"/><rect x="${50 + k * 235}" y="430" width="180" height="120" fill="${["#1d3b8a", "#7a1d6a", "#1d6a4a"][k % 3]}"/>`).join("")}
      <rect x="0" y="560" width="${W}" height="40" fill="#22264a"/><rect x="0" y="760" width="${W}" height="320" fill="#151832"/>
      <text x="720" y="250" font-size="96" font-weight="900" text-anchor="middle" fill="none" stroke="#7ee0ff" stroke-width="4" font-family="sans-serif" style="filter:drop-shadow(0 0 14px #7ee0ff)">PC방 빚나라</text>
      ${T(720, 320, 30, "시간당 1,500원 · 라면 끓여 드림 · 롤 연패 시 위로 불가", "#9ab0ff", "middle", 400)}`);
    case "bank": return wrap(`<rect width="${W}" height="${H}" fill="#e9eef3"/><rect x="0" y="0" width="${W}" height="140" fill="#2e5e8c"/>
      ${T(720, 95, 54, "빚쟁이동 상호저축은행 (김사장 캐피탈 제휴)", "#fff")}
      ${[0, 1, 2, 3].map(k => `<rect x="${120 + k * 320}" y="460" width="260" height="300" fill="#c9d4e0"/><rect x="${120 + k * 320}" y="380" width="260" height="80" fill="#fff" stroke="#9ab" stroke-width="4"/>${T(250 + k * 320, 432, 30, ["예금(없음)", "대출(많음)", "상환", "이자"][k], "#2e5e8c")}`).join("")}
      <rect x="0" y="760" width="${W}" height="320" fill="#b9c6d4"/>${T(720, 300, 30, "번호표 444번 고객님~", "#c8303f")}`);
    case "boutique": return wrap(`<rect width="${W}" height="${H}" fill="#2a2230"/>
      ${[0, 1, 2, 3, 4].map(k => `<path d="M${180 + k * 260} 300 l-50 40 l20 30 l20 -14 l0 140 l100 0 l0 -140 l20 14 l20 -30 l-50 -40 q-40 26 -80 0Z" fill="${["#ff8fb1", "#7ee0a8", "#ffd166", "#7cc6fe", "#b98cff"][k]}"/><line x1="${120 + k * 260}" y1="290" x2="${240 + k * 260}" y2="290" stroke="#aaa" stroke-width="6"/>`).join("")}
      <rect x="0" y="760" width="${W}" height="320" fill="#3a2e40"/>${T(720, 200, 64, "빚쟁이 편집숍 · 할부 안 됨", "#ffd6e3")}`);
    case "jobs": return wrap(`<rect width="${W}" height="${H}" fill="#2e2a24"/><rect x="100" y="140" width="1240" height="520" fill="#d8cfb8"/>
      ${Array.from({ length: 12 }, (_, k) => `<rect x="${140 + (k % 6) * 200}" y="${190 + Math.floor(k / 6) * 220}" width="170" height="190" fill="${["#fff", "#ffe9a8", "#ffd6e3"][k % 3]}" transform="rotate(${(k % 5) - 2} ${225 + (k % 6) * 200} ${285 + Math.floor(k / 6) * 220})"/>${T(225 + (k % 6) * 200, 270 + Math.floor(k / 6) * 220, 24, ["카페", "편의점", "상하차", "급구", "당일지급", "허리 튼튼"][k % 6], "#333")}`).join("")}
      <rect x="0" y="760" width="${W}" height="320" fill="#3a332a"/>${T(720, 110, 48, "빚쟁이 인력사무소 · 당일지급", "#ffd166")}`);
    case "cafe": return wrap(`<defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2a22"/><stop offset="1" stop-color="#1c1411"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#c)"/>
      ${[0, 1, 2, 3].map(k => `<line x1="${220 + k * 330}" y1="0" x2="${220 + k * 330}" y2="120" stroke="#6a5444" stroke-width="3"/><circle cx="${220 + k * 330}" cy="140" r="26" fill="#ffcf7a"/><circle cx="${220 + k * 330}" cy="160" r="120" fill="#ffcf7a" opacity=".08"/>`).join("")}
      <rect x="980" y="230" width="400" height="300" rx="16" fill="#18110e" stroke="#7a5c44" stroke-width="6"/>
      <text x="1010" y="290" font-size="34" font-weight="900" fill="#ffd9a0" font-family="sans-serif">빚갚는로스터리</text>
      <text x="1010" y="350" font-size="26" fill="#efe1cf" font-family="sans-serif">아메리카노 4.0</text><text x="1010" y="395" font-size="26" fill="#efe1cf" font-family="sans-serif">이자라떼 5.0</text><text x="1010" y="440" font-size="26" fill="#efe1cf" font-family="sans-serif">원금 프라푸치노 (품절)</text>
      <rect x="0" y="760" width="${W}" height="320" fill="#5e4636"/><rect x="0" y="760" width="${W}" height="30" fill="#8a6a4e"/>`);
    case "store": return wrap(`<rect width="${W}" height="${H}" fill="#27323f"/><rect width="${W}" height="120" fill="#e9f4ff" opacity=".2"/>
      ${[0, 1, 2, 3, 4].map(r => [0, 1, 2, 3, 4, 5, 6, 7].map(c => `<rect x="${40 + c * 175}" y="${200 + r * 110}" width="150" height="70" rx="6" fill="${["#ff8fa3", "#ffd166", "#7cc6fe", "#7ee0a8", "#c3a6ff"][(r + c) % 5]}" opacity=".5"/>`).join("") + `<rect x="0" y="${272 + r * 110}" width="${W}" height="10" fill="#9aa7b6" opacity=".6"/>`).join("")}
      <rect x="0" y="770" width="${W}" height="310" fill="#cfd6df"/><rect x="0" y="770" width="${W}" height="24" fill="#9aa6b4"/>
      <text x="1300" y="90" font-size="44" font-weight="900" fill="#e9fff6" text-anchor="end" font-family="sans-serif">24 빚편의점</text>`);
    case "ware": return wrap(`<rect width="${W}" height="${H}" fill="#1b1d22"/>${[0, 1, 2, 3, 4, 5].map(k => `<rect x="${k * 260}" y="0" width="12" height="780" fill="#2a2d35"/>`).join("")}
      <rect x="760" y="250" width="680" height="530" fill="#d8dde6"/><rect x="780" y="270" width="640" height="490" fill="#0f1115"/>
      ${[0, 1, 2, 3].map(r => [0, 1, 2, 3, 4].map(c => `<rect x="${800 + c * 122}" y="${660 - r * 100}" width="110" height="90" fill="#c69a5c" stroke="#8a6436" stroke-width="4"/>`).join("")).join("")}
      <rect x="0" y="780" width="${W}" height="300" fill="#3a3c42"/><path d="M0 800 L${W} 800" stroke="#ffd166" stroke-width="10" stroke-dasharray="40 30"/>
      <text x="80" y="240" font-size="40" font-weight="900" fill="#ffd166" font-family="sans-serif">⚠ 상하차 · 허리 조심 (조심해도 나감)</text>`);
    case "office": return wrap(`<rect width="${W}" height="${H}" fill="#2a1f18"/>${[0, 1, 2, 3, 4, 5, 6].map(k => `<rect x="${k * 210}" y="0" width="200" height="760" fill="#33261d"/>`).join("")}
      <rect x="380" y="200" width="680" height="120" rx="10" fill="#0e0b08" stroke="#c9a76a" stroke-width="6"/><text x="720" y="280" font-size="58" font-weight="900" text-anchor="middle" fill="#ffd166" font-family="sans-serif">친절한 김사장 캐피탈</text>
      <rect x="120" y="420" width="220" height="300" rx="14" fill="#555b66" stroke="#2a2e36" stroke-width="10"/><circle cx="230" cy="560" r="44" fill="#2a2e36"/><circle cx="230" cy="560" r="14" fill="#c9a76a"/>
      <rect x="0" y="760" width="${W}" height="320" fill="#1a120d"/>`);
    case "sea": return wrap(`<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d5a80"/><stop offset=".5" stop-color="#98c1d9"/><stop offset=".52" stop-color="#1d3557"/><stop offset="1" stop-color="#0b1a30"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#s)"/><path d="M820 560 L1380 560 L1320 680 L880 680Z" fill="#c1121f"/><rect x="960" y="430" width="200" height="130" fill="#eee"/><rect x="1060" y="330" width="16" height="100" fill="#333"/>
      <text x="1100" y="640" font-size="40" font-weight="900" text-anchor="middle" fill="#fff" font-family="sans-serif">제3김사장호</text>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map(k => `<path d="M${k * 200 - 40} ${720 + (k % 2) * 40} q50 -24 100 0 t100 0" stroke="#a8dadc" stroke-width="5" fill="none" opacity=".6"/>`).join("")}`);
    case "gall": return wrap(`<rect width="${W}" height="${H}" fill="#0c0e18"/><rect x="200" y="120" width="1040" height="640" rx="20" fill="#f3f4f7"/><rect x="200" y="120" width="1040" height="80" rx="20" fill="#3b4890"/>
      <text x="240" y="175" font-size="40" font-weight="900" fill="#fff" font-family="sans-serif">주식 갤러리 · 공식 광고 모델</text>
      <rect x="260" y="250" width="920" height="200" rx="14" fill="#ff5fa2"/><text x="720" y="350" font-size="62" font-weight="900" text-anchor="middle" fill="#fff" font-family="sans-serif">리딩방 아님!!</text><text x="720" y="420" font-size="32" text-anchor="middle" fill="#fff" font-family="sans-serif">— 롱잡고알바감 (평생 계약)</text>`);
    case "block": return wrap(`<rect width="${W}" height="${H}" fill="#191b24"/><rect x="420" y="80" width="600" height="920" rx="60" fill="#0b0c10"/><rect x="440" y="100" width="560" height="880" rx="46" fill="#bacee0"/>
      <rect x="440" y="100" width="560" height="90" rx="46" fill="#a9bfd3"/><text x="720" y="160" font-size="34" font-weight="900" text-anchor="middle" fill="#222" font-family="sans-serif">미래</text>
      <rect x="480" y="760" width="480" height="70" rx="16" fill="#fff"/><text x="720" y="806" font-size="26" text-anchor="middle" fill="#999" font-family="sans-serif">상대방이 대화방을 나갔습니다.</text>`);
    default: return wrap(`<rect width="${W}" height="${H}" fill="#0d0e13"/>`);
  }
}
