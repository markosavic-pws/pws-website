// Wheel of Mix-Ins: spin the wheel image a random amount; the pointer at the top picks the winner.
(() => {
  const wheel = document.getElementById('wheel');
  const btn = document.getElementById('spin');
  if (!wheel || !btn) return;
  let angle = 0;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  btn.addEventListener('click', () => {
    angle += 360 * (still ? 0 : 5 + Math.floor(Math.random() * 3)) + Math.random() * 360;
    wheel.style.transition = still ? 'none' : 'transform 4.5s cubic-bezier(.12,.67,.1,1)';
    wheel.style.transform = `rotate(${angle}deg)`;
    btn.disabled = true;
    btn.textContent = 'Spinning…';
    setTimeout(() => { btn.disabled = false; btn.textContent = 'Spin again'; }, still ? 0 : 4600);
  });
})();
