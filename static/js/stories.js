// What I'm Eating + The House: timeline strip, filters, and an Instagram-style story viewer.
// Without JavaScript every tile is a plain link to its page, so nothing here is required.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- videos on normal pages: play (muted) only while on screen ----
  const io = 'IntersectionObserver' in window && new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting && !still) e.target.play().catch(() => {}); else e.target.pause(); });
  }, { threshold: 0.6 });
  if (io) $$('main video').forEach(v => io.observe(v));

  // ---- timeline: open with the newest moment centred, arrows, filters + search ----
  const tl = $('#timeline');
  const centreNewest = () => {
    const items = $$('.tl-item:not([hidden])', tl);
    const last = items[items.length - 1];
    if (!last) return;
    const r = last.getBoundingClientRect(), box = tl.getBoundingClientRect();   // works inside trip groups too
    tl.scrollLeft += (r.left + r.width / 2) - (box.left + box.width / 2);
  };
  if (tl) {
    // focus ring on the strip for keyboard users only (a tap on iOS also focuses it)
    let keyboard = false;
    addEventListener('keydown', e => { if (e.key === 'Tab') keyboard = true; }, true);
    addEventListener('pointerdown', () => { keyboard = false; }, true);
    tl.addEventListener('focus', () => tl.classList.toggle('kb-focus', keyboard));
    tl.addEventListener('blur', () => tl.classList.remove('kb-focus'));
    centreNewest();
    addEventListener('load', centreNewest);
    // once you scroll away, a "Newest" button brings today's moment back to the centre
    const today = $('.tl-today');
    const goNewest = () => {
      const items = $$('.tl-item:not([hidden])', tl), last = items[items.length - 1];
      if (!last) return;
      const r = last.getBoundingClientRect(), box = tl.getBoundingClientRect();
      scrollByX((r.left + r.width / 2) - (box.left + box.width / 2));
    };
    today?.addEventListener('click', goNewest);
    tl.addEventListener('scroll', () => {
      const items = $$('.tl-item:not([hidden])', tl), last = items[items.length - 1];
      if (!today || !last) return;
      const r = last.getBoundingClientRect(), box = tl.getBoundingClientRect();
      today.hidden = Math.abs((r.left + r.width / 2) - (box.left + box.width / 2)) < r.width;
    }, { passive: true });
    // smooth where the browser animates it; jump if it didn't move (some background tabs never animate)
    const scrollByX = dx => {
      const start = tl.scrollLeft;
      tl.scrollBy({ left: dx, behavior: still ? 'auto' : 'smooth' });
      setTimeout(() => { if (Math.abs(tl.scrollLeft - start) < 1 && Math.abs(dx) > 1) tl.scrollLeft = start + dx; }, 500);
    };
    // the arrows move one story at a time: centre the story next to the one in the middle now
    const step = dir => {
      const items = $$('.tl-item:not([hidden])', tl);
      if (!items.length) return;
      const box = tl.getBoundingClientRect(), mid = box.left + box.width / 2;
      const centre = el => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; };
      const now = items.reduce((best, el) => Math.abs(centre(el) - mid) < Math.abs(centre(best) - mid) ? el : best);
      const target = items[Math.min(items.length - 1, Math.max(0, items.indexOf(now) + dir))];
      scrollByX(centre(target) - mid);
    };
    $('.tl-older')?.addEventListener('click', () => step(-1));
    $('.tl-newer')?.addEventListener('click', () => step(1));
    // hide an arrow when there's nothing further that way (newest or oldest story centred)
    const arrows = () => {
      const items = $$('.tl-item:not([hidden])', tl);
      const box = tl.getBoundingClientRect(), mid = box.left + box.width / 2;
      const off = el => { if (!el) return 0; const r = el.getBoundingClientRect(); return r.left + r.width / 2 - mid; };
      const older = $('.tl-older'), newer = $('.tl-newer');
      if (older) older.hidden = !items.length || off(items[0]) > -8 || tl.scrollLeft < 2;
      if (newer) newer.hidden = !items.length || off(items[items.length - 1]) < 8 || tl.scrollLeft > tl.scrollWidth - tl.clientWidth - 2;
    };
    tl.addEventListener('scroll', arrows, { passive: true });
    addEventListener('resize', arrows);
    addEventListener('load', arrows);
    arrows();
    const chips = $$('.tl-filters [data-filter]');
    const search = $('#tl-search');
    let filter = 'all';
    const apply = () => {
      const words = (search?.value || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
      let shown = 0;
      $$('.tl-item', tl).forEach(li => {
        const f = filter;
        const byChip = f === 'all' || (f === 'home' && li.dataset.where === 'home') || (f === 'out' && li.dataset.where === 'out')
          || (f === 'recipe' && li.dataset.recipe === '1') || (f.startsWith('tag:') && li.dataset.tags.includes('|' + f.slice(4) + '|'))
          || (f.startsWith('year:') && (li.dataset.month || '').startsWith(f.slice(5)))
          || (f.startsWith('month:') && li.dataset.month === f.slice(6));
        const byText = words.every(w => li.dataset.search.includes(w));
        li.hidden = !(byChip && byText);
        if (!li.hidden) shown++;
      });
      // the tag list narrows as you type, too
      $$('.tag-chips button').forEach(b => { b.hidden = !!words.length && !words.every(w => b.dataset.filter.toLowerCase().includes(w)) && b.getAttribute('aria-pressed') !== 'true'; });
      $$('.tl-month', tl).forEach(m => { m.hidden = filter !== 'all' || words.length > 0; });
      $$('.tl-trip', tl).forEach(g => { g.hidden = !$$('.tl-item:not([hidden])', g).length; });
      $('#tl-empty') && ($('#tl-empty').hidden = shown > 0);
      centreNewest();
      arrows();
    };
    chips.forEach(c => c.addEventListener('click', () => {
      filter = c.dataset.filter;
      chips.forEach(x => x.setAttribute('aria-pressed', String(x === c)));
      // date filter: picking a year reveals its months; a month keeps its year highlighted
      const year = filter.startsWith('year:') ? filter.slice(5) : filter.startsWith('month:') ? filter.slice(6, 10) : null;
      $$('.tl-filters [data-filter^="month:"]').forEach(m => { m.hidden = !year || !m.dataset.filter.startsWith('month:' + year); });
      if (filter.startsWith('month:')) $$('.tl-filters [data-filter="year:' + year + '"]').forEach(y => y.setAttribute('aria-pressed', 'true'));
      apply();
    }));
    search?.addEventListener('input', apply);
  }

  // ---- house week: room filter ----
  $$('[data-room]').filter(b => b.tagName === 'BUTTON').forEach((b, _, all) => b.addEventListener('click', () => {
    all.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $$('.week-tile').forEach(t => { t.hidden = !!b.dataset.room && t.dataset.room !== b.dataset.room; });
  }));

  // ---- story viewer ----
  const dataEl = $('#stories-data');
  const dlg = $('#viewer');
  if (!dataEl || !dlg || !dlg.showModal) return;
  const stories = JSON.parse(dataEl.textContent);
  const PHOTO_MS = 5000;
  let s = 0, m = 0, timer = null, started = 0, paused = false, remaining = PHOTO_MS;
  let pinned = false;   // paused with the button: stays paused while you step through
  const pauseBtn = $('.viewer-pause', dlg);
  // sound: off until you turn it on (browsers only autoplay muted video), then on for every video
  const soundBtn = $('.viewer-sound', dlg);
  let sound = false;
  try { sound = sessionStorage.getItem('pws-sound') === 'on'; } catch (e) {}
  function setSound(on) {
    sound = on;
    try { sessionStorage.setItem('pws-sound', on ? 'on' : 'off'); } catch (e) {}
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.setAttribute('aria-label', on ? 'Mute' : 'Turn sound on');
    dlg.classList.toggle('has-sound', on);
    const v = $('video', stage);
    if (v) v.muted = !on;
  }
  soundBtn.addEventListener('click', () => setSound(!sound));
  soundBtn.setAttribute('aria-pressed', String(sound));
  soundBtn.setAttribute('aria-label', sound ? 'Mute' : 'Turn sound on');
  dlg.classList.toggle('has-sound', sound);
  const setPinned = on => {
    pinned = on;
    pauseBtn.setAttribute('aria-pressed', String(on));
    pauseBtn.setAttribute('aria-label', on ? 'Play' : 'Pause');
    dlg.classList.toggle('is-paused', on);
    pause(on);
  };

  const bars = $('.viewer-bars', dlg), stage = $('.viewer-media', dlg);
  const fill = i => bars.children[i]?.firstElementChild;

  function render() {
    clearTimeout(timer);
    const st = stories[s], item = st.media[m], ch = st.chapters[item.ch || 0];
    // house stories: landscape photos spread across the screen; portrait ones keep the story column
    dlg.classList.toggle('is-wide', !!st.wide && (item.w || 0) > (item.h || 0));
    // a trip shows the stop's name, with the trip as the subtitle
    $('.viewer-title', dlg).textContent = ch.title;
    $('.viewer-sub', dlg).textContent = [st.trip ? st.title : ch.trip, ch.date, ch.where].filter(Boolean).join(' · ');
    $('.viewer-credit', dlg).textContent = [ch.credit, ch.rating && `My rating: ${ch.rating}`].filter(Boolean).join(' · ');
    const cap = $('.viewer-caption', dlg);
    const own = [item.title, item.caption].filter(Boolean).join(': ');
    cap.innerHTML = own ? '' : ch.caption;   // entry captions are our own HTML from Markdown
    if (own) cap.textContent = (item.room ? item.room + ': ' : '') + own;
    const rec = $('.viewer-recipe', dlg);
    rec.hidden = !ch.recipe;
    if (ch.recipe) rec.href = ch.recipe.url;
    const link = $('.viewer-link', dlg);
    link.href = ch.url;
    // house weeks have nothing to read until Marko writes a summary
    // no "Read more" for the page you're on (travel moments live on their trip page), or for unwritten house weeks
    link.hidden = location.pathname === ch.url.split('#')[0] || (st.wide && !(ch.caption || '').trim());
    bars.innerHTML = st.media.map((_, i) => `<span><i style="width:${i < m ? 100 : 0}%"></i></span>`).join('');
    stage.innerHTML = '';
    let el;
    if (item.type === 'video') {
      el = Object.assign(document.createElement('video'), { src: item.src, poster: item.poster || '', muted: !sound, playsInline: true, loop: pinned });
      // with sound on, some browsers refuse to autoplay; fall back to muted rather than not playing
      if (!pinned) el.play().catch(() => { el.muted = true; setSound(false); el.play().catch(() => {}); });
      el.addEventListener('timeupdate', () => { const f = fill(m); if (f && el.duration) f.style.width = (100 * el.currentTime / el.duration) + '%'; });
      el.addEventListener('ended', next);
    } else {
      el = Object.assign(document.createElement('img'), { src: item.src, alt: item.caption || st.title });
      remaining = PHOTO_MS;
      if (!pinned) startPhotoTimer();
    }
    stage.append(el);
    soundBtn.hidden = item.type !== 'video';
    // warm the next photo
    const nx = st.media[m + 1] || stories[s + 1]?.media[0];
    if (nx && nx.type === 'photo') new Image().src = nx.src;
  }
  function startPhotoTimer() {
    started = performance.now();
    const f = fill(m);
    if (f) { f.style.transition = 'none'; f.style.width = (100 * (1 - remaining / PHOTO_MS)) + '%'; f.offsetWidth;
      f.style.transition = still ? 'none' : `width ${remaining}ms linear`; f.style.width = '100%'; }
    timer = setTimeout(next, remaining);
  }
  function pause(on) {
    paused = on;
    const v = $('video', stage);
    if (v) { on ? v.pause() : v.play().catch(() => {}); return; }
    if (on) { clearTimeout(timer); remaining -= performance.now() - started;
      const f = fill(m); if (f) { f.style.width = getComputedStyle(f).width; f.style.transition = 'none'; } }
    else startPhotoTimer();
  }
  function next() {
    if (m + 1 < stories[s].media.length) m++;
    else if (s + 1 < stories.length) { s++; m = 0; }
    else return close();
    render();
  }
  function prev() {
    if (m > 0) m--;
    else if (s > 0) { s--; m = stories[s].media.length - 1; }
    render();
  }
  function open(si, mi = 0) { s = si; m = mi; pinned = false; paused = false; pauseBtn.setAttribute('aria-pressed', 'false'); pauseBtn.setAttribute('aria-label', 'Pause'); dlg.classList.remove('is-paused'); dlg.showModal(); document.body.classList.add('viewing'); render(); }
  function close() { clearTimeout(timer); stage.innerHTML = ''; dlg.close(); document.body.classList.remove('viewing'); }

  let suppress = false;  // releasing a press-and-hold resumes; it shouldn't also skip
  $('.viewer-next', dlg).addEventListener('click', () => { if (suppress) suppress = false; else next(); });
  $('.viewer-prev', dlg).addEventListener('click', () => { if (suppress) suppress = false; else prev(); });
  $('.viewer-close', dlg).addEventListener('click', close);
  // in the wide layout the photo extends past the tap zones: tap its left or right half
  stage.addEventListener('click', e => {
    if (!dlg.classList.contains('is-wide') || suppress) return;
    const r = stage.getBoundingClientRect();
    (e.clientX < r.left + r.width * 0.35 ? prev : next)();
  });
  pauseBtn.addEventListener('click', () => setPinned(!pinned));
  // 'close' fires asynchronously; if a story was reopened in the meantime, leave it alone
  dlg.addEventListener('close', () => { if (dlg.open) return; clearTimeout(timer); stage.innerHTML = ''; document.body.classList.remove('viewing'); });
  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === ' ') { e.preventDefault(); setPinned(!pinned); }
    else if (e.key === 'm' && !soundBtn.hidden) setSound(!sound);
  });
  // press and hold to pause, swipe sideways to skip, swipe down to close
  let x0 = 0, y0 = 0, held = null;
  stage.parentElement.addEventListener('pointerdown', e => {
    if (e.target.closest('.viewer-recipe')) return;
    x0 = e.clientX; y0 = e.clientY; held = pinned ? null : setTimeout(() => pause(true), 250);
  });
  stage.parentElement.addEventListener('pointerup', e => {
    clearTimeout(held);
    if (paused && !pinned) { pause(false); suppress = true; return; }
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (dy > 80 && Math.abs(dy) > Math.abs(dx)) close();
    else if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
  });

  // tiles open the viewer instead of navigating
  $$('.story[data-index]').forEach(a => a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); open(Number(a.dataset.index));
  }));
  $$('.trip-play').forEach(b => b.addEventListener('click', () => open(0)));
  $$('.week-open[data-index]').forEach(a => a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); open(0, Number(a.dataset.index));
  }));
})();
