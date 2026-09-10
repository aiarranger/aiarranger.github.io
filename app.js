// 状態遷移：intro(active/leaving/done) → スクロールで3場面 → 海面の光 → 概要 → 無料相談
// ワークショップの state-and-performance recipe に沿い、動画・スクロール・描画の担当を分ける。
// 参考サイト（And Idea）の「動く文字」「ASCII変換」「マウスで傾く舞台」を上に重ねる。
import { config, clamp, smooth, mod } from './config.js';
import { loadAssets } from './assets.js';
import { Scene } from './scene.js';

const $ = s => document.querySelector(s), root = document.documentElement, main = $('#main'), intro = $('#intro'), status = $('#loadStatus');
const params = new URLSearchParams(location.search), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const QMAX = config.qMax;
const state = { intro: params.get('intro') === 'off' ? 'done' : 'active', ready: false, q: 0, t: 0, paused: reduced, tween: null, raf: 0, previous: 0, fadeTimer: 0, leaveRequested: false, nav: 0, pulse: 0, lastZone: -1 };
let scene, film, images, range = 1, lastQ = -1;

// ── ロック・ループ ──
function lock() { root.classList.toggle('locked', state.intro !== 'done'); }
function stopLoop() { cancelAnimationFrame(state.raf); state.raf = 0; state.previous = 0; }
function wake() { if (!state.raf && !document.hidden) state.raf = requestAnimationFrame(frame); }
function animateAllowed() { return state.ready && state.intro === 'done' && !state.paused && !document.hidden && state.q < QMAX - .001; }
function measure() { range = Math.max(1, $('#journey').offsetHeight - innerHeight); scene?.resize(); ascii.resize(); render(true); wake(); }
function scrollForQ(q) { return range * q / QMAX; }
function setQ(q, { scroll = true } = {}) {
  state.q = clamp(q, 0, QMAX);
  if (scroll && state.intro === 'done') window.scrollTo({ top: scrollForQ(state.q), behavior: 'instant' });
  render(); wake();
}
function journeyTo(target, seconds = 1.2) {
  state.nav++; if (state.intro !== 'done') cancelIntro();
  state.paused = false; $('#pause').textContent = '一時停止';
  state.tween = { from: state.q, to: target, elapsed: 0, duration: reduced ? .01 : seconds }; wake();
}
function cancelTween() { state.tween = null; }

function frame(now) {
  state.raf = 0;
  if (state.previous && now - state.previous < 1000 / 60 - .5) { wake(); return; }
  const dt = state.previous ? Math.min((now - state.previous) / 1000, .05) : 0; state.previous = now;
  if (!state.paused && state.intro === 'done') {
    if (state.tween) {
      const tw = state.tween; tw.started ??= now; tw.elapsed = (now - tw.started) / 1000; const p = clamp(tw.elapsed / tw.duration); // 実時間で進める
      if (tw.demo) {
        const keys = [[0, 0], [.18, .5], [.3, 1.12], [.45, 1.5], [.58, 2.16], [.7, 2.5], [.85, 3.1], [1, QMAX]];
        let i = 1; while (i < keys.length - 1 && p > keys[i][0]) i++;
        const a = keys[i - 1], b = keys[i]; state.q = a[1] + (b[1] - a[1]) * smooth((p - a[0]) / (b[0] - a[0]));
      } else state.q = tw.from + (tw.to - tw.from) * smooth(p);
      window.scrollTo({ top: scrollForQ(state.q), behavior: 'instant' });
      if (p === 1) state.tween = null;
    }
    if (animateAllowed()) state.t += dt;
  }
  render();
  if (animateAllowed() || (state.tween && !state.paused && !document.hidden) || ascii.active() || (root.dataset.landing === 'surface' && state.q > 2.9 && state.q < 3.4 && !state.paused)) wake(); else state.previous = 0;
}

