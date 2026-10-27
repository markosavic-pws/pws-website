// Shows the notifications cloudflare/notify sends when there's a new post (rules/publishing.md,
// "Notifications"). Served from the site root; it has no fetch handler, so pages load as always.
const WORKER = 'https://notify.probablyworthsharing.com';

self.addEventListener('push', e => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil(self.registration.showNotification(m.title || 'Probably Worth Sharing', {
    body: m.body || '',
    icon: '/logo.png',
    image: m.image,
    tag: m.topic,          // a newer notification about the same topic replaces the old one
    data: { url: m.url || '/' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data.url, self.location.origin).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
    const open = wins.find(w => w.url === url);
    return open ? open.focus() : clients.openWindow(url);
  }));
});

// the browser renewed its push address: tell the Worker, which keeps the old address's topics
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil((async () => {
    const sub = e.newSubscription || await self.registration.pushManager.subscribe(e.oldSubscription.options);
    await fetch(WORKER + '/subscribe', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), replaces: e.oldSubscription && e.oldSubscription.endpoint }),
    });
  })());
});