// Pochi-next Service Worker (手書き / 依存なし)
// - ナビゲーションと /data/ は network-first（内容更新を優先、オフライン時はキャッシュ）
// - 静的アセット（_next/静的・画像・音声・アニメ・アイコン）は cache-first
// - 外部ドメイン（Firebase / Google 等）と非GETは一切触らない
const CACHE = "pochi-next-v1";

const PRECACHE = [
  "/",
  "/manifest.json",
  "/images/icons/icon-192.png",
  "/images/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 手動更新のトリガ（新SWを即時有効化したいとき用）
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function cacheFirst(request) {
  return caches.match(request).then(
    (cached) =>
      cached ||
      fetch(request).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
  );
}

function networkFirst(request) {
  return fetch(request)
    .then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return res;
    })
    .catch(() =>
      caches.match(request).then((cached) => cached || caches.match("/"))
    );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // 同一オリジン以外（Firebase/Google APIなど）はSWを介さない
  if (url.origin !== self.location.origin) return;

  // ページ遷移
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // 学習コンテンツCSVは更新優先
  if (url.pathname.startsWith("/data/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 静的アセットはキャッシュ優先
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/sound/") ||
    url.pathname.startsWith("/audio/") ||
    url.pathname.startsWith("/animations/") ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // それ以外は素通し
});