// ── 動く文字：見出しを1文字ずつ span に分け、出現は時間差で滑り込み、退場は記号の粒になって散る ──
const SYMBOLS = '+*#:=/\\|<>{}[]';
const copies = $('#copies').querySelectorAll('article');
copies.forEach(art => {
  let n = 0;
  art.querySelectorAll('h1,h2,.eyebrow').forEach(el => {
    const frag = document.createDocumentFragment();
    el.childNodes.forEach(node => {
      if (node.nodeType !== 3) { frag.append(node.cloneNode(true)); return; }
      for (const ch of node.textContent) {
        if (ch === '\n') continue;
        const s = document.createElement('span'); s.className = 'k'; s.dataset.ch = ch; s.textContent = ch; s.style.setProperty('--i', n++); frag.append(s);
      }
    });
    el.replaceChildren(frag);
  });
});
function setCopyState(art, on) {
  if (art.dataset.on === String(on)) return; art.dataset.on = on;
  const ks = art.querySelectorAll('.k');
  if (on) { ks.forEach(k => { k.textContent = k.dataset.ch; k.style.removeProperty('--dx'); k.style.removeProperty('--dy'); k.style.removeProperty('--r'); }); art.classList.remove('dissolve'); art.classList.add('show'); }
  else {
    art.classList.remove('show'); art.classList.add('dissolve');
    ks.forEach(k => { if (config.copySymbols && k.dataset.ch.trim()) k.textContent = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]; k.style.setProperty('--dx', `${Math.random() * 120 - 60}px`); k.style.setProperty('--dy', `${Math.random() * 90 - 30}px`); k.style.setProperty('--r', `${Math.random() * 60 - 30}deg`); });
  }
}

// ── ASCII変換：場面の切り替わりで、舞台の絵を一瞬だけ記号の集まりにする ──
const ascii = {
  canvas: $('#ascii'), ctx: $('#ascii').getContext('2d'), sample: document.createElement('canvas'), start: 0,
  resize() { this.canvas.width = innerWidth; this.canvas.height = innerHeight; },
  pulse() { if (reduced || !config.ascii.enabled) return; this.start = performance.now(); wake(); },
  active() { return this.start && performance.now() - this.start < config.ascii.pulseMs; },
  draw() {
    const ctx = this.ctx, cv = this.canvas;
    if (!this.active()) { if (this.start) { ctx.clearRect(0, 0, cv.width, cv.height); this.start = 0; } return; }
    const p = (performance.now() - this.start) / config.ascii.pulseMs, a = Math.sin(Math.PI * p);
    const cell = innerWidth < 750 ? config.ascii.cellMobile : config.ascii.cell, cols = Math.ceil(cv.width / cell), rows = Math.ceil(cv.height / cell);
    this.sample.width = cols; this.sample.height = rows;
    const sctx = this.sample.getContext('2d', { willReadFrequently: true }); sctx.drawImage(scene.canvas, 0, 0, cols, rows);
    const d = sctx.getImageData(0, 0, cols, rows).data, chars = config.ascii.chars;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = `rgba(6,18,38,${.85 * a})`; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.font = `${cell}px ui-monospace,Menlo,monospace`; ctx.textBaseline = 'top';
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4, lum = (d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11) / 255;
      const ch = chars[Math.min(chars.length - 1, Math.floor(lum * chars.length))]; if (ch === ' ') continue;
      ctx.fillStyle = lum > .6 ? `rgba(244,241,232,${a})` : `rgba(119,201,189,${a * (.4 + lum)})`;
      ctx.fillText(ch, x * cell, y * cell);
    }
  }
};

