/* =========================================================
   KPJ iPad 版离线缓存 —— 由 tools/build-ipad.js 生成（版本 922b09b53c），别手改
   · 第一次打开：把 FILES 里的全部文件下载进缓存，之后断网也能开
   · 之后每次打开：一律先从缓存拿（离线优先）；电脑上的安装服务开着的话，浏览器会顺便检查 sw.js 有没有新版
   · 装了新版：旧缓存删掉，页面等回到首页再刷新（ipad.js 管）
   ========================================================= */
'use strict';
var VERSION = '922b09b53c';
var CACHE = 'kpj-ipad-' + VERSION;
var FILES = [
 "index.html",
 "assets/bundle/bgm.mp3",
 "assets/bundle/config.json",
 "assets/bundle/lose.mp3",
 "assets/bundle/win.mp3",
 "assets/fonts/poppins-600.woff2",
 "assets/fonts/poppins-700.woff2",
 "assets/img/btn-cuba.png",
 "assets/img/btn-mula.png",
 "assets/img/btn-tebus.png",
 "assets/img/card-back.png",
 "assets/img/card-blank.png",
 "assets/img/card-red.png",
 "assets/img/face-1-kpj.png",
 "assets/img/face-2-stethoscope.png",
 "assets/img/face-3-drink.png",
 "assets/img/face-4-chicken.png",
 "assets/img/face-5-youokay.png",
 "assets/img/face-6-doctor.png",
 "assets/img/page-fail.jpg",
 "assets/img/page-game-bg.jpg",
 "assets/img/page-home.jpg",
 "assets/img/page-last.jpg",
 "assets/img/page-success.jpg",
 "css/style.css",
 "icons/apple-touch-icon.png",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "ipad.css",
 "ipad.js",
 "js/app.js",
 "js/bundle.js",
 "js/db.js",
 "js/i18n.js",
 "manifest.webmanifest",
 "precache.json"
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (f) {
      return c.match(f).then(function (hit) {
        if (hit) return;                      // 上次装到一半已经下好的（同一版本内容一定一样），不用重下
        return fetch(new Request(f, { cache: 'reload' })).then(function (r) {
          if (!r.ok) throw new Error(f + ' HTTP ' + r.status);
          return c.put(f, r);
        });
      });
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) {
      return k.indexOf('kpj-ipad-') === 0 && k !== CACHE;
    }).map(function (k) { return caches.delete(k); }));
  }).then(function () {
    return self.clients.claim();
  }).then(function () {
    return self.clients.matchAll({ includeUncontrolled: true }).then(function (list) {
      list.forEach(function (c) { c.postMessage({ type: 'kpj-sw', event: 'activated', version: VERSION }); });
    });
  }));
});

/* 音频 / 视频有时会带 Range 请求来要一段；Safari 播媒体一定要 206 回应，这里从缓存里切给它 */
function partial(resp, range) {
  return resp.arrayBuffer().then(function (buf) {
    var size = buf.byteLength, m = /bytes=(\d*)-(\d*)/.exec(range || ''), start, end;
    if (!m) return new Response(buf, { status: 200, headers: resp.headers });
    if (m[1] === '') { start = Math.max(0, size - (parseInt(m[2], 10) || 0)); end = size - 1; }
    else { start = parseInt(m[1], 10); end = m[2] === '' ? size - 1 : Math.min(parseInt(m[2], 10), size - 1); }
    if (!(start >= 0) || start >= size || start > end) {
      return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
    }
    return new Response(buf.slice(start, end + 1), {
      status: 206,
      headers: {
        'Content-Type': resp.headers.get('Content-Type') || 'application/octet-stream',
        'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
        'Content-Length': String(end - start + 1),
        'Accept-Ranges': 'bytes'
      }
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/__kpj/') >= 0) return;          // 回报给安装服务的：走网络，不缓存

  /* 打开页面（含主画面图标的启动网址）：一律给缓存里的 index.html */
  if (req.mode === 'navigate') {
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match('index.html').then(function (hit) { return hit || fetch(req); });
    }).catch(function () { return fetch(req); }));
    return;
  }

  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      if (!hit) return fetch(req);
      var range = req.headers.get('range');
      return range ? partial(hit, range) : hit;
    });
  }).catch(function () { return fetch(req); }));
});
