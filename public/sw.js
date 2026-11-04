// DgFit service worker — uygulama kabuğu önbelleği + çevrimdışı sayfa.
const VERSION = 'dgfit-v2'
const STATIC = `${VERSION}-static`
const OFFLINE_URL = '/offline.html'
const PRECACHE = [OFFLINE_URL, '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_deploy')) return

  // Derlenmiş statik dosyalar: önce önbellek (dosya adları hash'li ve değişmez)
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(
      caches.open(STATIC).then(async (c) => {
        const hit = await c.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) c.put(req, res.clone())
        return res
      }),
    )
    return
  }

  // Sayfalar: önce ağ, çevrimdışıysa çevrimdışı sayfası
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)))
  }
})

// Push bildirimleri (Su hatırlatmaları)
self.addEventListener('push', (e) => {
  let data = {}
  try { data = e.data ? e.data.json() : {} } catch { data = { title: 'DgFit', body: e.data && e.data.text() } }
  e.waitUntil(self.registration.showNotification(data.title || 'DgFit', {
    body: data.body || '', icon: '/icons/icon-192.png', badge: '/icons/badge-72.png', tag: data.tag || 'dgfit', renotify: true,
    data: { url: data.url || '/su', reminderId: data.reminderId || null },
    actions: (data.actions || []).slice(0, 2),
  }))
})

function post(path, body) {
  return fetch(path, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

self.addEventListener('notificationclick', (e) => {
  const n = e.notification
  const d = n.data || {}
  n.close()
  // Bildirimden doğrudan yanıt (Android): "200 ml içtim" → uygulamayı açmadan kaydet
  if (e.action && e.action.startsWith('add:')) {
    const ml = Number(e.action.slice(4))
    e.waitUntil(post('/api/water/notify', { reminderId: d.reminderId || undefined, action: e.action })
      .then((r) => r.json())
      .then((j) => self.registration.showNotification(j.ok ? `${ml} ml eklendi` : 'Eklenemedi', {
        body: j.ok ? 'Kaydın Su ekranına işlendi.' : (j.error || 'Uygulamayı açıp tekrar dene.'), icon: '/icons/icon-192.png', badge: '/icons/badge-72.png', tag: 'water-ack', silent: true,
      }))
      .catch(() => self.clients.openWindow('/su')))
    return
  }
  if (e.action === 'snooze') {
    e.waitUntil(post('/api/water/notify', { reminderId: d.reminderId || undefined, action: 'snooze' }).catch(() => {}))
    return
  }
  const target = d.url || '/su'
  e.waitUntil(Promise.all([
    d.reminderId ? post('/api/water/notify', { reminderId: d.reminderId, action: 'open' }).catch(() => {}) : Promise.resolve(),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) { c.navigate(target); return c.focus() }
      return self.clients.openWindow(target)
    }),
  ]))
})
