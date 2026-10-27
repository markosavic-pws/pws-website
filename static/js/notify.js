// /notifications/: turn browser notifications on or off and pick topics (rules/publishing.md,
// "Notifications"). The browser's push address goes to our own Worker and nowhere else.
(() => {
  const form = document.getElementById('notify');
  if (!form) return;
  const worker = form.dataset.worker;
  const status = form.querySelector('.notify-status');
  const [on, save, off] = ['[data-on]', '[data-save]', '[data-off]'].map(s => form.querySelector(s));
  const boxes = [...form.querySelectorAll('input[name=topic]')];
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (!('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window)) {
    // iPhone and iPad allow web notifications only from a site added to the Home Screen
    document.querySelector(ios ? '.notify-ios' : '.notify-unsupported').hidden = false;
    return;
  }
  form.hidden = false;

  const say = text => { status.textContent = text; };
  const topics = () => boxes.filter(b => b.checked).map(b => b.value);
  const call = async (path, body) => {
    const res = await fetch(worker + path, { method: body ? 'POST' : 'GET', headers: body ? { 'content-type': 'application/json' } : {}, body: body && JSON.stringify(body) });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  };
  const show = subscribed => { on.hidden = subscribed; save.hidden = off.hidden = !subscribed; };
  const blocked = () => say('Notifications are blocked for this site. Allow them in your browser’s site settings, then try again.');
  const ready = navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready);

  // a ?topics=house link (from the build log) starts with just that topic ticked, if not subscribed yet
  const asked = new URLSearchParams(location.search).get('topics');

  ready.then(async reg => {
    const sub = await reg.pushManager.getSubscription();
    if (!sub) {
      if (asked) boxes.forEach(b => { b.checked = asked.split(',').includes(b.value); });
      if (Notification.permission === 'denied') blocked();
      return show(false);
    }
    const r = await call('/status', { endpoint: sub.endpoint }).catch(() => null);
    if (r && r.ok) {
      boxes.forEach(b => { b.checked = r.data.topics.includes(b.value); });
      show(true);
      say('Notifications are on.');
    } else if (r && r.status === 404) {
      await sub.unsubscribe();   // the address was dropped on our side: start fresh
      show(false);
    }
  }).catch(() => say('Notifications couldn’t start in this browser.'));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!topics().length) return say('Pick at least one.');
    const turningOn = !on.hidden;
    on.disabled = save.disabled = true;
    try {
      if (turningOn && (await Notification.requestPermission()) !== 'granted') return blocked();
      const reg = await ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const key = (await call('/key')).data.key;
        if (!key) throw new Error('no key');
        const bytes = Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));   // older Safari wants bytes
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
      }
      const r = await call('/subscribe', { subscription: sub.toJSON(), topics: topics() });
      if (!r.ok) throw new Error(r.data.error);
      show(true);
      say(r.data.new ? 'Notifications are on. A test one is on its way.' : 'Saved.');
    } catch (err) {
      say('That didn’t work. Try again in a minute.');
    } finally {
      on.disabled = save.disabled = false;
    }
  });

  off.addEventListener('click', async () => {
    off.disabled = true;
    try {
      const sub = await (await ready).pushManager.getSubscription();
      if (sub) {
        await call('/unsubscribe', { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      show(false);
      say('Notifications are off.');
    } catch {
      say('That didn’t work. Try again in a minute.');
    } finally {
      off.disabled = false;
    }
  });
})();
