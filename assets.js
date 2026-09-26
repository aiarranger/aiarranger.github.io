// 素材の読み込みと、切り紙の部品（画像）づくり。
// 泡の2人は、冒頭映像の最終フレーム（config.media.last）から円く切り出す。大きいあいちゃんは映像の中だけに出す。
import { config } from './config.js';
import { mulberry32, makeFish, makeWeed, makeRing, makeStar, makeDisc, makeCoral, giantLeafPts } from './paper.js';

function loadImage(src) {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(Error(`${src} を読み込めません`)); img.src = src; });
}

// 最終フレームの泡を円く切り出す（半径は実測＋余白。中心は画像の中心）
function cutBubble(img, [bx, by, br], pad) {
  const k = img.naturalWidth / 1920, R = (br + pad) * k, c = document.createElement('canvas'); c.width = c.height = Math.ceil(R * 2);
  const ctx = c.getContext('2d'); ctx.beginPath(); ctx.arc(R, R, R, 0, Math.PI * 2); ctx.clip();
  ctx.drawImage(img, R - bx * k, R - by * k, img.naturalWidth, img.naturalHeight); return c;
}

export async function loadAssets() {
  const T = config.tokens, last = await loadImage(config.media.last);
  const rnd = mulberry32(config.seed);
  const S = {
    last, bubble: { ai: cutBubble(last, config.bubbles.ai, config.bubbles.pad), kiyo: cutBubble(last, config.bubbles.kiyo, config.bubbles.pad) },
    loop: { ai: null, kiyo: null }, // ループの連番画像は loadLoops() が裏で入れる（届くまでは静止画の泡）
    fishIvory: [0, 1, 2, 3].map((k) => makeFish(k, T.ivory, 170, rnd)),
    fishSky: [0, 1, 2, 3].map((k) => makeFish(k, T.sky, 150, rnd)),
    weedUltra: [0, 1, 2].map(() => makeWeed(T.ultra, 900, rnd)),
    weedSky: [0, 1].map(() => makeWeed(T.sky, 760, rnd, { fronds: [1, 1], width: .065, sway: [.08, .14] })),
    weedInk: [0, 1].map(() => makeWeed(T.ink, 980, rnd, { fronds: [2, 3], width: .1 })),
    ringS: [0, 1, 2, 3].map(() => makeRing(T.ivory, 28, rnd, { thick: [.16, .24] })),
    ringA: [0, 1, 2, 3, 4, 5].map(() => makeRing(T.ivory, 96, rnd)),
    stars: [0, 1, 2, 3, 4, 5].map(() => makeStar(T.ivory, 48, rnd)),
    pearl: makeDisc(T.ivory, 280, rnd),
    coral: [makeCoral(T.cobalt, 900, rnd), makeCoral(T.cobalt, 700, rnd)],
    leaf: giantLeafPts(rnd)
  };
  return S;
}

// 泡の中のループの連番画像を裏で読み込む。冒頭映像の読み込みを邪魔しないよう app.js が再生開始後に呼ぶ。
// 初めて描くときに展開で止まらないよう、ImageBitmap にしてから渡す（読めなければ静止画の泡のまま）
export function loadLoops(S) {
  for (const key of ['ai', 'kiyo']) {
    loadImage(config.loops[key].src)
      .then((im) => (window.createImageBitmap ? createImageBitmap(im).catch(() => im) : im))
      .then((bmp) => { S.loop[key] = bmp; })
      .catch(() => {});
  }
}
