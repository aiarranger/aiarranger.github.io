// 状態遷移：冒頭映像（最後に2人が泡の中で色づく）→ 最終フレームの泡だけを残して切り紙の海へ着地 → スクロールで S1〜S3 → 真珠の窓で CTA の海 → 経験・フォーム
// 仕様は generation/redesign-spec.md。q はスクロールの進行。映像と動きは端末の設定にかかわらず最初から ON（止めたい人は「一時停止」）。
import { config, clamp, smooth, ramp } from './config.js';
import { loadAssets, loadLoops } from './assets.js';
import { Scene } from './scene.js';

const $ = (s) => document.querySelector(s), root = document.documentElement, main = $('#main'), intro = $('#intro'), status = $('#loadStatus'), stage = $('#stage'), pauseBtn = $('#pause');
const params = new URLSearchParams(location.search), sg = config.segments, QMAX = config.qMax;
const layoutMQ = matchMedia('(max-width: 749px), (orientation: portrait)'); // style.css の舞台のモバイル配置と同じ条件
const isMobile = () => layoutMQ.matches;
const SW = () => stage.clientWidth || innerWidth, SH = () => stage.clientHeight || innerHeight; // 舞台の実寸（スクロールバーを除く）
const setInert = (v) => { main.inert = v; $('header.site').inert = v; $('footer').inert = v; };
// ページ内の節への直接リンク（ブログの Contact → #contact など）で来たときは、冒頭映像を省いてその節へ移る
const deepLink = (() => { const id = location.hash.slice(1); return ['contact', 'form', 'experience'].includes(id) ? document.getElementById(id) : null; })();
const state = { intro: params.get('intro') === 'off' || deepLink ? 'done' : 'active', ready: false, q: 0, t: 0, raf: 0, prev: 0, fadeTimer: 0, leaveRequested: false, paused: false, land0: null, landGeo: null };
let scene, film, assets, range = 1, loopsRequested = false;
// 泡の中のループの連番画像は、冒頭映像が再生し始めてから（映像がない・省いたときはすぐ）裏で読み込む
function requestLoops() { if (loopsRequested || !assets) return; loopsRequested = true; loadLoops(assets); }

// ── ループ ──
function lock() { root.classList.toggle('locked', state.intro !== 'done'); }
function stageVisible() { return scrollY < range + innerHeight; }
function wake() { if (!state.raf && !document.hidden) state.raf = requestAnimationFrame(frame); }
function measure() {
  range = Math.max(1, $('#journey').offsetHeight - innerHeight);
  if (scene) { scene.resize(SW(), SH(), undefined, isMobile()); scene.safe = safeArea(); }
  onScroll(); render(true); wake();
}
// 泡の2人をコピーの札に重ねないための境目（舞台の座標）。デスクトップは S1〜S3 の札の右端、モバイルは札の上端（CTA の札は別）
function safeArea() {
  const cards = copies.slice(0, 3), cta = copies[3];
  return { left: Math.max(...cards.map((el) => el.offsetLeft + el.offsetWidth)) + 16, bottom: Math.min(...cards.map((el) => el.offsetTop)) - 12, ctaBottom: cta.offsetTop - 12 };
}
function onScroll() { if (state.intro === 'done') state.q = clamp(scrollY / range * QMAX, 0, QMAX); root.classList.toggle('past', scrollY > range + 10); }
function frame(now) {
  state.raf = 0;
  const dt = state.prev ? Math.min((now - state.prev) / 1000, .05) : 0; state.prev = now;
  const moving = state.intro !== 'active' && !state.paused;
  if (moving) state.t += dt;
  if (state.intro === 'active' && film) panFilm();
  render();
  // 止めているとき（一時停止）は、スクロールと着地の間だけ描き直す
  if (!document.hidden && (state.intro !== 'done' || (moving && stageVisible()) || landing(now))) wake(); else state.prev = 0;
}

