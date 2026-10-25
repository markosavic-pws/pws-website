// Theme song players (templates/_themesongs.html): one <audio> per player, playing every track in
// order. Tap a track to jump to it. Only one player plays at a time.
(() => {
  const players = [...document.querySelectorAll('[data-theme-songs]')];
  const fmt = s => isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00';
  players.forEach(root => {
    const $ = s => root.querySelector(s);
    const ui = $('.ts-player'), audio = $('audio'), play = $('.ts-play'), seek = $('.ts-seek');
    const links = [...root.querySelectorAll('.ts-track')];
    let i = 0, seeking = false;
    ui.hidden = false;
    const show = () => {
      const a = links[i];
      $('.ts-num').textContent = i + 1;
      $('.ts-title strong').textContent = a.textContent.replace(/^\s*\d+\s*/, '');
      links.forEach((l, k) => l.toggleAttribute('aria-current', k === i));
    };
    const load = (k, start) => {
      i = (k + links.length) % links.length;
      audio.src = links[i].href;
      show();
      if (start) audio.play().catch(() => {});
    };
    play.addEventListener('click', () => {
      if (!audio.src) load(0, true);
      else if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    });
    $('.ts-prev').addEventListener('click', () => load(audio.currentTime > 3 ? i : i - 1, true));
    $('.ts-next').addEventListener('click', () => load(i + 1, true));
    links.forEach((a, k) => a.addEventListener('click', e => { e.preventDefault(); load(k, true); }));
    audio.addEventListener('play', () => {
      root.classList.add('is-playing'); play.setAttribute('aria-label', 'Pause');
      players.forEach(p => { if (p !== root) p.querySelector('audio').pause(); });
    });
    audio.addEventListener('pause', () => { root.classList.remove('is-playing'); play.setAttribute('aria-label', 'Play'); });
    // play them all: on to the next song, and stop after the last one
    audio.addEventListener('ended', () => { if (i + 1 < links.length) load(i + 1, true); });
    audio.addEventListener('timeupdate', () => {
      if (!seeking && audio.duration) seek.value = Math.round(1000 * audio.currentTime / audio.duration);
      $('.ts-time').textContent = fmt(audio.currentTime);
    });
    seek.addEventListener('input', () => { seeking = true; });
    seek.addEventListener('change', () => {
      if (!audio.src) load(i, false);
      const go = () => { audio.currentTime = seek.value / 1000 * audio.duration; seeking = false; };
      audio.duration ? go() : audio.addEventListener('loadedmetadata', go, { once: true });
    });
    show();
  });
})();
