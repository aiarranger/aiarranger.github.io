// 生成レイヤーの読み込み。マゼンタ背景（#FF00FF）の画像は keyed 印を付け、シェーダーで抜く。
// 1枚に複数の生き物が入った画像は crops で切り出し、キャラクターは非マゼンタ領域に詰める。
import { config } from './config.js';

const isKey = (r, g, b) => r > 170 && b > 170 && g < 110 && Math.abs(r - b) < 70;

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img); img.onerror = () => rej(Error(`${src} を読み込めません`)); img.src = src;
  });
}

function crop(source, x, y, w, h) {
  const cv = document.createElement('canvas');
  const sw = source.naturalWidth || source.width, sh = source.naturalHeight || source.height;
  cv.width = Math.round(sw * w); cv.height = Math.round(sh * h);
  cv.getContext('2d').drawImage(source, Math.round(sw * x), Math.round(sh * y), cv.width, cv.height, 0, 0, cv.width, cv.height);
  return cv;
}

// 非マゼンタ画素の外接矩形（4px飛ばしで走査）に少し余白を足して切り出す
function trim(cv) {
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const { width: w, height: h } = cv, d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) {
    const i = (y * w + x) * 4;
    if (!isKey(d[i], d[i + 1], d[i + 2])) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 <= x0 || y1 <= y0) return cv;
  const pad = 6;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w, x1 + pad); y1 = Math.min(h, y1 + pad);
  return crop(cv, x0 / w, y0 / h, (x1 - x0) / w, (y1 - y0) / h);
}

// 泡：奥（薄い面と縁）と手前（ハイライト）の2枚をCanvas 2Dで描く。キャラクターを包む。
function paintBubble(front) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const ctx = cv.getContext('2d'); const c = 256, r = 236;
  if (!front) {
    const g = ctx.createRadialGradient(c, c, r * .2, c, c, r); g.addColorStop(0, 'rgba(255,255,255,.05)'); g.addColorStop(.85, 'rgba(255,255,255,.10)'); g.addColorStop(1, 'rgba(255,255,255,.28)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(c, c, r - 3, 0, 7); ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c, c, r - 3, 0, 7); ctx.stroke();
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(c, c, r - 26, Math.PI * 1.12, Math.PI * 1.42); ctx.stroke();
    ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(c, c, r - 26, Math.PI * 1.5, Math.PI * 1.6); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(c, c, r - 24, Math.PI * .2, Math.PI * .42); ctx.stroke();
  }
  return cv;
}

export async function loadAssets() {
  const images = {};
  await Promise.all(Object.entries(config.layers).map(async ([name, src]) => {
    images[name] = { source: await loadImage(src), keyed: /key/.test(src) };
  }));
  for (const [name, [from, x, y, w, h]] of Object.entries(config.crops)) {
    images[name] = { source: crop(images[from].source, x, y, w, h), keyed: images[from].keyed };
  }
  for (const name of config.trim) if (images[name]?.keyed) {
    const src = images[name].source;
    images[name].source = trim(src.getContext ? src : crop(src, 0, 0, 1, 1));
  }
  images.bubbleBack = { source: paintBubble(false), keyed: false };
  images.bubbleFront = { source: paintBubble(true), keyed: false };
  return images;
}
