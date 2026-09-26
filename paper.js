// 切り紙の形をCanvas 2Dで作る。どの形も「密に取った輪郭 → ハサミの切り口（6〜14px 間隔の折れ線＋小さなぶれ）」の順で作る。
// 乱数はシード固定なので、毎回同じ形になる（映像の終景に使う書き出しと、実際の表示が一致する）。
export function mulberry32(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const rr = (rnd, a, b) => a + (b - a) * rnd();

// 閉じた輪郭 pts を、step 間隔（ばらつきあり）で取り直し、法線方向に amp だけぶらす → ハサミで切った角のある輪郭
export function scissor(pts, rnd, { step = [6, 14], amp = 1.2 } = {}) {
  const n = pts.length, seg = [], cum = [0];
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push(l); cum.push(cum[i] + l); }
  const total = cum[n], out = [];
  let s = rr(rnd, 0, step[0]), i = 0;
  while (s < total) {
    while (cum[i + 1] < s) i++;
    const a = pts[i], b = pts[(i + 1) % n], u = seg[i] ? (s - cum[i]) / seg[i] : 0;
    const dx = (b[0] - a[0]) / (seg[i] || 1), dy = (b[1] - a[1]) / (seg[i] || 1), j = (rnd() * 2 - 1) * amp;
    out.push([a[0] + (b[0] - a[0]) * u - dy * j, a[1] + (b[1] - a[1]) * u + dx * j]);
    s += rr(rnd, step[0], step[1]);
  }
  return out;
}
export function tracePoly(ctx, pts) { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
export function toPath(pts) { const p = new Path2D(); tracePoly(p, pts); return p; }
export function circlePts(cx, cy, r, n = 96) { const o = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; }

function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }

// ── 魚：レンズ形の胴＋切れ込みのある尾。左向き。目はくり抜く（下の色が見える）。胴と尾を別の画像にして、尾だけ振る ──
const FISH = [ // [胴の太さ比, 尾の長さ比, 尾の開き]
  [.30, .30, .34], [.40, .26, .40], [.24, .36, .30], [.34, .24, .46]
];
export function makeFish(kind, color, len, rnd) {
  const [th, tl, spread] = FISH[kind], L = len, bodyL = L * (1 - tl), h = L * th, pad = 4;
  const body = canvas(bodyL + pad * 2, h + pad * 2), bc = body.getContext('2d');
  const out = [];
  for (let i = 0; i <= 40; i++) { const u = i / 40; out.push([pad + u * bodyL, pad + h / 2 - h / 2 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), .85)]); }
  for (let i = 40; i >= 0; i--) { const u = i / 40; out.push([pad + u * bodyL, pad + h / 2 + h / 2 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), .85)]); }
  bc.fillStyle = color; bc.beginPath(); tracePoly(bc, scissor(out, rnd, { step: [L * .05, L * .09], amp: L * .006 })); bc.fill();
  bc.globalCompositeOperation = 'destination-out'; bc.beginPath(); bc.arc(pad + bodyL * .18, pad + h * .42, h * .11, 0, 7); bc.fill();
  const tw = L * tl + pad * 2, thh = L * spread + pad * 2, tail = canvas(tw, thh), tc = tail.getContext('2d');
  const tp = [[pad, thh / 2 - h * .12], [tw - pad, pad], [tw - pad - L * tl * .38, thh / 2], [tw - pad, thh - pad], [pad, thh / 2 + h * .12]];
  tc.fillStyle = color; tc.beginPath(); tracePoly(tc, scissor(tp, rnd, { step: [L * .04, L * .08], amp: L * .005 })); tc.fill();
  return { body, tail, bodyL, L, h, pad };
}

