/* =========================================================
   db.js — 用 IndexedDB 保存上传的素材（图片 / 音频 Blob）
   小型设定值放 localStorage
   （前缀 kpjflip. 跟别的翻牌项目错开，同一台机器上跑两个游戏不会互相读到设定）
   ========================================================= */
(function (global) {
  'use strict';

  var DB_NAME = 'kpj-flip-game';
  var DB_VER = 1;
  var STORE = 'media';
  var dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      var req;
      try { req = indexedDB.open(DB_NAME, DB_VER); }
      catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    dbp.catch(function () { dbp = null; });   // 失败了下次还能再试
    return dbp;
  }

  function tx(mode) {
    return open().then(function (db) {
      return db.transaction(STORE, mode).objectStore(STORE);
    });
  }

  function wrap(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  var Media = {
    get: function (key) {
      return tx('readonly').then(function (s) { return wrap(s.get(key)); });
    },
    put: function (key, blob) {
      return tx('readwrite').then(function (s) { return wrap(s.put(blob, key)); });
    },
    del: function (key) {
      return tx('readwrite').then(function (s) { return wrap(s.delete(key)); });
    },
    keys: function () {
      return tx('readonly').then(function (s) { return wrap(s.getAllKeys()); });
    }
  };

  /* ---------------- 设定值 ---------------- */
  var PREFIX = 'kpjflip.';
  var DEFAULTS = {
    gameTime: 15,        // 游戏限时（秒）
    countIn: 3,          // 开局倒数（秒）
    winPairs: 4,         // 成功门槛：时间到时配齐的组数 >= 这个数算成功（1~6，6 = 必须全部配齐）
    lastSeconds: 5,      // 最后一页停留（秒），时间到自动回首页
    resultIdle: 60,      // 成功 / 失败页没人点按钮时，多少秒后自动进最后一页（0 = 一直等）
    bgmVolume: 70,       // 背景音乐音量 0-100
    sfxVolume: 80,       // 音效音量 0-100

    /* 翻牌手感 */
    flipMs: 420,         // 翻牌动画时长 (ms)
    matchHold: 260,      // 配对成功后的停顿 (ms)
    missHold: 800,       // 配对失败后翻回的延时 (ms)
    speedUp: 60,         // 快点加速强度 0-100，0 = 关闭
    instantAdvance: 1    // 抢先翻牌：1 开 / 0 关
  };
  var STR_DEFAULTS = {
    lang: 'zh',          // 设定页语言
    goText: 'MULA!',     // 开局倒数结束时显示的字样
    bgmMode: 'always'    // 背景音乐：always = 一直循环（第一次点击后）；game = 只在游戏中播
  };

  /* 随包配置（assets/bundle/config.json）提供的默认值，
     优先级介于「本机改动」和「出厂默认」之间，由 bundle.js 注入 */
  var bundled = {};

  function lsGet(k) { try { return localStorage.getItem(PREFIX + k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(PREFIX + k, String(v)); } catch (e) {} }

  var Settings = {
    /* 数值型 */
    get: function (k) {
      var raw = lsGet(k);
      if (raw !== null) {
        var n = parseFloat(raw);
        if (!isNaN(n)) return n;
      }
      if (bundled[k] !== undefined && bundled[k] !== null) {
        var b = parseFloat(bundled[k]);
        if (!isNaN(b)) return b;
      }
      return DEFAULTS[k];
    },
    /* 字符串型 */
    getStr: function (k) {
      var raw = lsGet(k);
      if (raw !== null) return raw;
      if (bundled[k] !== undefined && bundled[k] !== null) return String(bundled[k]);
      return STR_DEFAULTS[k];
    },
    set: function (k, v) { lsSet(k, v); },

    /* 由 bundle.js 调用 */
    applyBundle: function (obj) { bundled = obj || {}; },
    bundled: function () { return bundled; },

    /* 清掉本机所有改动，回到随包配置 / 出厂默认 */
    clearLocal: function () {
      try {
        Object.keys(localStorage)
          .filter(function (k) { return k.indexOf(PREFIX) === 0; })
          .forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) {}
    },

    keys: Object.keys(DEFAULTS).concat(Object.keys(STR_DEFAULTS)),
    isStr: function (k) { return STR_DEFAULTS.hasOwnProperty(k); },
    defaults: DEFAULTS,
    strDefaults: STR_DEFAULTS
  };

  global.Media = Media;
  global.Settings = Settings;
})(window);
