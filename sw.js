const CACHE = 'ljs-services-v3';
const ASSETS = [
  './', './index.html', './styles.css', './print-vector.css', './print-fit.css', './admin-archives.css', './admin-dashboard.css', './technician-admin-changes.css', './technician-archives.css', './leave-requests.css', './admin-leave-requests.css', './config.js', './services-supabase-router.js', './hidden-admin-access.js',
  './app-1.js', './app-2.js', './app-3.js', './app-4.js', './app-5.js', './app-6.js',
  './admin-reset.js', './ui-labels.js', './admin-projects.js', './interim-agency.js', './technician-state.js', './admin-vehicles.js', './admin-pin-guard.js', './admin-archives.js', './admin-dashboard.js', './admin-archive-navigation.js', './technician-admin-changes.js', './technician-form-fixes.js', './absence-types.js', './hours-limits.js', './pdf-export.js', './archive-pdf-buttons.js', './pwa-clean.js', './print-logo-fix.js', './print-ready-fix.js', './responsible-change-history.js', './responsible-correction-display-fix.js', './responsible-comments.js', './print-project-correction.js', './timesheet-notifications.js', './leave-delete-pin-mask.js', './leave-requests.js', './admin-leave-requests.js', './leave-pdf.js', './leave-pdf-buttons.js', './leave-notifications.js',
  './manifest.webmanifest', './brand.png', './icon-192-v2.png', './icon-512-v2.png', './print-template.svg'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const asset of ASSETS) {
      try { await cache.add(asset); }
      catch (error) { console.warn('PWA cache skipped:', asset, error); }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request, { cache: 'no-store' });
      if (response && response.ok) {
        const copy = response.clone();
        const cache = await caches.open(CACHE);
        cache.put(event.request, copy).catch(() => {});
      }
      return response;
    } catch (error) {
      const cached = await caches.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
      throw error;
    }
  })());
});