// ── 冒頭映像の見える位置：cover で横が切れる画面では、変身クリップの間だけあいちゃんを追う ──
function panCx(ft) {
  const P = config.introPan, seg = P.segs.find(([a, b]) => ft >= a && ft < b);
  if (!seg) return ft >= P.segs.at(-1)[1] ? P.keys.at(-1)[1] : 960;
  const st = seg[2] + (ft - seg[0]) / (seg[1] - seg[0]) * (seg[3] - seg[2]), K = P.keys;
  for (let i = 0; i < K.length - 1; i++) if (st <= K[i + 1][0]) return K[i][1] + (K[i + 1][1] - K[i][1]) * smooth((st - K[i][0]) / (K[i + 1][0] - K[i][0]));
  return K.at(-1)[1];
}
// 1920×1080 の映像を W×H に cover で置いたときの縮尺とずれ（中心 x を cx に寄せる）。px は object-position の横の割合
function coverGeo(W, H, cx) {
  const s = Math.max(W / 1920, H / 1080), vw = W / s, x0 = clamp(cx - vw / 2, 0, Math.max(0, 1920 - vw));
  return { s, ox: -x0 * s, oy: (H - 1080 * s) / 2, px: 1920 - vw > 0 ? x0 / (1920 - vw) : .5 };
}
function panFilm() { film.style.objectPosition = `${(coverGeo(innerWidth, innerHeight, panCx(film.currentTime)).px * 100).toFixed(2)}% 50%`; }

// ── 着地：冒頭映像を抜けたら、最終フレームの泡だけを残して外側を閉じ、泡を S1 の位置へ移す ──
function landing(now = performance.now()) {
  if (state.land0 == null) return null;
  const e = (now - state.land0) / 1000, L = config.landing, c = ramp(e, L.close[0], L.close[1]), m = ramp(e, L.move[0], L.move[1]);
  if (m >= 1) { state.land0 = null; return null; }
  return { c, m, geo: state.landGeo ?? coverGeo(SW(), SH(), config.introPan.keys.at(-1)[1]) };
}

// ── 動く文字：見出しを1文字ずつ span に分け、時間差で滑り込ませる ──
const copies = [...document.querySelectorAll('#copies article')];
copies.forEach((art) => {
  let n = 0;
  art.querySelectorAll('h1,h2,.eyebrow').forEach((el) => {
    const frag = document.createDocumentFragment();
    el.childNodes.forEach((node) => {
      if (node.nodeType !== 3) { frag.append(node.cloneNode(true)); return; }
      // 見出しは行（<br>・<wbr> の間）ごと、英字の小見出しは単語ごとにまとめて、途中で折り返さない
      const text = node.textContent.replace(/\n/g, '');
      const toks = el.matches('h1,h2') ? [text] : text.match(/[A-Za-z0-9&'.-]+|[^A-Za-z0-9&'.-]/g) || [];
      for (const tok of toks) {
        const w = document.createElement('span'); w.className = 'kw';
        for (const ch of tok) { const s = document.createElement('span'); s.className = 'k'; s.textContent = ch; s.style.setProperty('--i', n++); w.append(s); }
        frag.append(w);
      }
    });
    el.replaceChildren(frag);
  });
});
const win = ([a, b, c, d], q) => (a < 0 ? 1 : ramp(q, a, b)) * (1 - ramp(q, c, d));
// 最初のコピーは、着地（泡が S1 の位置へ移る）が進んでから出す
function copyOpacity(q, land) { return [win(sg.copy1, q) * (land ? smooth(land.m) : 1), win(sg.copy2, q), win(sg.copy3, q), ramp(q, sg.cta[0], sg.cta[1])]; }

// ── 描画 ──
let lastKey = '';
function render(force = false) {
  const land = landing(), q = state.q;
  if (state.ready && state.intro !== 'active' && stageVisible()) scene.draw(q, state.t, land);
  if (!ask.shown && state.ready && state.intro === 'done' && !land) showAsk();
  const key = `${q.toFixed(4)}|${land ? land.m.toFixed(3) : 1}`;
  if (!force && key === lastKey) return; lastKey = key;
  copyOpacity(q, land).forEach((o, i) => { const el = copies[i]; el.style.opacity = clamp(o * 1.6); el.inert = o < .5; el.classList.toggle('show', o > .25); el.style.setProperty('--exit', (1 - o).toFixed(3)); });
}

