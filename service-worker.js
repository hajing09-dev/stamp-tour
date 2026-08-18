/**
 * Festival Stamp Tour - Lightweight Service Worker
 * PWA 설치 가능 요건 충족 및 기본 네트워크 전략
 */

const CACHE_NAME = "stamp-tour-v1";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./portal.html",
  "./supabase-init.js",
  "./config.js",
  "./theme.js",
  "./webview-checker.js",
  "./student.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // 일부 CDN 리소스 실패 시에도 install 완료
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-first 전략 (스탬프 실시간 데이터 최우선)
self.addEventListener("fetch", (event) => {
  // Supabase API나 Realtime 웹소켓은 서비스 워커 캐시 제외
  if (event.request.url.includes("supabase.co") || event.request.url.startsWith("ws")) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