// ── 描画：WebGLは毎フレーム、DOMはqが変わったときだけ ──
const particleNodes = Array.from({ length: 38 }, () => { const i = document.createElement('i'); $('#particles').append(i); return i; });
function render(force = false) {
  if (state.ready && state.intro !== 'active') scene.draw(state.q, state.t); // 映像が消えていく間も場面を描いておく
  const q = state.q;
  if (force || Math.abs(lastQ - q) > .0001) {
    lastQ = q;
    // 各コピーの表示区間。場面の切り替わり（q≈.85/1.85/2.85）の直前まで残し、次の場面に入ってすぐ出す
    const op = [1 - smooth((q - .72) / .22), smooth((q - .88) / .18) * (1 - smooth((q - 1.72) / .2)), smooth((q - 1.88) / .18) * (1 - smooth((q - 2.72) / .2)), smooth((q - 3.0) / .22)];
    copies.forEach((el, i) => { el.style.opacity = clamp(op[i] * 2); el.inert = op[i] < .5; setCopyState(el, op[i] > .3); });
    document.querySelectorAll('[data-chapter]').forEach((b, i) => b.classList.toggle('active', Math.min(2, Math.floor(q)) === i));
    landingRender(q);
    $('#shade').style.opacity = 1 - smooth((q - 2.9) / .3);
    const paperLanding = root.dataset.theme !== 'sea' && q > 3.15; $('#sceneControls').classList.toggle('light', paperLanding); root.classList.toggle('light', paperLanding);
    root.classList.toggle('past', scrollY > range + 10); // 舞台を過ぎたらヘッダーを帯にする
    const zone = q < .85 ? 0 : q < 1.85 ? 1 : q < 2.85 ? 2 : 3; // 場面の境界を越えた瞬間にASCIIパルス
    if (state.lastZone >= 0 && zone !== state.lastZone && state.intro === 'done') ascii.pulse();
    state.lastZone = zone;
  }
  if (state.ready && state.intro !== 'active') ascii.draw();
  const density = q < .8 ? .5 : q < 1.9 ? .7 : q < 2.9 ? .35 : 0;
  $('#particles').style.opacity = String(density);
  if (density > 0 && state.intro !== 'active') particleNodes.forEach((n, i) => {
    const x = mod(i * .6180339, 1) * innerWidth + Math.sin(state.t * .3 + i) * 15, y = mod(i * .372 - state.t * .03, 1) * innerHeight;
    n.style.transform = `translate(${x}px,${y}px)`; n.style.width = n.style.height = (3 + i % 6) + 'px';
  });
}

// ── 着地の演出：深海（暗）→ 無料相談（紙色）への移り方（?landing=名前 / 画面の選択） ──
const landingSelect = $('#landing'), surface = $('#surface'), light = $('#light');
for (const [k, v] of Object.entries(config.landings)) { const o = document.createElement('option'); o.value = k; o.textContent = v.label; landingSelect.append(o); }
function applyLanding(name) {
  if (!config.landings[name]) name = config.landing; root.dataset.landing = name; landingSelect.value = name;
  surface.style.clipPath = ''; surface.style.opacity = ''; light.style.opacity = '';
  if (params.has('dev')) { const u = new URL(location.href); u.searchParams.set('landing', name); history.replaceState(null, '', u); } render(true);
}
landingSelect.onchange = () => applyLanding(landingSelect.value);
function landingRender(q) {
  const mode = root.dataset.landing, s = smooth((q - 2.95) / .42), t = state.t;
  if (root.dataset.theme === 'sea') { // 海のまま：上からの光と、左の暗い帯だけ
    light.style.opacity = smooth((q - 2.5) / .6); surface.style.opacity = smooth((q - 2.95) / .35); surface.style.clipPath = ''; return;
  }
  if (mode === 'glow') {
    light.style.opacity = smooth((q - 2.5) / .55); surface.style.opacity = q > 2.9 ? 1 : 0;
    root.style.setProperty('--sv', s.toFixed(4)); // 紙色が上から下へ、柔らかい境界で降りてくる
  } else if (mode === 'surface') {
    light.style.opacity = smooth((q - 2.7) / .5) * .6; surface.style.opacity = q > 2.9 ? 1 : 0;
    const base = -.16 + 1.32 * s, pts = ['0% 0%', '100% 0%'];
    for (let i = 20; i >= 0; i--) { const x = i / 20; pts.push(`${(x * 100).toFixed(1)}% ${((base + .035 * Math.sin(x * 9 + t * 1.6) + .02 * Math.sin(x * 17 - t * 1.1)) * 100).toFixed(1)}%`); }
    surface.style.clipPath = `polygon(${pts.join(',')})`; // 波打つ水面の境界
  } else {
    light.style.opacity = 0; surface.style.opacity = smooth((q - 3.02) / .3);
  }
}