// ── 海藻：マティスの切り紙のような、幅のある波打つ帯（1〜3本）。根元を下端の中央に置いた縦長の画像 ──
export function makeWeed(color, H, rnd, { fronds = [1, 3], width = .075, sway = [.05, .12] } = {}) {
  const W = H * .62, c = canvas(W, H), ctx = c.getContext('2d'), n = Math.round(rr(rnd, fronds[0], fronds[1]));
  ctx.fillStyle = color;
  for (let f = 0; f < n; f++) {
    const hf = H * (f ? rr(rnd, .55, .85) : rr(rnd, .9, 1)) * .98, bx = W / 2 + (f ? rr(rnd, -.08, .08) * H : 0), A = H * rr(rnd, sway[0], sway[1]), k = rr(rnd, 1.1, 2.2), ph = rnd() * 7, wd = H * width * rr(rnd, .75, 1.2);
    const C = [], N = 48;
    for (let i = 0; i <= N; i++) { const u = i / N; C.push([bx + A * Math.sin(u * Math.PI * k + ph) * Math.pow(u, .8) - A * Math.sin(ph) * 0, H - u * hf]); }
    const L = [], R = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, a = C[Math.max(0, i - 1)], b = C[Math.min(N, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const w = wd * Math.pow(1 - u, .55) * (.82 + .18 * Math.sin(u * 7 + ph)) * (u < .06 ? .7 + u * 5 : 1);
      L.push([C[i][0] - dy / l * w, C[i][1] + dx / l * w]); R.push([C[i][0] + dy / l * w, C[i][1] - dx / l * w]);
    }
    ctx.beginPath(); tracePoly(ctx, scissor([...L, ...R.reverse()], rnd, { step: [7, 15], amp: .9 })); ctx.fill();
  }
  return c;
}

// ── 巨大な葉（転換A）：マティスの切り紙のような羽状の葉。軸と、先端へ向かって斜めに並ぶ細長い小葉6対＋先端の小葉。
//    単位座標（軸の長さ≈1、x=-0.58〜0.5、y は同じ尺度）。polys は塗る形、veins は葉脈の線分 ──
export function giantLeafPts(rnd) {
  const polys = [[[-.58, -.014], [.5, -.006], [.5, .006], [-.58, .014]]], veins = [[[-.58, 0], [.46, 0]]], n = 6;
  const leaflet = (bx, ang, L, Wd) => {
    const top = [], bot = [], N = 40, ca = Math.cos(ang), sa = Math.sin(ang), at = (x, y) => [bx + x * ca - y * sa, x * sa + y * ca];
    for (let i = 0; i <= N; i++) { const t = i / N, r = Wd / 2 * Math.pow(Math.sin(Math.PI * Math.pow(t, .75)), .8); top.push([t * L, -r]); bot.push([t * L, r]); }
    polys.push(scissor([...top, ...bot.reverse()].map(([x, y]) => at(x, y)), rnd, { step: [.004, .009], amp: .0012 }));
    veins.push([at(0, 0), at(L * .82, 0)]);
  };
  for (const s of [-1, 1]) for (let k = 0; k < n; k++) {
    const u = (k + .6 + (s > 0 ? .35 : 0)) / (n + .4), env = Math.pow(Math.sin(Math.PI * Math.min(1, u * .95 + .05)), .8), L = .34 * env * rr(rnd, .92, 1.06) + .05;
    leaflet(-.5 + u * .92, s * (62 - 30 * u) * Math.PI / 180, L, L * .26);
  }
  leaflet(.40, 0, .2, .057);
  return { polys, veins };
}

// ── 紙の輪：外周と、少しずらした内周（太さが不揃いになる）──
export function makeRing(color, D, rnd, { thick = [.08, .16] } = {}) {
  const c = canvas(D + 4, D + 4), ctx = c.getContext('2d'), r = D / 2, cx = r + 2;
  const t = D * rr(rnd, thick[0], thick[1]), off = t * .35, a = rnd() * 7;
  ctx.fillStyle = color; ctx.beginPath(); tracePoly(ctx, scissor(circlePts(cx, cx, r), rnd, { step: [Math.max(3, D * .05), Math.max(5, D * .1)], amp: Math.max(.5, D * .008) })); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath();
  tracePoly(ctx, scissor(circlePts(cx + Math.cos(a) * off, cx + Math.sin(a) * off, r - t), rnd, { step: [Math.max(3, D * .05), Math.max(5, D * .1)], amp: Math.max(.4, D * .006) })); ctx.fill();
  return c;
}

// ── 星：角 4〜7、角の長さ ±25% ──
export function makeStar(color, D, rnd) {
  const c = canvas(D + 4, D + 4), ctx = c.getContext('2d'), n = Math.round(rr(rnd, 4, 7)), R = D / 2, cx = R + 2, pts = [], a0 = rnd() * 7;
  for (let i = 0; i < n * 2; i++) { const a = a0 + i / (n * 2) * Math.PI * 2, r = i % 2 ? R * rr(rnd, .30, .42) : R * rr(rnd, .75, 1); pts.push([cx + Math.cos(a) * r, cx + Math.sin(a) * r]); }
  ctx.fillStyle = color; ctx.beginPath(); tracePoly(ctx, pts); ctx.fill();
  return c;
}

// ── 手切りの円（真珠）──
export function makeDisc(color, D, rnd) {
  const c = canvas(D + 4, D + 4), ctx = c.getContext('2d'), r = D / 2;
  ctx.fillStyle = color; ctx.beginPath(); tracePoly(ctx, scissor(circlePts(r + 2, r + 2, r, 160), rnd, { step: [D * .02, D * .045], amp: D * .004 })); ctx.fill();
  return c;
}

// ── 珊瑚：L-system 深さ4。太い枝、丸い枝先。根元を下端中央に置いた画像 ──
export function makeCoral(color, H, rnd) {
  const W = H * .9, c = canvas(W, H), ctx = c.getContext('2d');
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const branch = (x, y, ang, len, wid, depth) => {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    ctx.lineWidth = wid; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(ang + .3) * len * .5, y + Math.sin(ang + .3) * len * .5, x2, y2); ctx.stroke();
    if (depth === 0) { ctx.beginPath(); ctx.arc(x2, y2, wid * .75, 0, 7); ctx.fill(); return; }
    const k = depth === 4 ? 2 : (rnd() < .45 ? 3 : 2);
    for (let i = 0; i < k; i++) branch(x2, y2, ang + (i - (k - 1) / 2) * rr(rnd, .38, .62) + rr(rnd, -.12, .12), len * rr(rnd, .62, .78), wid * .72, depth - 1);
  };
  branch(W / 2, H, -Math.PI / 2, H * .30, H * .075, 4);
  return c;
}