// ── 冒頭映像 ──
function introSrc() { return innerWidth < 900 ? config.media.introMobile : config.media.intro; } // 幅900未満は 720p 版（仕様 §6）
async function pickFilm() {
  try { const r = await fetch(introSrc(), { method: 'HEAD' }); if (r.ok && /video/.test(r.headers.get('content-type') || '')) { const v = $('#film'); v.hidden = false; v.src = introSrc(); return v; } } catch { /* 映像なし */ }
  return null;
}
// 自動再生が拒まれたら、画面のタップで再生できるようにする（背景タブでの一時停止＝AbortError は、表に出たときに再生し直す）
function playFilm() { film.play().catch((e) => { if (e?.name !== 'AbortError' && state.intro === 'active') status.textContent = '画面をタップすると再生します。「サイトへ進む」から先へ進めます。'; }); }
function startIntro() {
  if (!film) return;
  clearTimeout(state.fadeTimer); state.intro = 'active'; state.q = 0; state.t = 0; state.leaveRequested = false; state.land0 = null;
  setInert(true); intro.inert = false; intro.hidden = false; intro.classList.remove('leaving'); lock();
  window.scrollTo({ top: 0, behavior: 'instant' }); render(true);
  film.currentTime = 0; panFilm();
  playFilm(); // 端末の設定にかかわらず自動再生する（音声なし）
  wake();
}
function leaveIntro() {
  state.leaveRequested = true; if (state.intro !== 'active') return;
  if (!state.ready) { status.textContent = '場面を準備しています。'; return; }
  state.leaveRequested = false; state.intro = 'leaving'; state.t = 0; state.q = 0; film?.pause(); requestLoops();
  state.land0 = performance.now(); // 映像が消えていく間も、下では同じ最終フレームを描いている
  state.landGeo = coverGeo(SW(), SH(), config.introPan.keys.at(-1)[1]); // 映像と同じ切り取り（locked の間は舞台＝画面の幅）で固定する
  window.scrollTo({ top: 0, behavior: 'instant' }); setInert(false); intro.inert = true; render(true); intro.classList.add('leaving');
  state.fadeTimer = setTimeout(() => {
    state.intro = 'done'; intro.hidden = true; intro.classList.remove('leaving');
    if (film) { film.removeAttribute('src'); film.load(); }
    lock(); window.scrollTo({ top: 0, behavior: 'instant' }); wake();
  }, 650);
  wake();
}

