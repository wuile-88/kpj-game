/* =========================================================
   bundle.js — 随包配置（跟着文件夹走的素材与参数）

   文件位置：assets/bundle/config.json
   由设定页的「导出当前配置」按钮生成，把它覆盖到上面这个路径，
   之后任何一台新机器第一次打开就是这套配置，不用再上传或调整。

   素材条目支持两种写法：
     内嵌  { "name": "x.png", "type": "image/png", "data": "<base64>" }
     引用  { "name": "x.mp3", "type": "audio/mpeg", "file": "bgm.mp3" }
            file 相对 assets/bundle/ 目录。
            音乐等较大的文件用引用形式：体积不膨胀 33%，
            浏览器还能直接流式播放，不必先解码成 Blob。

   优先级（从高到低）：
     1. 本机改动    localStorage / IndexedDB —— 用户在这台机器上改过的
     2. 随包配置    assets/bundle/config.json
     3. 出厂默认    db.js 的 DEFAULTS / 设计稿自带的 6 张牌面 / 内置合成音
   ========================================================= */
(function (global) {
  'use strict';

  var DIR = 'assets/bundle/';
  var PATH = DIR + 'config.json';

  var data = null;
  var faceItems = [];       // 6 个描述符或 null
  var audioItems = {};      // key -> 描述符或 null

  function b64ToBlob(b64, type) {
    var bin = atob(b64);
    var buf = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return new Blob([buf], { type: type || 'application/octet-stream' });
  }

  /* 统一成描述符：{ blob, url, name }，两者必有其一 */
  function decode(e) {
    if (!e) return null;
    try {
      if (e.file) return { blob: null, url: DIR + e.file, name: e.name || e.file };
      if (e.data) return { blob: b64ToBlob(e.data, e.type), url: null, name: e.name || '' };
    } catch (err) { /* 落到下面返回 null */ }
    return null;
  }

  function load() {
    /* file:// 下 fetch 会被拦，直接当没有随包配置 */
    if (location.protocol === 'file:') return Promise.resolve(null);
    return fetch(PATH, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) {
        if (!json) return null;
        data = json;
        faceItems = (json.faces || []).map(decode);
        var au = json.audio || {};
        Object.keys(au).forEach(function (k) { audioItems[k] = decode(au[k]); });
        if (json.settings && global.Settings) Settings.applyBundle(json.settings);
        return json;
      })
      .catch(function () { return null; });   // 没有随包配置就走出厂默认
  }

  /* 把描述符取成 Blob（导出配置时用） */
  function toBlob(item) {
    if (!item) return Promise.resolve(null);
    if (item.blob) return Promise.resolve(item.blob);
    return fetch(item.url).then(function (r) { return r.ok ? r.blob() : null; })
      .catch(function () { return null; });
  }

  global.Bundle = {
    load: load,
    toBlob: toBlob,
    get present() { return !!data; },
    get exportedAt() { return data && data.exportedAt; },
    face: function (i) { return faceItems[i] || null; },
    audio: function (k) { return audioItems[k] || null; },
    settings: function () { return (data && data.settings) || null; },

    /* config.json 里的原始条目。导出时若该项未被本机改动，
       就原样搬过去 —— 引用形式的大文件不会被 base64 撑大。 */
    rawFace: function (i) { return (data && data.faces && data.faces[i]) || null; },
    rawAudio: function (k) { return (data && data.audio && data.audio[k]) || null; }
  };
})(window);
