// 実績ページの動画：画面に入っている間だけ音なしで再生し、外れたら止める。押す（Enter・Space）と一時停止・再開できる
// 「動きを減らす」設定のときは自動では再生せず、表紙画像のまま止めておく（押せば再生できる）
const vids = [...document.querySelectorAll('video[data-autoplay]')];
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const io = new IntersectionObserver((es) => es.forEach((e) => {
  const v = e.target;
  if (e.isIntersecting && !v.dataset.userPaused) { v.preload = 'auto'; v.play().catch(() => {}); } else v.pause();
}), { threshold: .35 });
const toggle = (v) => { if (v.paused) { delete v.dataset.userPaused; v.play().catch(() => {}); } else { v.dataset.userPaused = '1'; v.pause(); } };
vids.forEach((v) => {
  if (still) v.dataset.userPaused = '1';
  io.observe(v);
  v.addEventListener('click', () => toggle(v));
  v.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(v); } });
});