// ── 準備 ──
async function prepare() {
  try {
    status.textContent = '';
    assets ??= await loadAssets();
    if (film === undefined) { film = await pickFilm(); if (film) { film.addEventListener('ended', leaveIntro); film.addEventListener('playing', () => { status.textContent = ''; }); if (state.intro === 'active' && !state.leaveRequested) startIntro(); } else if (state.intro === 'active') { state.intro = 'done'; intro.hidden = true; intro.inert = true; setInert(false); lock(); } }
    scene ??= new Scene($('#scene'), assets); state.ready = true; measure();
    if (state.leaveRequested) leaveIntro(); else wake();
    if (film && state.intro === 'active') { film.addEventListener('playing', requestLoops, { once: true }); setTimeout(requestLoops, 4000); } else requestLoops();
    if (deepLink && state.intro === 'done') deepLink.scrollIntoView({ behavior: 'instant' });
  } catch (e) { status.textContent = e.message; $('#retry').hidden = false; }
}
$('#retry').onclick = () => location.reload();
$('#skip').onclick = leaveIntro;
$('#film').addEventListener('click', () => { if (state.intro === 'active' && film?.paused) film.play().catch(() => {}); });
document.querySelectorAll('a[href="#top"]').forEach((a) => a.onclick = (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
addEventListener('scroll', () => { onScroll(); wake(); }, { passive: true });
addEventListener('resize', measure);
new ResizeObserver(() => { if (state.ready) measure(); }).observe(stage); // スクロールバーの出入りなど、window の resize が来ない変化
document.addEventListener('visibilitychange', () => { state.prev = 0; if (!document.hidden) { wake(); if (state.intro === 'active' && film) playFilm(); } else if (state.intro === 'active') film?.pause(); });
// 一時停止（舞台の動き・下部の浮遊）。旧版の #pause を引き継ぐ
function setPaused(v) {
  state.paused = v; state.prev = 0; root.classList.toggle('paused', v);
  pauseBtn.textContent = v ? '再開' : '一時停止'; pauseBtn.setAttribute('aria-pressed', String(v));
  wake();
}
pauseBtn.onclick = () => setPaused(!state.paused);
setPaused(false);

// ── AIに聞いてみる（右下）：訪問者が普段使っている ChatGPT・Claude を、質問を入れた状態で新しいタブで開く。このサイトからは何も送らない ──
const ask = { root: $('#ask'), panel: $('#askPanel'), toggle: $('#askToggle'), free: $('#askFree'), links: [$('#askGpt'), $('#askClaude')], shown: false };
$('#askPresets').innerHTML = config.ask.presets.map((q, i) => `<label class="ask-opt"><input type="radio" name="askq" value="${i}"${i ? '' : ' checked'}><span>${q}</span></label>`).join('');
ask.free.maxLength = config.ask.maxLen;
const askChoice = () => document.querySelector('input[name="askq"]:checked')?.value ?? '0';
const askQuestion = () => (askChoice() === 'free' ? ask.free.value.trim().slice(0, config.ask.maxLen) : config.ask.presets[+askChoice()]);
function askUpdate() {
  ask.free.hidden = askChoice() !== 'free';
  const q = askQuestion(), p = encodeURIComponent(config.ask.prompt(q, q !== config.ask.presets[0]));
  // 自分で書くを選んで空のときは押せない。中クリックなどで開かれても空の質問が送られないよう、外部の URL も入れない
  ask.links[0].href = q ? config.ask.chatgpt + p : '#askFree'; ask.links[1].href = q ? config.ask.claude + p : '#askFree';
  ask.links.forEach((a) => a.setAttribute('aria-disabled', String(!q)));
}
function setAskOpen(open, restoreFocus = true) {
  ask.panel.hidden = !open; ask.toggle.setAttribute('aria-expanded', String(open));
  if (open) (document.querySelector('input[name="askq"]:checked') || ask.free).focus(); else if (restoreFocus) ask.toggle.focus();
}
function showAsk() { if (ask.shown) return; ask.shown = true; ask.root.hidden = false; } // 冒頭映像と着地が終わってから浮かび上がる
ask.toggle.onclick = () => setAskOpen(ask.panel.hidden);
$('#askClose').onclick = () => setAskOpen(false);
ask.panel.addEventListener('change', askUpdate);
// 「自分で書く」をクリック・タップしたときだけ入力欄へ移る（矢印キーでの選択や、入力欄から出るときには移らない）
ask.panel.addEventListener('click', (e) => { if (e.detail > 0 && e.target.name === 'askq' && e.target.value === 'free') ask.free.focus(); });
ask.free.addEventListener('input', askUpdate);
ask.links.forEach((a) => a.addEventListener('click', (e) => { if (!askQuestion()) { e.preventDefault(); ask.free.focus(); } }));
ask.panel.querySelector('.ask-note a').addEventListener('click', () => setAskOpen(false, false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !e.isComposing && e.keyCode !== 229 && !ask.panel.hidden) setAskOpen(false); }); // 日本語の変換を取り消す Esc では閉じない
askUpdate();

// ── 下部セクションの出現（一度だけ）──
const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -10% 0px' });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// ── 確認用（コンソール）：hp.setQ(3.3)、hp.snapshot('paper-s1.png', {q:0, t:0}) ──
window.hp = {
  state, get scene() { return scene; }, landing, coverGeo, panCx,
  setQ(q) { window.scrollTo({ top: range * q / QMAX, behavior: 'instant' }); onScroll(); render(true); },
  async snapshot(name = 'paper-s1.png', opts = {}) { const blob = await scene.snapshot(1920, 1080, opts); render(true); const r = await fetch(`/upload?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob }); return r.text(); },
  leaveIntro, startIntro
};

if (state.intro === 'active') { setInert(true); intro.hidden = false; } else { intro.hidden = true; intro.inert = true; setInert(false); }
lock(); prepare();
