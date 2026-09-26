// 色・動き・時間の主要な調整値。改善時はここを先に変える。仕様は generation/redesign-spec.md。
export const config = {
  dpr: 1.6, dprMobile: 1.5,             // canvasの実ピクセル倍率の上限
  journeyVh: { desktop: 760, mobile: 640 }, // 舞台（#journey）の高さ（svh）。style.css と合わせる
  qMax: 3.8,                              // スクロール進行 q の最大値
  seed: 20260926,                         // 切り紙の形の乱数（固定）

  // 7色だけを使う（グラデーション・ぼかし・グローは使わない）
  tokens: {
    ink: '#061226',    // 墨紺：深層、経験、フッター、明るい面の上の文字
    ultra: '#0F2C74',  // 群青：中層、手前の影、コピーの札
    cobalt: '#2A5CF0', // コバルト：浅瀬の地、珊瑚、フォームの地
    sky: '#7C9CF8',    // 明るいコバルト：光の紙、奥の海藻、補助文字
    ivory: '#F3EBD6',  // 生成り：文字、魚、泡の輪、星、真珠（面には使わない）
    salmon: '#F1907E', // サーモン：押せる場所だけ（2人が色づいたあとの世界なので、最初から使う）
    red: '#E23B4E'     // 紅：ロゴの点だけ
  },

  // スクロールの区間（q）。コピーは [入り始め, 入り終わり, 出始め, 出終わり]
  segments: {
    copy1: [-1, -1, .80, .88],
    leafA: [.84, 1.10],                       // 転換A：葉が横切り、軸が通った側から S2 になる
    copy2: [1.10, 1.16, 1.80, 1.88],
    ringB: [1.84, 2.10],                      // 転換B：輪のリビール
    copy3: [2.10, 2.16, 2.72, 2.80],
    pearl: [2.40, 2.55],                      // 真珠が現れる
    open: [2.86, 3.26],                       // 転換C：真珠が窓になって広がり、中が CTA の海になる
    cta: [3.16, 3.36]                         // CTA が出て、qMax まで止まる
  },
  // 冒頭映像のあと：最後のフレーム（泡の2人）を残して外側を閉じ、泡が S1 の位置へ移る（秒）
  landing: { close: [.35, 1.35], move: [1.35, 2.35] }, // 閉じ終わってから移る（重ねると切り替わりで泡が跳ぶ）

  media: {
    intro: 'assets/media/intro.mp4',
    introMobile: 'assets/media/intro-720.mp4',
    last: 'assets/media/transform/last.webp' // 冒頭映像の最終フレーム（泡の2人）。着地と泡の絵に使う
  },
  // 泡の中の2人のループ（Vidu の開始＝終了フレームの映像を tools/build-bubble-loops.py で連番画像1枚にしたもの）。
  //   1コマ size 四方、cols 列、frames コマ、fps。泡の半径は1コマの ratio（最終フレームの泡の半径＋余白）
  loops: {
    ai: { src: 'assets/media/bubbles/ai-loop.webp', size: 360, cols: 8, frames: 40, fps: 10 },
    kiyo: { src: 'assets/media/bubbles/kiyo-loop.webp', size: 240, cols: 8, frames: 40, fps: 10 },
    ratio: .375
  },
  // 泡そのものの揺れ（傾きの度数・周期、ふくらみの割合・周期）
  wobble: { tilt: 2.5, tiltSec: 6.5, squash: .014, squashSec: 3.1 },
  // 最終フレーム（1920×1080）の泡の中心と半径（実測）
  bubbles: { ai: [1152, 518, 262], kiyo: [1628, 300, 172], pad: 8 },
  // 冒頭映像の見える位置：縦長の画面では cover で横が切れるので、変身クリップの間だけ、あいちゃんを追って横位置を動かす
  //   segs：[映像の開始秒, 終了秒, クリップの開始秒, 終了秒]（第1カットと第7カットが変身クリップ）
  //   keys：[クリップの秒, 見せたい中心 x（1920幅の座標）]
  introPan: {
    segs: [[0, 17 / 24, 0, .7], [199 / 24, 316 / 24, .25, 5.125]],
    keys: [[0, 540], [.9, 480], [1.5, 1000], [1.8, 880], [2.2, 720], [2.5, 860], [3.0, 1060], [4.0, 1120], [5.125, 1152]]
  },
  // 泡の2人が進む道筋：[q, x/W, y/H, 半径]。半径はデスクトップが H、モバイルが W に対する割合。最後の CTA の位置は scene.js で計算
  path: {
    desktop: {
      ai: [[0, .66, .47, .15], [.84, .58, .61, .14], [1.10, .82, .28, .10], [1.84, .54, .66, .10], [2.10, .50, .78, .11], [2.86, .57, .47, .12]],
      kiyo: [[0, .85, .25, .095], [.84, .79, .38, .09], [1.10, .94, .15, .065], [1.84, .66, .53, .065], [2.10, .66, .66, .07], [2.86, .74, .36, .075]]
    },
    mobile: {
      ai: [[0, .44, .31, .21], [.84, .40, .37, .19], [1.10, .62, .22, .15], [1.84, .40, .40, .15], [2.10, .36, .46, .16], [2.86, .42, .36, .16]],
      kiyo: [[0, .80, .16, .12], [.84, .76, .23, .11], [1.10, .85, .13, .09], [1.84, .66, .30, .09], [2.10, .70, .40, .10], [2.86, .70, .27, .10]]
    }
  },

  // 下部セクションの小さな2人（assets/scenes/*-key.webp のマゼンタを抜いて切り詰めた透過PNG）
  layers: {
    chibi: 'assets/scenes/chibi-cut.webp',     // ちびあいちゃん（フォーム）
    kiyogon: 'assets/scenes/kiyogon-cut.webp'  // きよごん（経験）
  },
  contactForm: 'https://docs.google.com/forms/d/e/1FAIpQLSf6QFTPgRlixZjN2cVZmnHWV0lXvlzwcbqWAAAEsJVRHYKgQg/viewform',
  contactEmail: 't-kiyoda@aiarranger.jp'
};
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const ramp = (q, a, b) => clamp((q - a) / (b - a));
export const mod = (n, m) => ((n % m) + m) % m;
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOutCubic = x => 1 - Math.pow(1 - clamp(x), 3);
export const easeOutBack = x => { x = clamp(x); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
