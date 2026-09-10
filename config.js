// 色・動き・時間の主要な調整値。改善時はここを先に変える。
export const config = {
  dpr: 1.6,            // canvasの実ピクセル倍率の上限
  journeyVh: 800,      // 3場面のスクロール長（svh）。長いほど各コピーを読む時間が増える
  qMax: 4.0,           // スクロール進行の最大値。3場面＋上昇（〜3.4）＋無料相談を止めて見せる区間（3.4〜4.0）
  demoSeconds: 24,     // 「24秒で見る」の所要時間
  introVideo: 'assets/media/intro.mp4', // Vidu 3本を編集した冒頭映像（tools/edit-intro.mjs）
  // ChatGPT（in-app）で生成したレイヤー。名前に key が付く画像はマゼンタ背景をシェーダーで抜く。
  layers: {
    shallow: 'assets/scenes/shallow.webp',
    mid: 'assets/scenes/mid.webp',
    deep: 'assets/scenes/deep.webp',
    aichan: 'assets/scenes/chibi-aichan-key.webp', // ちびあいちゃん（映像の最後に変身した姿を使い続ける）
    kiyogon: 'assets/scenes/kiyogon-key.webp',
    kelp: 'assets/scenes/kelp-front-key.webp',
    fish: 'assets/scenes/small-fish-key.webp',
    creatures: 'assets/scenes/manta-jelly-key.webp',
    angler: 'assets/scenes/angler-key.webp'
  },
  // 1枚の生成画像から切り出す部分 [元, x, y, w, h]（0〜1）。切り出し後に非マゼンタ領域へ詰める。
  crops: {
    manta: ['creatures', 0, 0, .64, 1],
    jelly: ['creatures', .64, 0, .36, 1],
    anglerfish: ['angler', .54, 0, .46, 1],
    glow: ['angler', 0, 0, .54, 1]
  },
  trim: ['aichan', 'kiyogon', 'manta', 'jelly', 'anglerfish'], // 余白を詰めるレイヤー
  colors: {
    deep: '#061226', navy: '#102f40', paper: '#f4f1e8', teal: '#77c9bd', coral: '#ee927e', cobalt: '#2a5cf0'
  },
  // 背景・海藻・魚など環境レイヤーの限定色（暗→中→明の3色）。キャラクターは本来の色のまま。?palette=名前 か画面の切り替えで選ぶ。
  palette: 'cobalt',
  palettes: {
    cobalt:   { label: 'コバルト（映像と同じ）', dark: '#061226', mid: '#2a5cf0', light: '#f3ebd6', accent: '#77c9bd' },
    cyan:     { label: 'ミッドナイト・シアン',   dark: '#04101e', mid: '#1aa6c9', light: '#eefbff', accent: '#9fe8ff' },
    violet:   { label: 'インディゴ・バイオレット', dark: '#0d0a2a', mid: '#6b4fd8', light: '#f3ebd6', accent: '#c9b8ff' },
    ink:      { label: 'インク（墨と紙）',       dark: '#0a0c12', mid: '#3d5470', light: '#f6f2e8', accent: '#e5b56b' },
    teal:     { label: 'ディープ・ティール',     dark: '#04161c', mid: '#137a7a', light: '#f2f7e9', accent: '#ffd48a' },
    royal:    { label: 'ロイヤルブルー＋ゴールド', dark: '#050d2e', mid: '#1d3fd6', light: '#fff1c2', accent: '#ffcc4d' }
  },
  // 深海から無料相談ページ（紙色）への着地の演出。?landing=名前 か画面の切り替えで選ぶ。
  landing: 'glow',
  landings: {
    glow:    { label: 'A 光へ浮上（上から明るく）' },
    surface: { label: 'B 水面を割る（波の境界）' },
    cobalt:  { label: 'C 中間色を挟む（青の面）' }
  },
  // 場面転換のASCII変換と、見出しが記号になって散る退場。文字化けに見えるため公開版では無効（?dev=1 でも同じ設定）
  ascii: { enabled: false, chars: ' .:-=+*#%@', cell: 14, cellMobile: 10, pulseMs: 700 },
  copySymbols: false,
  contactForm: 'https://docs.google.com/forms/d/e/1FAIpQLSf6QFTPgRlixZjN2cVZmnHWV0lXvlzwcbqWAAAEsJVRHYKgQg/viewform',
  contactEmail: 't-kiyoda@aiarranger.jp'
};
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const mod = (n, m) => ((n % m) + m) % m;
export const lerp = (a, b, t) => a + (b - a) * t;
