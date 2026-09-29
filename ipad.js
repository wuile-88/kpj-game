/* =========================================================
   ipad.js — 只有 iPad 版会加载（tools/build-ipad.js 注入，排在 app.js 后面）
   游戏本身一行没改（app.js 看到 window.KPJ_PLATFORM === 'ipad' 就把声音换成 Web Audio），这里只管：
     1. 离线：注册 Service Worker（sw.js），把全部素材存进 iPad，之后断网也能开
     2. 设定页多一张「六、iPad 离线」卡片：运行方式 / 离线资源 / 存储 / 屏幕常亮 / 检查更新
     3. 新版本装好了：等回到首页再自动刷新（不会打断正在玩的一局）
     4. iOS 触屏的小毛病：按钮的 :active 按下效果不生效、输入框收起键盘后页面没弹回来
     5. 屏幕常亮（Wake Lock）
     6. 在电脑的 iPad安装服务 上时，把安装进度报回电脑（电脑的状态页上能看到「已就绪」）
   ========================================================= */
(function () {
  'use strict';

  var CACHE_PREFIX = 'kpj-ipad-';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var t = function (k, v) { return I18N.t(k, v); };

  function isStandalone() {
    return window.navigator.standalone === true ||
      !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  /* 安装服务一律用 IP 访问（https://192.168.x.x:8843）；放在别的网站上（域名）就不回报 */
  var onInstallServer = /^\d{1,3}(\.\d{1,3}){3}$/.test(location.hostname);
  var swCapable = ('serviceWorker' in navigator) &&
    (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');

  var status = {
    sw: swCapable ? 'pending' : 'unsupported',   // pending / registered / partial / ready / unsupported / error
    version: null, total: 0, cached: 0, bytes: 0,
    persisted: null, wake: 'off', standalone: isStandalone(), error: ''
  };

  /* ---------- 离线资源检查：precache.json 里的每个文件都在缓存里才算就绪 ---------- */
  var precache = null;
  function loadPrecache() {
    return fetch('precache.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('precache.json HTTP ' + r.status); return r.json(); })
      .then(function (j) { precache = j; return j; });
  }
  function checkCache() {
    if (!window.caches) return Promise.resolve(status);
    return (precache ? Promise.resolve(precache) : loadPrecache()).then(function (p) {
      status.version = p.version; status.total = p.files.length; status.bytes = p.bytes;
      var name = CACHE_PREFIX + p.version;
      return caches.has(name).then(function (has) {
        if (!has) return [];                        // 别用 caches.open 去探：会顺手建出一个空缓存
        return caches.open(name).then(function (c) {
          return Promise.all(p.files.map(function (f) { return c.match(f).then(function (r) { return !!r; }); }));
        });
      });
    }).then(function (flags) {
      status.cached = flags.filter(Boolean).length;
      if (status.sw !== 'unsupported' && status.sw !== 'error') {
        status.sw = status.total && status.cached === status.total ? 'ready' : (status.cached ? 'partial' : status.sw);
      }
      return status;
    }).catch(function (e) {
      status.error = String((e && e.message) || e);
      return status;
    });
  }

  /* ---------- 回报给电脑上的安装服务 ---------- */
  var lastReport = '';
  function report() {
    if (!onInstallServer) return;
    var q = 'mode=' + (status.standalone ? 'app' : 'safari') +
      '&sw=' + encodeURIComponent(status.sw) + '&v=' + encodeURIComponent(status.version || '') +
      '&c=' + status.cached + '&n=' + status.total +
      '&vw=' + window.innerWidth + '&vh=' + window.innerHeight + '&dpr=' + (window.devicePixelRatio || 1) +
      '&tp=' + (navigator.maxTouchPoints || 0) +          // iPadOS 的 UA 冒充 Mac，靠触控点数认出是 iPad

      (status.error ? '&err=' + encodeURIComponent(status.error.slice(0, 120)) : '');
    if (q === lastReport) return;
    lastReport = q;
    fetch('__kpj/report?' + q, { cache: 'no-store' }).catch(function () {});
  }

  var polling = 0;
  function refresh() {
    return checkCache().then(function () {
      renderCard();
      renderPill();
      report();
      /* 还在下载：每 1.5 秒再看一次，进度条和电脑那边的进度就能动起来（网络慢的话最多等 3 分钟） */
      if (status.sw === 'partial' || status.sw === 'registered') {
        if (polling < 120) { polling++; setTimeout(refresh, 1500); }
      } else {
        polling = 0;
      }
      return status;
    });
  }

  /* ---------- 第一次从主屏幕打开：画面下方显示离线资源下载进度，好了显示「✓ 可以离线玩了」 ----------
     只在主屏幕 App 里、而且这台 iPad 从来没装好过的时候出现一次；之后（包括自动更新）一律不打扰，现场画面保持干净。
     记号不用 kpjflip. 前缀：设定页的「恢复出厂设置」会清掉那些，清掉后又弹一次没有意义。 */
  var PILL_KEY = 'kpjipad.offlineReady';
  function renderPill() {
    if (!isStandalone() || !swCapable) return;
    var done = null;
    try { done = localStorage.getItem(PILL_KEY); } catch (e) { /* ignore */ }
    var ready = status.total > 0 && status.cached === status.total;
    var pill = document.getElementById('kpj-pill');
    if (done && !pill) {
      if (ready && done !== status.version) { try { localStorage.setItem(PILL_KEY, status.version); } catch (e) { /* ignore */ } }
      return;
    }
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'kpj-pill';
      document.body.appendChild(pill);
    }
    if (status.sw === 'error' || status.sw === 'unsupported') {
      pill.className = 'bad';
      pill.textContent = '离线资源没装好：请连上网络后重新打开 · Offline files not saved — reconnect and reopen';
      return;
    }
    if (ready) {
      if (pill.className === 'ok') return;
      try { localStorage.setItem(PILL_KEY, status.version); } catch (e) { /* ignore */ }
      pill.className = 'ok';
      pill.textContent = '✓ 可以离线玩了 · Ready to play offline';
      setTimeout(function () {
        pill.classList.add('bye');
        setTimeout(function () { if (pill.parentNode) pill.parentNode.removeChild(pill); }, 600);
      }, 4000);
      return;
    }
    pill.className = '';
    pill.textContent = '正在准备离线资源 ' + status.cached + ' / ' + (status.total || '…') + '，请保持联网 · Preparing offline files…';
  }

  /* ---------- 在 iPad 的 Safari 里打开时：教怎么「添加到主屏幕」 ----------
     扫二维码进来的人第一眼就知道下一步做什么。主屏幕 App 里永远不出现；
     点「先在浏览器里试玩」就收起来（这一个 Safari 标签页里不再出现）。 */
  var isIOS = /iP(ad|hone|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && (navigator.maxTouchPoints || 0) > 1);
  var SHARE_ICON = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3v12"/><path d="M7.5 7.5 12 3l4.5 4.5"/><path d="M8 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-2"/></svg>';
  function showInstallGuide() {
    if (!isIOS || isStandalone() || !swCapable || document.getElementById('kpj-install')) return;
    try { if (sessionStorage.getItem('kpjipad.tryInBrowser')) return; } catch (e) { /* ignore */ }
    var el = document.createElement('div');
    el.id = 'kpj-install';
    el.innerHTML =
      '<div class="kpj-arrow" aria-hidden="true">↑</div>' +
      '<div class="kpj-card">' +
        '<div class="kpj-head"><img src="icons/apple-touch-icon.png" alt=""><div><b>KPJ Game</b><span>安装到这台 iPad · Install on this iPad</span></div></div>' +
        '<ol>' +
          '<li><b>点 Safari 右上角的「分享」按钮</b> <span class="kpj-ico">' + SHARE_ICON + '</span><br>' +
            '<small>新版 iPadOS 在「⋯」里 · Tap Safari\'s Share button (top right; on newer iPadOS it is under ⋯)</small></li>' +
          '<li><b>选「添加到主屏幕」，再点「添加」</b><br><small>Choose "Add to Home Screen", then "Add"</small></li>' +
          '<li><b>回到主屏幕，点「KPJ Game」打开一次</b>，等画面下方出现「✓ 可以离线玩了」<br>' +
            '<small>Open "KPJ Game" from the Home Screen once and wait for "✓ Ready to play offline"</small></li>' +
        '</ol>' +
        '<p class="kpj-note">完成后游戏不需要网络 · No internet needed afterwards</p>' +
        '<button type="button" id="kpj-install-try">先在浏览器里试玩 · Just try it here</button>' +
      '</div>';
    document.body.appendChild(el);
    document.getElementById('kpj-install-try').addEventListener('click', function () {
      try { sessionStorage.setItem('kpjipad.tryInBrowser', '1'); } catch (e) { /* ignore */ }
      if (el.parentNode) el.parentNode.removeChild(el);
    });
  }
  showInstallGuide();

  /* ---------- Service Worker ---------- */
  var reg = null;
  var hadController = swCapable && !!navigator.serviceWorker.controller;
  var reloadWhenIdle = false;

  function pageNow() { return (window.KPJ && KPJ.state().page) || null; }
  function maybeReload() {
    if (reloadWhenIdle && pageNow() === 'home') { reloadWhenIdle = false; location.reload(); }
  }

  if (swCapable) {
    navigator.serviceWorker.register('sw.js').then(function (r) {
      reg = r;
      if (status.sw === 'pending') status.sw = 'registered';
      r.addEventListener('updatefound', function () {
        var nw = r.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () { refresh(); });
      });
      refresh();
    }).catch(function (e) {
      status.sw = 'error';
      status.error = String((e && e.message) || e);
      renderCard();
      report();
    });
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'kpj-sw') { precache = null; refresh(); }
    });
    /* 第一次装上：什么都不用做。之后又装了新版本：等回到首页再刷新成新版 */
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; refresh(); return; }
      reloadWhenIdle = true;
      maybeReload();
    });
  } else {
    setTimeout(function () { renderCard(); report(); }, 800);
  }

  /* ---------- 持久保存（iPadOS 17+ 给主画面 App；不给也没关系） ---------- */
  try {
    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then(function (p) {
        if (p) { status.persisted = true; return; }
        if (navigator.storage.persist) return navigator.storage.persist().then(function (g) { status.persisted = !!g; });
      }).catch(function () {});
    }
  } catch (e) { /* ignore */ }

  /* ---------- 屏幕常亮 ---------- */
  var wakeLock = null;
  function requestWake() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || wakeLock) return;
    try {
      navigator.wakeLock.request('screen').then(function (l) {
        wakeLock = l; status.wake = 'on';
        l.addEventListener('release', function () { wakeLock = null; status.wake = 'off'; });
      }).catch(function () { status.wake = 'off'; });
    } catch (e) { /* ignore */ }
  }
  document.addEventListener('touchend', requestWake, true);
  document.addEventListener('click', requestWake, true);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { requestWake(); if (window.KPJ) KPJ.fit(); }
  });

  /* ---------- iOS 触屏小毛病 ---------- */
  /* :active（按钮按下缩一下）在 iOS 上要页面里有 touchstart 监听才会生效 */
  document.addEventListener('touchstart', function () {}, { passive: true });
  /* 设定页输入框收起键盘后，iOS 有时把整页留在往上推的位置 */
  document.addEventListener('focusout', function () {
    setTimeout(function () { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); }, 80);
  });

  /* ---------- 设定页「六、iPad 离线」卡片 ---------- */
  function buildCard() {
    var body = $('.set-body');
    if (!body || $('#ipad-card')) return;
    var card = document.createElement('div');
    card.className = 'set-card';
    card.id = 'ipad-card';
    card.innerHTML =
      '<h2 data-i18n="sec.ipad"></h2>' +
      '<div class="row"><label data-i18n="lbl.runmode"></label><span class="ipad-val" id="ipad-mode"></span></div>' +
      '<div class="row"><label data-i18n="lbl.offline"></label><span class="ipad-val" id="ipad-offline"></span></div>' +
      '<div class="row"><label data-i18n="lbl.storage"></label><span class="ipad-val" id="ipad-storage"></span></div>' +
      '<div class="row"><label data-i18n="lbl.wakelock"></label><span class="ipad-val" id="ipad-wake"></span></div>' +
      '<div class="row"><button class="chip" id="ipad-update" type="button" data-i18n="btn.checkupdate"></button></div>' +
      '<p class="hint" data-i18n="hint.ipad"></p>';
    body.appendChild(card);
    I18N.apply(card);
    $('#ipad-update').addEventListener('click', checkUpdate);
  }

  function renderCard() {
    if (!$('#ipad-card')) return;
    status.standalone = isStandalone();
    $('#ipad-mode').textContent = status.standalone ? t('ipad.standalone') : t('ipad.browser');
    $('#ipad-mode').className = 'ipad-val ' + (status.standalone ? 'ok' : 'warn');
    var ready = status.total > 0 && status.cached === status.total;
    var off;
    if (status.sw === 'unsupported') off = t('ipad.nosw');
    else if (status.sw === 'error') off = t('ipad.swerror', { e: status.error });
    else if (ready) off = t('ipad.ready', { n: status.total, mb: (status.bytes / 1048576).toFixed(1), v: status.version });
    else if (status.cached > 0) off = t('ipad.partial', { c: status.cached, n: status.total });
    else off = t('ipad.none');
    $('#ipad-offline').textContent = off;
    $('#ipad-offline').className = 'ipad-val ' + (ready ? 'ok' : 'warn');
    $('#ipad-storage').textContent = status.persisted ? t('ipad.persisted') : t('ipad.notpersisted');
    $('#ipad-storage').className = 'ipad-val' + (status.persisted ? ' ok' : '');
    $('#ipad-wake').textContent = status.wake === 'on' ? t('ipad.wake.on') : t('ipad.wake.off');
    $('#ipad-wake').className = 'ipad-val ' + (status.wake === 'on' ? 'ok' : 'warn');
  }

  function checkUpdate() {
    if (!reg) { KPJ.toast(t('toast.update.fail')); return; }
    reg.update().then(function () {
      var w = reg.installing || reg.waiting;
      KPJ.toast(w ? t('toast.update.found') : t('toast.update.none'));
    }).catch(function () { KPJ.toast(t('toast.update.fail')); });
  }

  /* 进设定页 / 换语言时刷新卡片；回到首页时如果有新版本等着，就刷新页面 */
  var stageEl = $('#stage');
  if (window.MutationObserver) {
    new MutationObserver(function () {
      var p = stageEl.getAttribute('data-page');
      if (p === 'settings') { buildCard(); refresh(); }
      if (p === 'home') maybeReload();
    }).observe(stageEl, { attributes: true, attributeFilter: ['data-page'] });
    new MutationObserver(function () { renderCard(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

  /* 排障 / 自测用 */
  window.KPJ_IPAD = {
    status: function () { return JSON.parse(JSON.stringify(status)); },
    standalone: isStandalone,
    refresh: refresh,
    update: function () { return reg ? reg.update() : Promise.reject(new Error('no registration')); },
    get reloadPending() { return reloadWhenIdle; }
  };
})();