// ── 色パターン：環境レイヤーの限定色を切り替える（?palette=名前 / 画面の選択） ──
const paletteSelect = $('#palette');
for (const [k, v] of Object.entries(config.palettes)) { const o = document.createElement('option'); o.value = k; o.textContent = v.label; paletteSelect.append(o); }
function applyPalette(name) {
  if (!scene) return; scene.setPalette(name); const p = scene.palette; paletteSelect.value = scene.paletteName;
  root.style.setProperty('--deep', p.dark); root.style.setProperty('--mid', p.mid); root.style.setProperty('--teal', p.accent); root.dataset.palette = scene.paletteName;
  if (params.has('dev')) { const u = new URL(location.href); u.searchParams.set('palette', scene.paletteName); history.replaceState(null, '', u); }
  render(true);
}
paletteSelect.onchange = () => applyPalette(paletteSelect.value);
if (!params.has('dev')) { $('#sceneControls').hidden = true; $('#filmPlay').hidden = true; } // 操作列（一時停止・デモ・章・色・着地）は ?dev=1 のときだけ表示。公開版は映像の「サイトへ進む」のみ
// 映像の終景用：場面1の初期構図を 1920×1080 で描き、ローカル配信サーバーへ保存する
async function snapshot(name = `end-frame-${scene.paletteName}.png`) {
  const blob = await scene.snapshot(1920, 1080); render(true);
  const r = await fetch(`/upload?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
  return r.text();
}

// ── マウスで舞台が少し傾く ──
$('#stage').addEventListener('pointermove', e => {
  if (reduced || e.pointerType === 'touch') return;
  root.style.setProperty('--tx', ((e.clientX / innerWidth) * 2 - 1).toFixed(3)); root.style.setProperty('--ty', ((e.clientY / innerHeight) * 2 - 1).toFixed(3));
});
$('#stage').addEventListener('pointerleave', () => { root.style.setProperty('--tx', 0); root.style.setProperty('--ty', 0); });

// ── 冒頭映像（Vidu 3本を編集した assets/media/intro.mp4）。無ければ映像を省いて場面1から ──
async function pickFilm() {
  try {
    const r = await fetch(config.introVideo, { method: 'HEAD' });
    if (r.ok && /video/.test(r.headers.get('content-type') || '')) { const v = $('#film'); v.hidden = false; v.src = config.introVideo; return v; }
  } catch { /* 生成映像なし */ }
  return null;
}
function bindFilm() {
  film.addEventListener('ended', leaveIntro);
  film.addEventListener('timeupdate', () => { $('#filmProgress').style.width = (film.duration ? film.currentTime / film.duration * 100 : 0) + '%'; });
  film.addEventListener('play', () => $('#filmPlay').textContent = '一時停止');
  film.addEventListener('pause', () => $('#filmPlay').textContent = '再生');
  film.addEventListener('error', () => { status.textContent = '冒頭映像を読み込めません。'; });
}
function startIntro() {
  if (!film) return;
  clearTimeout(state.fadeTimer); cancelTween(); state.nav++;
  state.intro = 'active'; state.q = 0; state.t = 0; state.leaveRequested = false; state.lastZone = -1;
  main.inert = true; intro.inert = false; intro.hidden = false; intro.classList.remove('leaving'); lock();
  window.scrollTo({ top: 0, behavior: 'instant' }); render(true); stopLoop();
  if (!film.getAttribute('src')) film.src = config.introVideo;
  film.currentTime = 0;
  if (!reduced) film.play().catch(() => { status.textContent = '再生ボタンから映像を始められます。'; }); else status.textContent = '端末の設定により自動再生を控えています。「サイトへ進む」で先へ進めます。';
}
function leaveIntro() {
  state.leaveRequested = true; if (state.intro !== 'active') return;
  if (!state.ready) { status.textContent = '場面を準備しています。'; return; }
  state.leaveRequested = false; state.intro = 'leaving'; state.t = 0; state.q = 0; cancelTween(); film?.pause();
  window.scrollTo({ top: 0, behavior: 'instant' }); main.inert = false; intro.inert = true; render(true); intro.classList.add('leaving');
  const nav = state.nav;
  state.fadeTimer = setTimeout(() => {
    state.intro = 'done'; intro.hidden = true; intro.classList.remove('leaving');
    if (film) { film.removeAttribute('src'); film.load(); }
    lock(); if (state.nav === nav) window.scrollTo({ top: 0, behavior: 'instant' }); ascii.pulse(); wake();
  }, 950);
}
function cancelIntro() {
  clearTimeout(state.fadeTimer); film?.pause(); intro.hidden = true; intro.inert = true; intro.classList.remove('leaving');
  state.intro = 'done'; main.inert = false; lock();
}

// ── 準備 ──
async function prepare() {
  state.ready = false; $('#retry').hidden = true;
  try {
    status.textContent = '素材を読み込んでいます。';
    images ??= await loadAssets();
    if (film === undefined) {
      film = await pickFilm();
      if (film) { bindFilm(); if (state.intro === 'active') startIntro(); }
      else { $('#replay').hidden = true; if (state.intro === 'active') cancelIntro(); }
    }
    scene ??= new Scene($('#scene'), images); root.dataset.theme = params.get('theme') === 'paper' ? 'paper' : 'sea'; applyPalette(params.get('palette') || config.palette); applyLanding(params.get('landing') || config.landing); scene.draw(0, 0); state.ready = true; status.textContent = '';
    render(true); if (state.leaveRequested) leaveIntro(); else wake();
  } catch (e) {
    status.textContent = e.message; $('#retry').hidden = false;
    if (state.intro === 'done') { intro.hidden = false; intro.inert = false; $('#filmPlay').hidden = true; $('#skip').hidden = true; }
  }
}
$('#retry').onclick = () => location.reload();

// ── 操作 ──
$('#filmPlay').onclick = () => film && (film.paused ? film.play().catch(() => status.textContent = '映像を再生できません。') : film.pause());
$('#skip').onclick = leaveIntro; $('#replay').onclick = startIntro;
$('#pause').onclick = () => { state.paused = !state.paused; $('#pause').textContent = state.paused ? '再開' : '一時停止'; state.previous = 0; if (state.paused) stopLoop(); else wake(); };
$('#pause').textContent = state.paused ? '再開' : '一時停止';
$('#demo').onclick = () => { if (state.intro !== 'done') cancelIntro(); state.paused = false; $('#pause').textContent = '一時停止'; state.q = 0; window.scrollTo({ top: 0, behavior: 'instant' }); state.tween = { demo: true, elapsed: 0, duration: config.demoSeconds }; wake(); };
$('#copyToggle').onclick = () => { root.classList.toggle('copies-hidden'); $('#copyToggle').textContent = root.classList.contains('copies-hidden') ? '文字を表示' : '文字を隠す'; };
document.querySelectorAll('[data-chapter]').forEach(b => b.onclick = () => journeyTo(Number(b.dataset.chapter) + .16));
$('#next').onclick = () => { if (state.q < .7) journeyTo(1.16, 3); else if (state.q < 1.7) journeyTo(2.16, 3); else if (state.q < 3.2) journeyTo(QMAX, 4); else document.querySelector('#services').scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' }); };
document.querySelectorAll('a[href="#top"]').forEach(a => a.onclick = e => { e.preventDefault(); journeyTo(0, 1.5); });

addEventListener('scroll', () => { if (state.intro === 'done' && !state.tween) setQ(scrollY / range * QMAX, { scroll: false }); }, { passive: true });
for (const event of ['wheel', 'touchstart']) addEventListener(event, cancelTween, { passive: true });
addEventListener('keydown', e => { if (['ArrowUp', 'ArrowDown', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) cancelTween(); });
addEventListener('resize', measure);
document.addEventListener('visibilitychange', () => { state.previous = 0; if (document.hidden) { stopLoop(); if (state.intro === 'active') film?.pause(); } else { wake(); if (state.intro === 'active' && !reduced) film?.play().catch(() => {}); } });

// 概要セクションの出現
const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -12% 0px' });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// 改善・確認用の入口（ブラウザのコンソールから時刻や進行を直接動かせる）
window.hp = { state, setQ, render, ascii, applyPalette, applyLanding, snapshot, get film() { return film; }, get scene() { return scene; }, leaveIntro, startIntro };

measure();
if (state.intro === 'active') { main.inert = true; intro.hidden = false; lock(); }
else { intro.hidden = true; intro.inert = true; main.inert = false; lock(); }
prepare();
