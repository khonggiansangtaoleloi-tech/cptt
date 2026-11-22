// Phiên bản Cache: Tăng số v2, v3... mỗi khi bạn sửa code để ép điện thoại tải lại
const CACHE_NAME = 'DiemDanhGPS-AnhTu-v2';

// Chỉ cần pre-cache các file cực kỳ quan trọng
const urlsToCache = [
  './',
  './index.php',
  './404.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Ép kích hoạt ngay lập tức
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('SW: Đang lưu cache app shell...');
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Đã dọn dẹp cache cũ ->', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Giành quyền kiểm soát ngay
  );
});

self.addEventListener('fetch', event => {
  // Bỏ qua các request POST (như submit form điểm danh)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // LUỒNG 1: CACHE FIRST - Dành cho tài nguyên tĩnh (Ảnh, CSS, JS) -> Load siêu mượt
  if (url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|gif|woff2|woff|ttf)$/)) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        // Trả về từ Cache ngay lập tức nếu có
        if (cachedResponse) {
          return cachedResponse;
        }
        // Nếu chưa có, tải từ mạng và lưu vào Cache cho lần sau
        return fetch(event.request).then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return; // Kết thúc luồng tĩnh
  }

  // LUỒNG 2: NETWORK FIRST - Dành cho các trang PHP/HTML -> Luôn lấy dữ liệu GPS mới nhất
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.php')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Lấy mạng thành công -> Lưu 1 bản vào cache dự phòng
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => {
          // Lỗi mạng -> Lấy bản cũ từ cache
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Nếu không có cache -> Trả về trang báo mất mạng
            return caches.match('./404.html');
          });
        })
    );
  }
});