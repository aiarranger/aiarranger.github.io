// 切り紙の海（Canvas 2D）。仕様は generation/redesign-spec.md §4。
// 色は config.tokens の7色だけ。形は paper.js の手切りの部品と、ここで作る手切りの色紙の縁。
// 座標は CSS ピクセル（左上原点）。q はスクロールの進行、t は秒。
// 2人は冒頭映像の最後で泡に入って色づいたので、場面の上には泡の2人（映像の最終フレームから切り出した絵）だけを描く。
import { config, clamp, smooth, ramp, lerp, easeOutBack, mod } from './config.js';
const easeIn = (x) => { x = clamp(x); return x * x * x; };
import { mulberry32, rr, tracePoly } from './paper.js';

const T = config.tokens, TAU = Math.PI * 2, DEG = Math.PI / 180;

export class Scene {
  constructor(canvas, S) {
    this.canvas = canvas; this.S = S; this.ctx = canvas.getContext('2d', { alpha: false }); this.t = 0;
    this.resize();
  }
  resize(w = innerWidth, h = innerHeight, dpr, mobile) {
    this.mobile = mobile ?? (w < 750 || h >= w); // app.js の配置判定（幅749以下か縦長）と同じ
    this.dpr = dpr ?? Math.min(devicePixelRatio || 1, this.mobile ? config.dprMobile : config.dpr);
    this.W = w; this.H = h;
    this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr);
    this.build();
  }

  // ── 画面の大きさに合わせて、手切りの縁・部品の配置をシード固定で作る ──
  build() {
    const W = this.W, H = this.H, m = this.mobile, rnd = mulberry32(config.seed + 11), vw = W / 100, vh = H / 100, vmin = Math.min(W, H) / 100;
    const waves = [0, 1, 2, 3].map(() => [rr(rnd, 2, 7), rr(rnd, 0, 7), rr(rnd, .4, 1)]);
    const noise = (u) => waves.reduce((s, [f, p, a]) => s + Math.sin(u * f + p) * a, 0) / 2.2;
    // 手切りの縁：base(x) ＋ ゆるい波 ＋ 6〜14px ごとの細かい角
    const edge = (base, amp = .012) => { const o = []; for (let x = -40; x < W + 40; x += rr(rnd, 6, 14)) o.push([x, base(x) + amp * H * noise(x / W * 6) + .004 * H * (rnd() * 2 - 1)]); return o; };
    const below = (pts) => [...pts, [W + 40, H * 1.8], [-40, H * 1.8]];
    const above = (pts) => [...pts, [W + 40, -H * .8], [-40, -H * .8]];
    this.g = {
      s1Surface: above(edge((x) => .05 * H, .006)),
      s1Sheet: below(edge((x) => .72 * H + .03 * H * Math.sin(x / W * 2.3 * Math.PI + .4))),
      s1Hill: (() => { const o = []; for (let x = .20 * W; x < W + 40; x += rr(rnd, 6, 14)) { const g = x < .38 * W ? 0 : Math.sin(Math.PI * Math.min(1, (x - .38 * W) / (.62 * W) * 1.15)) ** .7, sh = .75 * (1 - Math.min(1, (x - .20 * W) / (.30 * W))) ** 2; o.push([x, H * (1.02 - .17 * g + sh) + .004 * H * (rnd() * 2 - 1)]); } return [...o, [W + 40, H * 1.8], [.20 * W, H * 1.8]]; })(),
      s2Top: above(edge((x) => .28 * H + .02 * H * Math.sin(x / W * 3.1 + 1))),
      s2Bottom: below(edge((x) => .80 * H + .02 * H * Math.sin(x / W * 2.4 + 2))),
      s3Circle: (() => { const o = [], cx = .15 * W, cy = 1.10 * H, r = .70 * H; for (let a = 0; a < TAU; a += rr(rnd, 6, 14) / r) o.push([cx + Math.cos(a) * (r + .01 * H * noise(a * 3)), cy + Math.sin(a) * (r + .01 * H * noise(a * 3))]); return o; })(),
      bands: [[.08, .06, .62], [.20, .10, .72], [.34, .04, .55], [.46, .08, .66]].map(([x0, w, yb], i) => {
        const dx = Math.tan(24 * DEG), top = x0 * W, wd = w * W, ybR = yb * H, ybL = (yb - .07) * H;
        const pts = []; const side = (x1, y1, x2, y2) => { const n = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / rr(rnd, 8, 16))); for (let k = 0; k < n; k++) { const u = k / n; pts.push([x1 + (x2 - x1) * u + rr(rnd, -1.2, 1.2), y1 + (y2 - y1) * u]); } };
        side(top, -20, top + wd, -20); side(top + wd, -20, top + wd + ybR * dx, ybR); side(top + wd + ybR * dx, ybR, top + ybL * dx, ybL); side(top + ybL * dx, ybL, top, -20);
        return { pts, cx: top + wd / 2, phase: i * 1.7 };
      }),
      leafOffsets: Array.from({ length: 72 }, () => rr(rnd, -1, 1)),
      ringNoise: Array.from({ length: 64 }, () => rr(rnd, -1, 1))
    };
    const fishKinds = () => Math.floor(rnd() * 4);
    this.s1Fish = Array.from({ length: m ? 7 : 11 }, () => ({ k: fishKinds(), x: rr(rnd, -10 * vw, W + 10 * vw), y: rr(rnd, .18, .34) * H, len: rr(rnd, 3.4, 6.2) * vw * (m ? 1.6 : 1), sp: 3 * vw * rr(rnd, .8, 1.25), ph: rnd() * 7 }));
    this.s1Rings = Array.from({ length: 6 }, (_, i) => ({ k: i % 4, x: rr(rnd, .5, .98) * W, y: rnd() * H, d: rr(rnd, 6, 14), sp: rr(rnd, 20, 40), ph: rnd() * 7 }));
    const NB = m ? 40 : 64; this.ball = Array.from({ length: NB }, (_, i) => ({ k: fishKinds(), lat: rr(rnd, -1.15, 1.15), lon: rnd() * TAU, sp: .35 * rr(rnd, .85, 1.2), len: rr(rnd, 2.2, 4.4) * vw * (m ? 1.6 : 1), s: i / NB - .5 + rr(rnd, -.02, .02), d: rr(rnd, -.5, .5), ph: rnd() * 7 }));
    this.cols = (m ? [.78, .92] : [.80, .88, .94]).flatMap((x) => Array.from({ length: 5 }, () => ({ k: Math.floor(rnd() * 6), x: x * W, y: rnd() * H * 1.2, d: rr(rnd, 12, 56) * (m ? .8 : 1), sp: rr(rnd, 40, 90), ph: rnd() * 7 })));
    this.stars = Array.from({ length: m ? 18 : 30 }, () => ({ k: Math.floor(rnd() * 6), x: rnd() * W, y: rr(rnd, .04, .86) * H, d: rr(rnd, 6, 28), ph: rnd() * 7 }));
    this.snow = Array.from({ length: m ? 24 : 40 }, () => ({ x: rnd() * W, y: rnd() * H, ph: rnd() * 7 }));
    const NS = m ? 12 : 18; this.spiral = Array.from({ length: NS }, (_, i) => ({ k: fishKinds(), a: i / NS * TAU + rr(rnd, -.1, .1), rj: rr(rnd, .85, 1.15), len: rr(rnd, 1.6, 2.6) * vw * (m ? 1.6 : 1) }));
    this.ctaRings = Array.from({ length: 8 }, (_, i) => ({ k: i % 4, x: rr(rnd, .45, .98) * W, y: rnd() * H, d: rr(rnd, 8, 20), sp: rr(rnd, 18, 36), ph: rnd() * 7 }));
    this.pearl = m ? [.5 * W, .24 * H] : [.62 * W, .30 * H]; this.pearlR = 7 * vh;
  }

  // ── 描画の部品 ──
  poly(pts, color, alpha = 1) { const c = this.ctx; c.globalAlpha = alpha; c.fillStyle = color; c.beginPath(); tracePoly(c, pts); c.fill(); c.globalAlpha = 1; }
  img(im, x, y, w, h, { rot = 0, alpha = 1, flip = false } = {}) {
    const c = this.ctx; c.save(); c.globalAlpha = alpha; c.translate(x, y); if (rot) c.rotate(rot); if (flip) c.scale(-1, 1); c.drawImage(im, -w / 2, -h / 2, w, h); c.restore();
  }
  // 根元（下端中央）を固定して、せん断で揺らす
  weed(im, x, baseY, h, sway) {
    const c = this.ctx, w = h * im.width / im.height; c.save(); c.translate(x, baseY); c.transform(1, 0, sway, 1, 0, 0); c.drawImage(im, -w / 2, -h, w, h); c.restore();
  }
  // 魚：heading（進む向き、ラジアン）に向けて描く。尾だけ振る
  fish(f, x, y, len, heading, wag, alpha = 1) {
    const c = this.ctx, s = len / f.L, right = Math.cos(heading) > 0;
    c.save(); c.globalAlpha = alpha; c.translate(x, y); c.rotate(right ? heading : heading - Math.PI); if (right) c.scale(-1, 1); c.scale(s, s); c.translate(-f.L / 2, 0);
    c.save(); c.translate(f.bodyL, 0); c.rotate(wag); c.drawImage(f.tail, -f.pad, -f.tail.height / 2); c.restore();
    c.drawImage(f.body, -f.pad, -f.body.height / 2); c.restore();
  }
  bands(alpha, t, only) {
    this.g.bands.forEach((b, i) => {
      if (only != null && i !== only) return;
      const c = this.ctx; c.save(); c.translate(b.cx, -20); c.rotate(Math.sin(t * .5 + b.phase) * DEG); c.translate(-b.cx, 20); this.poly(b.pts, T.sky, alpha); c.restore();
    });
  }
  sheet(pts, color, dy = 0) { const c = this.ctx; c.save(); c.translate(0, dy); this.poly(pts, color); c.restore(); }
  rising(list, sprites, t, W, H, speedK = 1) {
    for (const r of list) { const y = mod(r.y - r.sp * speedK * t, H + 80) - 40; this.img(sprites[r.k % sprites.length], r.x + Math.sin(t * 1.3 + r.ph) * 4, y, r.d, r.d); }
  }

  // ── 場面 ──
  s1(q, t) {
    const W = this.W, H = this.H, c = this.ctx, S = this.S, m = this.mobile, l = clamp(q), par = (d) => -d * .35 * H * l;
    c.fillStyle = T.cobalt; c.fillRect(0, 0, W, H);
    this.bands(.28, t);
    this.sheet(this.g.s1Surface, T.sky, par(.15));
    this.sheet(this.g.s1Sheet, T.ultra, par(.15));
    [[.05, .58], [.16, .46], [.34, .38], [.47, .52], [.62, .44], [.76, .60], [.93, .50]].forEach(([x, h], i) => this.weed(S.weedUltra[i % 3], x * W, H * 1.02 + par(.6), h * H, Math.sin(t * .85 + i * 1.7) * .03));
    this.sheet(this.g.s1Hill, T.ink, par(1.1));
    this.rising(this.s1Rings, S.ringS, t, W, H);
    for (const f of this.s1Fish) { const x = mod(f.x - f.sp * t, W + 20 * W / 100) - 10 * W / 100; this.fish(S.fishIvory[f.k], x, f.y + par(1) + Math.sin(t * 1.1 + f.ph) * 3, f.len, Math.PI, Math.sin(t * 4 * Math.PI + f.ph) * 12 * DEG); }
    [[.22, .56], [.36, .40], [.90, .48]].forEach(([x, h], i) => this.weed(S.weedSky[i % 2], x * W, H * 1.02 + par(1.35), h * H, Math.sin(t * .9 + i * 2.3) * .05));
    this.weed(S.weedInk[0], -.02 * W, H * 1.04 + par(1.35), .55 * H, Math.sin(t * .8) * .04 + .08);
    this.weed(S.weedInk[1], 1.02 * W, H * 1.04 + par(1.35), .55 * H, Math.sin(t * .8 + 1) * .04 - .08);
  }

  s2(q, t) {
    const W = this.W, H = this.H, c = this.ctx, S = this.S, m = this.mobile, l = clamp(q - 1), par = (d) => -d * .35 * H * l, vmin = Math.min(W, H) / 100;
    c.fillStyle = T.ultra; c.fillRect(0, 0, W, H);
    this.bands(.14, t, 1);
    this.sheet(this.g.s2Top, T.cobalt, par(.15));
    this.sheet(this.g.s2Bottom, T.ink, par(.15));
    this.rising(this.cols, S.ringA, t, W, H * 1.2);
    // 群れ（ベイトボール）→ 斜めの帯にほどけて左へ抜ける
    const [cx, cy] = m ? [.5 * W, .42 * H] : [.62 * W, .50 * H], u = smooth(ramp(q, 1.50, 1.80)), exit = smooth(ramp(q, 1.80, 1.95));
    const R = 24 * vmin * (1 + .06 * Math.sin(t * TAU / 4)) * lerp(1, 1.25, u), dir = [Math.cos(-30 * DEG), Math.sin(-30 * DEG)], perp = [-dir[1], dir[0]];
    const bc = [.5 * W, .62 * H], list = [];
    for (const f of this.ball) {
      const lon = f.lon + f.sp * t, X = R * Math.cos(f.lat) * Math.sin(lon), Y = R * Math.sin(f.lat) * .85, Z = Math.cos(f.lat) * Math.cos(lon);
      const bx = cx + X, by = cy + Y + X * .18, vx = Math.cos(lon), bh = Math.atan2(vx * .18, vx);
      const s = mod(f.s + .5 - .018 * t, 1) - .5, tx = bc[0] + s * 1.4 * W * dir[0] + f.d * .16 * H * perp[0] - exit * 1.7 * W, ty = bc[1] + s * 1.4 * W * dir[1] + f.d * .16 * H * perp[1];
      list.push({ f, z: lerp(Z, 0, u), x: lerp(bx, tx, u), y: lerp(by, ty, u) + par(1), sc: lerp(lerp(.7, 1.15, (Z + 1) / 2), 1, u), h: u > .5 ? Math.atan2(-dir[1], -dir[0]) : bh, sky: Z < -.55 && u < .5 });
    }
    list.sort((a, b) => a.z - b.z);
    for (const o of list) this.fish((o.sky ? S.fishSky : S.fishIvory)[o.f.k], o.x, o.y, o.f.len * o.sc, o.h, Math.sin(t * 4 * Math.PI + o.f.ph) * 12 * DEG);
  }

  s3(q, t) {
    const W = this.W, H = this.H, c = this.ctx, S = this.S, m = this.mobile, l = clamp(q - 2), par = (d) => -d * .35 * H * l, vh = H / 100;
    c.fillStyle = T.ink; c.fillRect(0, 0, W, H);
    this.sheet(this.g.s3Circle, T.ultra, par(.15));
    const tq = Math.floor(t * 8) / 8; // 星の瞬きだけコマ落とし
    for (const s of this.stars) { const k = .85 + .15 * (Math.sin(tq * 3 + s.ph) * .5 + .5); this.img(S.stars[s.k], s.x, s.y + par(.6), s.d * k, s.d * k, { rot: Math.sin(tq * 2 + s.ph) * 8 * DEG }); }
    c.fillStyle = T.ivory; for (const s of this.snow) c.fillRect(s.x + Math.sin(t * .7 + s.ph) * 3, mod(s.y + 8 * t, H), 2, 2);
    this.weed(S.coral[0], .12 * W, H * 1.01 + par(1.35), .60 * H, Math.sin(t * .7) * .02);
    this.weed(S.coral[1], .88 * W, H * 1.01 + par(1.35), .40 * H, Math.sin(t * .7 + 1.2) * .02);
    // 真珠とまわりを回る小魚
    const [px, py] = this.pearl, grow = easeOutBack(ramp(q, 2.40, 2.55)), rad = lerp(22, 14, ramp(q, 2.4, 3.0)) * vh;
    if (grow > 0) {
      for (const f of this.spiral) { const a = f.a - t * TAU / 12, r = rad * f.rj; this.fish(S.fishSky[f.k], px + Math.cos(a) * r, py + Math.sin(a) * r * .8, f.len, a - Math.PI / 2, Math.sin(t * 4 * Math.PI + f.a) * 12 * DEG, clamp(grow)); }
      const d = this.pearlR * 2 * grow; this.img(S.pearl, px, py, d, d);
    }
  }

  s5(q, t) {
    const W = this.W, H = this.H, c = this.ctx, S = this.S;
    c.fillStyle = T.cobalt; c.fillRect(0, 0, W, H);
    this.bands(.28, t);
    this.sheet(this.g.s1Surface, T.sky);
    this.sheet(this.g.s1Sheet, T.ultra);
    this.rising(this.ctaRings, S.ringS, t, W, H);
    [[.04, .5], [.20, .36], [.55, .30], [.74, .44], [.96, .52]].forEach(([x, h], i) => this.weed(S.weedUltra[i % 3], x * W, H * 1.02, h * H, Math.sin(t * .85 + i * 1.7) * .03));
    this.weed(S.weedSky[0], .06 * W, H * 1.02, .42 * H, Math.sin(t * .9) * .05 + .06);
    this.weed(S.weedSky[1], .95 * W, H * 1.02, .34 * H, Math.sin(t * .9 + 1) * .05 - .05);
    this.weed(S.weedInk[0], -.03 * W, H * 1.04, .50 * H, Math.sin(t * .8) * .04 + .08);
    this.weed(S.weedInk[1], 1.03 * W, H * 1.04, .46 * H, Math.sin(t * .8 + 1) * .04 - .08);
  }

  // 転換A：墨紺の羽状の葉が、左上から右下へ画面を横切る。葉の軸が通り過ぎた側（左上）だけが次の場面（S2）になり、境目は軸の下に隠れる
  leafGeom(p) {
    const W = this.W, H = this.H, diag = Math.hypot(W, H), len = 1.6 * diag, ang = -32 * DEG, ax = [Math.cos(ang), Math.sin(ang)], nx = [-ax[1], ax[0]];
    const d = lerp(-.95, .95, p) * diag, cx = W / 2 + nx[0] * d, cy = H / 2 + nx[1] * d;
    return { len, ang, ax, nx, cx, cy, diag, map: ([u, v]) => [cx + (u * ax[0] - v * ax[1]) * len, cy + (u * ax[1] + v * ax[0]) * len] };
  }
  leafBehind(G) { // 軸より左上側の半平面
    const c = this.ctx, F = G.diag * 2, { cx, cy, ax, nx } = G;
    c.beginPath(); c.moveTo(cx - ax[0] * F, cy - ax[1] * F); c.lineTo(cx + ax[0] * F, cy + ax[1] * F); c.lineTo(cx + ax[0] * F - nx[0] * F, cy + ax[1] * F - nx[1] * F); c.lineTo(cx - ax[0] * F - nx[0] * F, cy - ax[1] * F - nx[1] * F); c.closePath();
  }
  leaf(G) {
    const c = this.ctx; c.fillStyle = T.ink; c.beginPath();
    for (const poly of this.S.leaf.polys) { poly.forEach((pt, i) => { const [x, y] = G.map(pt); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); }
    c.fill();
    c.strokeStyle = T.sky; c.lineCap = 'round'; c.lineWidth = Math.max(2, G.len * .0024); c.beginPath();
    for (const [a, b] of this.S.leaf.veins) { const A = G.map(a), B = G.map(b); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); }
    c.stroke();
  }

  // 転換B：輪が膨らみ、その内側が次の場面になる
  ringPath(cx, cy, r) { const c = this.ctx, n = this.g.ringNoise, N = n.length; c.beginPath(); for (let i = 0; i < N; i++) { const a = i / N * TAU, rr2 = r * (1 + .012 * n[i]); i ? c.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2) : c.moveTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); } c.closePath(); }

  // ── 泡の2人 ──
  // CTA での位置：デスクトップは右側、モバイルは上端64pxから（低い画面は小さく上へ寄せて、下の札と重ねない）
  ctaTarget(key) {
    const W = this.W, H = this.H;
    if (!this.mobile) return key === 'ai' ? [.70 * W, .50 * H, .19 * H] : [.87 * W, .27 * H, .12 * H];
    const b = config.bubbles, r = (b[key][2] + b.pad) / 1080 * W, low = H < 640;
    return key === 'ai' ? [W * (low ? .32 : .36), 64 + W * (low ? .24 : .40), r * (low ? .6 : .8)] : [W * .78, 64 + W * (low ? .10 : .17), r * (low ? .6 : .8)];
  }
  // q での位置と半径（config.path の区間を smooth でつなぎ、最後は CTA の位置へ）＋ゆるい浮き沈み
  charAt(key, q, t) {
    const W = this.W, H = this.H, m = this.mobile, unit = m ? W : H;
    const keys = [...config.path[m ? 'mobile' : 'desktop'][key].map(([kq, x, y, r]) => [kq, x * W, y * H, r * unit]), [config.segments.open[1], ...this.ctaTarget(key)]];
    let p = keys[keys.length - 1];
    if (q <= keys[0][0]) p = keys[0];
    else for (let i = 0; i < keys.length - 1; i++) { const a = keys[i], b = keys[i + 1]; if (q <= b[0]) { const u = smooth((q - a[0]) / (b[0] - a[0])); p = [q, lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u)]; break; } }
    let [, x, y, r] = p;
    // コピーの札に重ねない（app.js の safeArea）。札の出ている S1〜S3 では境目の外へ寄せ、真珠の窓が開く間に CTA の境目へ切り替える
    const sf = this.safe, sg = config.segments, f = ramp(q, sg.open[0], sg.open[1]);
    if (sf && !m) x = lerp(Math.max(x, sf.left + r), x, f);
    if (sf && m) {
      const lim = lerp(sf.bottom, sf.ctaBottom, f);
      if (y + r > lim) { r = Math.max(Math.min(r, (lim - 72) / 2), r * .6); y = Math.max(72 + r, lim - r); }
    }
    return [x, y + Math.sin(t * TAU / 5 + (key === 'ai' ? 0 : 1.3)) * .008 * H, r];
  }
  // 冒頭映像の最終フレームを、映像と同じ切り取り（geo）で置いたときの泡の位置
  landAt(key, geo) { const b = config.bubbles, [bx, by, br] = b[key]; return [geo.ox + bx * geo.s, geo.oy + by * geo.s, (br + b.pad) * geo.s]; }
  // land = null（着地済み）か { c: 外側が閉じる進み, m: 泡が移る進み, geo }
  chars(q, t, land) {
    const c = this.ctx, W = this.W, H = this.H;
    if (land && land.c < 1) { // 最終フレームのまま、泡の外側だけが閉じていく
      const R = lerp(Math.hypot(W, H) * 1.2, 0, smooth(land.c)), g = land.geo;
      c.save(); c.beginPath();
      for (const key of ['ai', 'kiyo']) { const [x, y, r] = this.landAt(key, g); c.moveTo(x + Math.max(r, R), y); c.arc(x, y, Math.max(r, R), 0, TAU); }
      c.clip(); c.drawImage(this.S.last, g.ox, g.oy, 1920 * g.s, 1080 * g.s); c.restore();
      return;
    }
    // 泡の中の動きは着地が終わってから最初のコマで始める（それまでは最終フレームと同じ最初のコマ）。揺れも着地に合わせて強める
    if (land) this.animT0 = t;
    const at = land ? null : t - (this.animT0 ?? 0), amp = land ? smooth(land.m) : 1, wb = config.wobble; // 着地中は静止画（大きく映るので鮮明な方）
    for (const key of ['kiyo', 'ai']) {
      let [x, y, r] = this.charAt(key, q, t);
      if (land) { const [lx, ly, lr] = this.landAt(key, land.geo), u = smooth(land.m); x = lerp(lx, x, u); y = lerp(ly, y, u); r = lerp(lr, r, u); }
      const ph = key === 'ai' ? 0 : 2.1, sq = amp * wb.squash * Math.sin(t * TAU / wb.squashSec + ph);
      c.save(); c.translate(x, y); c.rotate(amp * wb.tilt * DEG * Math.sin(t * TAU / wb.tiltSec + ph)); c.scale(1 + sq, 1 - sq);
      this.bubbleFrame(key, r, at);
      c.restore();
    }
  }
  // 泡の中身を原点中心・半径 r で描く。ループの連番画像があればその時刻のコマ、なければ（または at が null なら）最終フレームの静止画
  bubbleFrame(key, r, at) {
    const c = this.ctx, im = this.S.loop?.[key], L = config.loops[key];
    if (!im || at == null) { c.drawImage(this.S.bubble[key], -r, -r, r * 2, r * 2); return; }
    this.loopStart ??= {}; this.loopStart[key] ??= this.t; // 連番画像を初めて描いた時刻（遅れて届いた場合もそこから切り替える）
    const f = Math.floor(Math.max(0, at) * L.fps) % L.frames, S = L.size, k = r / (S * config.loops.ratio);
    c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip();
    c.drawImage(im, (f % L.cols) * S, Math.floor(f / L.cols) * S, S, S, -S / 2 * k, -S / 2 * k, S * k, S * k);
    c.restore();
    // 着地の直後（または連番画像が届いた直後）は、静止画から動く絵へ 0.35 秒で重ねて切り替える（細部の描き方の違いでちらつかないように）
    const age = Math.min(at, this.t - this.loopStart[key]);
    if (age < .35) { c.globalAlpha = clamp(1 - age / .35); c.drawImage(this.S.bubble[key], -r, -r, r * 2, r * 2); c.globalAlpha = 1; }
  }

  draw(q, t, land = null) {
    this.t = t; const c = this.ctx, sg = config.segments, W = this.W, H = this.H;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.globalAlpha = 1;
    let front = null; // 泡より手前に描くもの（葉、輪の縁、真珠の窓の縁）
    if (q < sg.leafA[0]) this.s1(q, t);
    else if (q < sg.leafA[1]) {
      this.s1(q, t);
      const G = this.leafGeom(ramp(q, sg.leafA[0], sg.leafA[1]));
      c.save(); this.leafBehind(G); c.clip(); this.s2(q, t); c.restore(); c.globalAlpha = 1;
      front = () => this.leaf(G);
    }
    else if (q < sg.ringB[0]) this.s2(q, t);
    else if (q < sg.ringB[1]) {
      this.s2(q, t);
      const p = ramp(q, sg.ringB[0], sg.ringB[1]), r = Math.pow(p, 1.4) * Math.hypot(W, H) * 1.1 + 20, [cx, cy] = [.72 * W, .40 * H];
      c.save(); this.ringPath(cx, cy, r); c.clip(); this.s3(q, t); c.restore();
      front = () => { c.save(); this.ringPath(cx, cy, r); c.lineWidth = 8; c.strokeStyle = T.ivory; c.stroke(); c.restore(); };
    }
    else if (q < sg.open[0]) this.s3(q, t);
    else if (q < sg.open[1]) { // 転換C：真珠が窓になって広がり、中が明るい CTA の海になる
      this.s3(q, t);
      const [px, py] = this.pearl, r = lerp(this.pearlR, Math.hypot(W, H) * 1.05, easeIn(ramp(q, sg.open[0], sg.open[1])));
      c.save(); this.ringPath(px, py, r); c.clip(); this.s5(q, t); c.restore();
      front = () => { c.save(); this.ringPath(px, py, r); c.lineWidth = 8; c.strokeStyle = T.ivory; c.stroke(); c.restore(); };
    }
    else this.s5(q, t);
    this.chars(q, t, land);
    front?.();
  }

  // 指定の q・t で w×h に描いて PNG を返す（OGP 画像などに使う。着地済みの状態）
  async snapshot(w = 1920, h = 1080, { q = 0, t = 0 } = {}) {
    const keep = [this.W, this.H, this.dpr, this.mobile], safe = this.safe, a0 = this.animT0, ls = this.loopStart;
    // 札の境目は画面の実寸のもの、泡の中のコマは画面での経過時間によるので、書き出しでは q と t だけで決める
    this.safe = null; this.animT0 = 0; this.loopStart = { ai: -1e9, kiyo: -1e9 };
    this.resize(w, h, 1); this.draw(q, t);
    const blob = await new Promise((res) => this.canvas.toBlob(res, 'image/png'));
    this.resize(keep[0], keep[1], keep[2], keep[3]); this.safe = safe; this.animT0 = a0; this.loopStart = ls;
    return blob;
  }
}
