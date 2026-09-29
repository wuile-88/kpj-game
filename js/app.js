/* =========================================================
   app.js — 页面路由、翻牌逻辑、计时、音效、设定
   流程：首页(MULA) → 游戏页(倒数 3 秒 → 15 秒；配齐 6 组立刻成功，
         时间到时配齐 >= 4 组算成功、<= 3 组算失败，门槛可调)
         → 成功页(点 TEBUS HADIAH) / 失败页(点 CUBA LAGI) → 最后一页(停 5 秒) → 首页
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 常量 ---------- */
  var PAIRS = 6;                 // 6 组图，共 12 张牌

  /* 版面（tools/layout.json，设计稿像素实测） */
  var LAYOUT = {
    cols: [195, 432, 669],                   // 每张牌外框左边
    rows: [734, 972, 1211, 1449],            // 每张牌外框上边
    card: 215, margin: 3,                    // 外框 215，精灵四周多 3px
    timer: { cx: 812.5, capTop: 412, capH: 57, left: 692, top: 400 },   // 设计稿「15」：x 771..854 y 412..469
    /* 参考稿上 12 张牌的顺序（0 KPJ / 1 听诊器 / 2 饮料 / 3 炸鸡 / 4 You Okay Tak / 5 医生） */
    ref: [0, 1, 2, 3, 4, 1, 3, 4, 0, 5, 2, 5]
  };

  var DEFAULT_FACES = [
    'assets/img/face-1-kpj.png',
    'assets/img/face-2-stethoscope.png',
    'assets/img/face-3-drink.png',
    'assets/img/face-4-chicken.png',
    'assets/img/face-5-youokay.png',
    'assets/img/face-6-doctor.png'
  ];
  var IMG = { back: 'assets/img/card-back.png', blank: 'assets/img/card-blank.png', red: 'assets/img/card-red.png' };

  /* 音效槽位。bgm 之外的都有内置音效，未上传时使用内置 */
  var AUDIO_KEYS = ['bgm', 'click', 'flip', 'match', 'miss', 'win', 'lose'];

  /* 快点加速的节奏区间：点击间隔 <=FAST 最快，>=SLOW 不加速 */
  var PACE_FAST = 220;
  var PACE_SLOW = 900;
  var PACE_WEIGHT = 0.65;        // 新间隔的权重，越大反应越灵敏

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var t = function (k, v) { return I18N.t(k, v); };
  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };

  /* =========================================================
     舞台缩放：把 1080x1920 等比缩放进窗口
     ========================================================= */
  var stage = $('#stage');
  var viewportEl = $('#viewport');

  /* 按 #viewport 的尺寸算，不按整个窗口：iPad 版把 #viewport 缩进安全区
     （上面的状态栏、下面的主屏幕指示条），舞台就不会被它们盖住。电脑版两者一样大。 */
  function fitStage() {
    var w = viewportEl.clientWidth || window.innerWidth;
    var h = viewportEl.clientHeight || window.innerHeight;
    var s = Math.min(w / 1080, h / 1920);
    stage.style.transform = 'scale(' + s + ')';
  }
  window.addEventListener('resize', fitStage);
  /* iPad 转屏后尺寸有时要晚一点才更新，补两次 */
  window.addEventListener('orientationchange', function () { setTimeout(fitStage, 120); setTimeout(fitStage, 450); });
  fitStage();

  /* =========================================================
     页面路由
     ========================================================= */
  var pages = {};
  $$('.page').forEach(function (el) { pages[el.dataset.page] = el; });
  var current = null;
  var gamePage = $('#page-game');

  function show(name) {
    var el = pages[name === 'reference' ? 'game' : name];
    gamePage.classList.toggle('reference', name === 'reference');
    if (current === name) return;
    Object.keys(pages).forEach(function (k) { pages[k].classList.remove('active'); });
    el.classList.add('active', 'enter');
    void el.offsetWidth;              // 强制回流后再淡入
    el.classList.remove('enter');
    current = name;
    stage.dataset.page = name;
  }

  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  /* =========================================================
     牌面：设计稿自带的整张牌（full）/ 上传的图标（放在米白牌面上）
     ========================================================= */
  var faces = DEFAULT_FACES.map(function (u) { return { url: u, full: true, custom: false }; });
  var faceObjectURLs = [];

  function loadFaces() {
    faceObjectURLs.forEach(URL.revokeObjectURL);
    faceObjectURLs = [];
    var jobs = DEFAULT_FACES.map(function (def, i) {
      return Media.get('face' + i).then(function (blob) {
        /* 本机上传 > 随包配置 > 设计稿自带 */
        if (blob) {
          var u = URL.createObjectURL(blob);
          faceObjectURLs.push(u);
          return { url: u, full: false, custom: true };
        }
        var item = Bundle.face(i);
        if (item) {
          if (item.url) return { url: item.url, full: false, custom: true };
          var bu = URL.createObjectURL(item.blob);
          faceObjectURLs.push(bu);
          return { url: bu, full: false, custom: true };
        }
        return { url: def, full: true, custom: false };
      }).catch(function () { return { url: def, full: true, custom: false }; });
    });
    return Promise.all(jobs).then(function (list) { faces = list; return list; });
  }

  /* =========================================================
     音效
     ========================================================= */
  var audio = {};
  var audioURLs = {};
  var audioNames = {};
  var audioFromBundle = {};   // true = 该音效来自随包配置，而非本机上传
  AUDIO_KEYS.forEach(function (k) {
    audio[k] = null; audioURLs[k] = null; audioNames[k] = ''; audioFromBundle[k] = false;
  });

  /* iPad / iPhone：所有声音改走 Web Audio（见下面 WAPlayer 的说明）。
     iPad 版的 index.html 里写了 window.KPJ_PLATFORM = 'ipad'；
     有人直接用 iPad 的 Safari 打开电脑版网页也照样认得出来（iPadOS 的 UA 冒充 Mac，但有多点触控）。 */
  var USE_WEBAUDIO = (function () {
    if (window.KPJ_PLATFORM === 'ipad') return true;
    var ua = navigator.userAgent || '';
    return /iP(ad|hone|od)/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  })();
  var audioUnlocked = !USE_WEBAUDIO;   // iOS：第一次触摸之前不建 AudioContext，要播的先排队

  /* ---------- 内置音效（WebAudio 即时合成，不需要音频文件） ---------- */
  var actx = null;
  function audioCtx() {
    if (!actx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { actx = new C(); } catch (e) { return null; }
    }
    /* suspended：还没手势；interrupted：iOS 切到后台 / 来电之后。都在下一次点击里恢复 */
    if (actx.state !== 'running' && actx.state !== 'closed') {
      try { var p = actx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    }
    return actx;
  }

  /* ---------- iOS 用的 <audio> 替身：WAPlayer ----------
     iOS 上的 <audio> 有三个硬伤：
       1. volume 是只读的 —— 音量滑杆、成功 / 失败页把背景音乐压低，全都没效果
       2. 每个 <audio> 第一次 play() 必须发生在点击里 —— 时间到自动进失败页时，失败音效会被系统拦掉
       3. 连续快速重播（翻牌音效）延迟大
     所以 iOS 上改成：文件先整段解码成 AudioBuffer，播放时 BufferSource → Gain → 输出。
     AudioContext 在第一次触摸时才建（iOS 的规定），之后任何时候都能出声、音量随便调。
     WAPlayer 只模仿下面代码用到的那几样 <audio>（play / pause / currentTime / volume / paused / ended / loop / error），
     所以背景音乐、音效的播放逻辑一行都不用为 iPad 改。 */
  var decodeCtx = null;
  function decodeAudio(ab) {
    if (!decodeCtx) {
      var O = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      try { decodeCtx = O ? new O(2, 1, 48000) : null; } catch (e) { decodeCtx = null; }
      if (!decodeCtx) decodeCtx = audioCtx();       // 解码本身不出声，用离线的就不必等手势
    }
    return new Promise(function (resolve, reject) {
      var settled = false;
      var ok = function (b) { if (!settled) { settled = true; resolve(b); } };
      var ng = function (e) { if (!settled) { settled = true; reject(e || new Error('decode failed')); } };
      try { var p = decodeCtx.decodeAudioData(ab, ok, ng); if (p && p.then) p.then(ok, ng); } catch (e) { ng(e); }
    });
  }

  var waQueue = [];                 // 第一次触摸之前就想放的（开机的背景音乐）
  function WAPlayer(src) {
    var self = this;
    this.src = src; this.loop = false; this.preload = 'auto';
    this.paused = true; this.ended = false; this.error = null;
    this.plays = 0;                 // 自测用：真正开始出声的次数
    this._vol = 1; this._buf = null; this._node = null; this._gain = null; this._t0 = 0; this._off = 0;
    this.ready = fetch(src)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(decodeAudio)
      .then(function (b) { self._buf = b; if (!self.paused && !self._node) self._start(self._off); return b; })
      .catch(function (e) { self.error = e || new Error('load failed'); });
  }
  WAPlayer.prototype._start = function (offset) {
    if (!this._buf) return;
    this._off = Math.max(0, offset || 0);
    if (!audioUnlocked) { if (waQueue.indexOf(this) < 0) waQueue.push(this); return; }
    var ctx = audioCtx();
    if (!ctx) return;
    this._stopNode();
    var dur = this._buf.duration || 0, off = this._off;
    if (dur) off = this.loop ? off % dur : (off >= dur ? 0 : off);
    var node = ctx.createBufferSource(), gain = ctx.createGain(), self = this;
    node.buffer = this._buf; node.loop = !!this.loop;
    gain.gain.value = this._vol;
    node.connect(gain); gain.connect(ctx.destination);
    node.onended = function () {
      if (self._node !== node) return;              // 被 stop 掉、已经换成新节点的旧节点
      self._node = null; self._gain = null;
      self.paused = true; self.ended = true; self._off = 0;
      try { gain.disconnect(); } catch (e) {}
    };
    node.start(0, off);
    this._node = node; this._gain = gain;
    this._t0 = ctx.currentTime - off;
    this.plays++;
  };
  WAPlayer.prototype._stopNode = function () {
    var n = this._node, g = this._gain;
    this._node = null; this._gain = null;
    if (n) { n.onended = null; try { n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} }
    if (g) { try { g.disconnect(); } catch (e) {} }
  };
  WAPlayer.prototype.play = function () {
    if (this.paused) {
      this.paused = false; this.ended = false;
      if (this._buf) this._start(this._off);        // 还没解码完：解码完自己会接着放
    }
    return Promise.resolve();
  };
  WAPlayer.prototype.pause = function () {
    var i = waQueue.indexOf(this);
    if (i >= 0) waQueue.splice(i, 1);
    if (this.paused) return;
    this._off = this.currentTime;
    this._stopNode();
    this.paused = true;
  };
  Object.defineProperty(WAPlayer.prototype, 'currentTime', {
    get: function () {
      if (!this._node || !actx) return this._off;
      var t = actx.currentTime - this._t0, d = this._buf ? this._buf.duration : 0;
      return d ? (this.loop ? t % d : Math.min(t, d)) : t;
    },
    set: function (v) {
      this._off = Math.max(0, +v || 0);
      if (this._node) this._start(this._off);       // 正在放：从新位置接着放（= <audio> 的 seek）
    }
  });
  Object.defineProperty(WAPlayer.prototype, 'volume', {
    get: function () { return this._vol; },
    set: function (v) {
      this._vol = clamp(+v || 0, 0, 1);
      if (this._gain) { try { this._gain.gain.value = this._vol; } catch (e) {} }
    }
  });
  Object.defineProperty(WAPlayer.prototype, 'duration', { get: function () { return this._buf ? this._buf.duration : NaN; } });
  Object.defineProperty(WAPlayer.prototype, 'playing', { get: function () { return !!this._node; } });

  /* 第一次触摸：建 / 恢复 AudioContext，放一个空声音（老 iOS 的解锁方式），再把排队的背景音乐放起来。
     iOS 只认 touchend / click 这类「松手」事件是用户手势（touchstart、pointerdown 不算），所以绑在这几个上。 */
  function unlockAudio() {
    var ctx = audioCtx();
    if (!ctx) return;
    if (!audioUnlocked) {
      audioUnlocked = true;
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}   // 侧边静音键打开时也出声
      try { var sb = ctx.createBuffer(1, 1, 22050), ss = ctx.createBufferSource(); ss.buffer = sb; ss.connect(ctx.destination); ss.start(0); } catch (e) {}
      waQueue.splice(0).forEach(function (p) {
        if (p.loop && !p.paused) p._start(p._off);
        else if (!p.loop) p.paused = true;          // 排队的一次性音效过时了，不补放
      });
    }
    ensureBgm();
  }
  if (USE_WEBAUDIO) {
    ['touchend', 'pointerup', 'mouseup', 'click', 'keydown'].forEach(function (ev) {
      document.addEventListener(ev, unlockAudio, true);
    });
  }

  /* notes: [{f 起始频率, f2 滑到的频率, t 起始秒, d 时长秒}] */
  function tone(notes, type, vol) {
    var ctx = audioCtx();
    if (!ctx || vol <= 0) return;
    var t0 = ctx.currentTime;
    notes.forEach(function (n) {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(n.f, t0 + n.t);
      if (n.f2) o.frequency.exponentialRampToValueAtTime(n.f2, t0 + n.t + n.d);
      g.gain.setValueAtTime(0.0001, t0 + n.t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + n.t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.t + n.d);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0 + n.t);
      o.stop(t0 + n.t + n.d + 0.03);
    });
  }

  var BUILTIN = {
    /* 按钮：短促干脆的一声 */
    click: function (v) {
      tone([{ f: 1400, f2: 900, t: 0, d: 0.055 }], 'triangle', v * 0.14);
    },
    /* 翻牌：短促上扬的轻响 */
    flip: function (v) {
      tone([{ f: 520, f2: 900, t: 0, d: 0.07 }], 'triangle', v * 0.16);
    },
    /* 配对成功：两声上行清脆音 */
    match: function (v) {
      tone([{ f: 880, t: 0, d: 0.13 }, { f: 1318.5, t: 0.085, d: 0.22 }], 'sine', v * 0.22);
    },
    /* 翻牌错误：两声下行钝响 */
    miss: function (v) {
      tone([{ f: 320, t: 0, d: 0.12 }, { f: 196, t: 0.1, d: 0.24 }], 'square', v * 0.07);
    },
    /* 成功页：上行三音 */
    win: function (v) {
      tone([
        { f: 659.3, t: 0, d: 0.16 },
        { f: 880, t: 0.13, d: 0.16 },
        { f: 1174.7, t: 0.26, d: 0.42 }
      ], 'sine', v * 0.24);
    },
    /* 失败页：下行两音 */
    lose: function (v) {
      tone([{ f: 392, t: 0, d: 0.22 }, { f: 261.6, t: 0.2, d: 0.5 }], 'triangle', v * 0.2);
    }
  };

  function loadAudio(key) {
    return Media.get('audio-' + key).catch(function () { return null; }).then(function (blob) {
      if (audioURLs[key]) { URL.revokeObjectURL(audioURLs[key]); audioURLs[key] = null; }
      if (audio[key] && key === 'bgm') { try { audio[key].pause(); } catch (e) {} }
      audio[key] = null;
      audioNames[key] = '';
      audioFromBundle[key] = false;

      /* 本机上传 > 随包配置 > 内置合成音 */
      var src, name;
      if (blob) {
        audioURLs[key] = URL.createObjectURL(blob);
        src = audioURLs[key];
        name = blob.name || '';
      } else {
        var item = Bundle.audio(key);
        if (!item) return null;
        audioFromBundle[key] = true;
        if (item.url) {
          src = item.url;                                // 引用形式，浏览器直接流式播放
        } else {
          audioURLs[key] = URL.createObjectURL(item.blob);
          src = audioURLs[key];
        }
        name = item.name || '';
      }

      var a = USE_WEBAUDIO ? new WAPlayer(src) : new Audio(src);
      a.preload = 'auto';
      if (key === 'bgm') { a.loop = true; a.volume = bgmTargetVol(); }
      audio[key] = a;
      audioNames[key] = name;
      return a;
    });
  }

  function loadAllAudio() { return Promise.all(AUDIO_KEYS.map(loadAudio)); }

  /* ---------- 背景音乐 ---------- */
  var bgmDucked = false;          // 成功 / 失败页把音乐压低
  var bgmUnlocked = false;        // 浏览器要先有一次用户操作才准出声
  var fadeTimer = null;

  function bgmTargetVol() {
    var v = clamp(Settings.get('bgmVolume') / 100, 0, 1);
    return bgmDucked ? v * 0.25 : v;
  }
  function fadeBgmTo(vol, ms) {
    var a = audio.bgm;
    if (!a) return;
    if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
    var from = a.volume, steps = Math.max(1, Math.round(ms / 25)), i = 0;
    fadeTimer = setInterval(function () {
      i++;
      try { a.volume = clamp(from + (vol - from) * (i / steps), 0, 1); } catch (e) {}
      if (i >= steps) { clearInterval(fadeTimer); fadeTimer = null; }
    }, 25);
  }
  function playBgm(restart) {
    var a = audio.bgm;
    if (!a) return;
    bgmUnlocked = true;
    if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
    a.volume = bgmTargetVol();
    try { if (restart || a.ended) a.currentTime = 0; var p = a.play(); if (p) p.catch(function () {}); } catch (e) {}
  }
  function stopBgm() {
    var a = audio.bgm;
    if (!a) return;
    if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
    try { a.pause(); a.currentTime = 0; } catch (e) {}
  }
  /* 「一直循环」模式下，任何一次用户操作后都确保音乐在放 */
  function ensureBgm() {
    if (Settings.getStr('bgmMode') !== 'always') return;
    var a = audio.bgm;
    if (!a) return;
    if (a.paused) playBgm(false);
  }
  function duckBgm(on) {
    bgmDucked = !!on;
    if (audio.bgm && !audio.bgm.paused) fadeBgmTo(bgmTargetVol(), 350);
  }
  /* 设定改了音量 / 模式之后调用 */
  function refreshBgm() {
    var a = audio.bgm;
    if (!a) return;
    if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
    a.volume = bgmTargetVol();
    if (Settings.getStr('bgmMode') === 'always') { if (bgmUnlocked && a.paused) playBgm(false); }
    else if (!game.running) { try { a.pause(); } catch (e) {} }
  }

  /* 有上传就用上传的，没有就用内置合成音。
     文件坏了 / 格式放不了（error），或者 iPad 上还没解码完，也退回内置音，不至于没声音 */
  function playSfx(key) {
    var v = Settings.get('sfxVolume') / 100;
    if (v <= 0) return;
    var a = audio[key];
    if (a && !a.error && (!USE_WEBAUDIO || a._buf)) {
      try { a.currentTime = 0; a.volume = v; var p = a.play(); if (p) p.catch(function () {}); } catch (e) {}
      return;
    }
    if (BUILTIN[key]) BUILTIN[key](v);
  }

  /* =========================================================
     翻牌手感（快点加速）
     ========================================================= */
  var paceLast = null;           // 上一次点击的时刻
  var paceGap = null;            // 点击间隔的指数平均

  function resetPace() { paceLast = null; paceGap = null; }

  function notePace() {
    var now = performance.now();
    if (paceLast !== null) {
      var gap = now - paceLast;
      paceGap = (paceGap === null) ? gap : (paceGap * (1 - PACE_WEIGHT) + gap * PACE_WEIGHT);
    }
    paceLast = now;
  }

  /* 返回 0~1 的时间缩放系数：点得越快越小 */
  function paceFactor() {
    var up = Settings.get('speedUp') / 100;
    if (up <= 0 || paceGap === null) return 1;
    var k;                                   // 0 = 手速最快，1 = 慢
    if (paceGap <= PACE_FAST) k = 0;
    else if (paceGap >= PACE_SLOW) k = 1;
    else k = (paceGap - PACE_FAST) / (PACE_SLOW - PACE_FAST);
    var minF = 1 - up * 0.75;                // 加速拉满时压缩到 25%
    return minF + (1 - minF) * k;
  }

  /* 把当前翻牌动画时长写进 CSS 变量 */
  function applyFlipSpeed(f) {
    var ms = Math.max(60, Math.round(Settings.get('flipMs') * f));
    stage.style.setProperty('--flip-ms', ms + 'ms');
  }

  /* =========================================================
     计时数字：画在 canvas 上，跟设计稿那个「15」对位
     ========================================================= */
  var timerCv = $('#timer');
  var tctx = timerCv.getContext('2d');
  var timerFontSize = 82;        // 先按 Poppins 大写高 0.698 估，加载后再校准
  var timerShown = null;

  function calibrateTimerFont() {
    var done = function () {
      try {
        tctx.setTransform(1, 0, 0, 1, 0, 0);
        tctx.font = '700 82px Poppins';
        var h = tctx.measureText('0').actualBoundingBoxAscent;
        if (h > 20) timerFontSize = Math.round(82 * LAYOUT.timer.capH / h * 10) / 10;
      } catch (e) {}
    };
    /* canvas 画字不会自动触发 @font-face 加载，必须点名 load（只等 fonts.ready 会拿回退字体画） */
    if (!document.fonts || !document.fonts.load) { done(); return Promise.resolve(); }
    return document.fonts.load('700 82px Poppins').then(done, done);
  }

  function drawTimer(n, force) {
    n = Math.max(0, n | 0);
    if (!force && n === timerShown) return;
    timerShown = n;
    var W = 240, H = 110, S = 2;
    tctx.setTransform(S, 0, 0, S, 0, 0);
    tctx.clearRect(0, 0, W, H);
    tctx.font = '700 ' + timerFontSize + 'px Poppins';
    tctx.fillStyle = '#FFFFFF';
    tctx.textAlign = 'center';
    tctx.textBaseline = 'alphabetic';
    var s = String(n);
    var m = tctx.measureText(s);
    var asc = m.actualBoundingBoxAscent || LAYOUT.timer.capH;
    tctx.fillText(s, LAYOUT.timer.cx - LAYOUT.timer.left, (LAYOUT.timer.capTop - LAYOUT.timer.top) + asc);
    timerCv.classList.toggle('urgent', n > 0 && n <= 5 && game.running);
  }

  /* =========================================================
     游戏本体
     ========================================================= */
  var grid = $('#grid');

  var game = {
    deck: [], first: null, pending: null, matched: 0,
    running: false, endAt: 0, clock: 0, timeouts: []
  };

  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    game.timeouts.push(id);
    return id;
  }
  function drop(id) {
    clearTimeout(id);
    var i = game.timeouts.indexOf(id);
    if (i >= 0) game.timeouts.splice(i, 1);
  }
  function clearTimers() {
    game.timeouts.forEach(clearTimeout);
    game.timeouts = [];
    if (game.clock) { clearInterval(game.clock); game.clock = 0; }
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function buildDeck() {
    var deck = [];
    for (var i = 0; i < PAIRS; i++) { deck.push(i, i); }
    return shuffle(deck);
  }

  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function img(cls, src) { var e = el('img', cls); e.src = src; e.alt = ''; e.draggable = false; return e; }

  function renderGrid(deck, faceUp) {
    grid.innerHTML = '';
    var frag = document.createDocumentFragment();
    deck.forEach(function (faceIdx, pos) {
      var r = (pos / 3) | 0, c = pos % 3;
      var card = el('div', 'card');
      card.style.left = (LAYOUT.cols[c] - LAYOUT.margin) + 'px';
      card.style.top = (LAYOUT.rows[r] - LAYOUT.margin) + 'px';
      card.dataset.face = faceIdx;
      card.dataset.pos = pos;

      var inner = el('div', 'card-inner');
      inner.appendChild(img('card-back', IMG.back));

      var front = el('div', 'card-front');
      var f = faces[faceIdx];
      if (f.full) {
        front.appendChild(img('face-full', f.url));
      } else {
        front.appendChild(img('face-blank', IMG.blank));
        front.appendChild(img('face-icon', f.url));
      }
      front.appendChild(img('face-red', IMG.red));
      inner.appendChild(front);
      card.appendChild(inner);

      if (faceUp) card.classList.add('flipped', 'locked');
      else card.addEventListener('click', onCardClick);
      frag.appendChild(card);
    });
    grid.appendChild(frag);
  }

  /* ---------- 上一对的结算 ---------- */
  function finishMatch(a, b) {
    a.classList.add('matched', 'locked');
    b.classList.add('matched', 'locked');
    a.classList.remove('flipped');
    b.classList.remove('flipped');
    game.matched++;
    if (game.matched === PAIRS) win();
  }

  function finishMiss(a, b) {
    a.classList.remove('flipped', 'wrong');
    b.classList.remove('flipped', 'wrong');
  }

  /* 立刻结算还在等待中的一对（抢先翻牌用） */
  function resolvePending() {
    var p = game.pending;
    if (!p) return;
    drop(p.id);
    game.pending = null;
    if (p.type === 'match') finishMatch(p.a, p.b);
    else finishMiss(p.a, p.b);
  }

  function onCardClick(e) {
    var card = e.currentTarget;
    if (!game.running) return;

    notePace();

    if (game.pending) {
      if (!Settings.get('instantAdvance')) return;   // 关掉抢先翻牌 → 老老实实等
      resolvePending();
      if (!game.running) return;                     // 结算后可能已经赢了
    }
    if (card.classList.contains('matched') || card.classList.contains('flipped')) return;

    var f = paceFactor();
    applyFlipSpeed(f);

    card.classList.add('flipped');
    playSfx('flip');

    if (!game.first) { game.first = card; return; }

    var a = game.first, b = card;
    if (a === b) return;                               // 同一张牌不可能配自己
    game.first = null;

    if (a.dataset.face === b.dataset.face) {
      playSfx('match');
      var holdM = Math.round(Settings.get('matchHold') * f);
      game.pending = { a: a, b: b, type: 'match', id: later(function () {
        game.pending = null;
        finishMatch(a, b);
      }, holdM) };
    } else {
      playSfx('miss');
      a.classList.add('wrong');
      b.classList.add('wrong');
      var holdX = Math.round(Settings.get('missHold') * f);
      game.pending = { a: a, b: b, type: 'miss', id: later(function () {
        game.pending = null;
        finishMiss(a, b);
      }, holdX) };
    }
  }

  /* 计时：整数秒（跟设计稿「15」一样），setInterval 不靠 rAF —— 后台 / 屏幕外也照走 */
  function tick() {
    if (!game.running) return;
    var left = (game.endAt - performance.now()) / 1000;
    if (left <= 0) { drawTimer(0, true); timeUp(); return; }
    drawTimer(Math.ceil(left));
  }

  /* 时间到：配齐的组数 >= 成功门槛（默认 4）→ 成功页，否则 → 失败页。
     还在「配对成功停顿」里的那一对也算数（玩家已经翻对了，只是动画没走完）；
     停顿中的错误对不管，一局结束了翻不翻回去无所谓。 */
  function winPairs() { return clamp(Math.round(Settings.get('winPairs')), 1, PAIRS); }
  function timeUp() {
    var p = game.pending;
    if (p && p.type === 'match') {
      drop(p.id);
      game.pending = null;
      p.a.classList.add('matched', 'locked');
      p.b.classList.add('matched', 'locked');
      game.matched++;
    }
    if (game.matched >= winPairs()) win(); else lose();
  }
  function startClock() {
    if (game.clock) clearInterval(game.clock);
    game.clock = setInterval(tick, 100);
  }

  /* ---------- 一局的生命周期 ---------- */
  function startRound() {
    clearTimers();
    game.deck = buildDeck();          // 每局重新随机
    game.first = null;
    game.pending = null;
    game.matched = 0;
    game.running = false;
    resetPace();
    applyFlipSpeed(1);

    renderGrid(game.deck, false);
    drawTimer(Settings.get('gameTime'), true);
    show('game');
    countIn(function () {
      game.running = true;
      game.endAt = performance.now() + Settings.get('gameTime') * 1000;
      if (Settings.getStr('bgmMode') === 'game') playBgm(true);
      startClock();
    });
  }

  function countIn(done) {
    var overlay = $('#countdown');
    var num = $('#countdown-num');
    var n = clamp(Math.round(Settings.get('countIn')), 0, 10);

    if (n === 0) { overlay.hidden = true; done(); return; }
    overlay.hidden = false;

    function step() {
      if (n === 0) {
        num.classList.remove('tick');
        void num.offsetWidth;
        num.textContent = (Settings.getStr('goText') || 'MULA!').slice(0, 12);
        num.classList.add('tick', 'go');
        later(function () {
          overlay.hidden = true;
          num.classList.remove('go');
          done();
        }, 650);
        return;
      }
      num.classList.remove('tick', 'go');
      void num.offsetWidth;
      num.textContent = String(n);
      num.classList.add('tick');
      n--;
      later(step, 1000);
    }
    step();
  }

  function endRound() {
    game.running = false;
    game.pending = null;
    clearTimers();
    timerCv.classList.remove('urgent');
    if (Settings.getStr('bgmMode') === 'game') stopBgm();
  }

  function secs(key) { return Math.max(0.2, Settings.get(key)) * 1000; }

  /* 结果页靠玩家点按钮往下走；没人点的话，超过 resultIdle 秒自动进最后一页（0 = 一直等） */
  function armResultIdle() {
    var idle = Settings.get('resultIdle');
    if (idle > 0) later(goLast, idle * 1000);
  }
  function win() {
    endRound();
    show('success');
    duckBgm(true);
    playSfx('win');
    armResultIdle();
  }
  function lose() {
    endRound();
    show('fail');
    duckBgm(true);
    playSfx('lose');
    armResultIdle();
  }
  function goLast() {
    clearTimers();
    show('last');
    duckBgm(false);
    later(goHome, secs('lastSeconds'));
  }
  function goHome() {
    endRound();
    duckBgm(false);
    $('#countdown').hidden = true;
    show('home');
  }

  /* =========================================================
     绑定：首页 / 结果页
     ========================================================= */
  $('#btn-start').addEventListener('click', function () {
    if (current !== 'home') return;
    audioCtx();                       // 首次点击是用户手势，在这里解锁音频
    playSfx('click');
    ensureBgm();
    loadFaces().then(startRound);
  });

  /* 成功页 TEBUS HADIAH / 失败页 CUBA LAGI：点了才进最后一页 */
  $$('[data-next]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (current !== 'success' && current !== 'fail') return;
      playSfx('click');
      goLast();
    });
  });

  $('#btn-ref-back').addEventListener('click', function () { show('settings'); });

  /* 「一直循环」模式：任何一次用户操作都顺手把背景音乐拉起来
     （浏览器要求先有用户手势才准出声；ensureBgm 自己会判断模式） */
  document.addEventListener('pointerdown', ensureBgm, true);

  /* =========================================================
     设定页
     ========================================================= */
  var trigger = $('#settings-trigger');
  var lastTap = -1e9;
  var settingsClosedAt = -1e9;
  var armTimer = 0;

  function openSettings() {
    if (current === 'settings' || current === 'reference' || current === 'game') return;
    clearTimers();                    // 结果页的自动跳转先停掉
    duckBgm(false);
    audioCtx();
    syncSettingsUI();
    show('settings');
    /* 刚打开的 400ms 盖一层透明护盾：触摸屏上双击角落时手快多点的第三下，
       正好会落在同样在右上角的「关闭」按钮上，一打开就又被关掉 */
    pages.settings.classList.add('arming');
    clearTimeout(armTimer);
    armTimer = setTimeout(function () { pages.settings.classList.remove('arming'); }, 400);
  }
  function leaveSettings() {
    saveSettings();
    settingsClosedAt = performance.now();
    goHome();
  }
  /* 角落入口：刚关掉设定页的 700ms 内不认（关掉那一下之后多出来的连点会又把它点开） */
  function cornerOpen() {
    if (performance.now() - settingsClosedAt < 700) return;
    openSettings();
  }

  trigger.addEventListener('dblclick', cornerOpen);
  trigger.addEventListener('touchend', function (e) {
    var now = Date.now();
    if (now - lastTap < 400) { e.preventDefault(); lastTap = -1e9; cornerOpen(); return; }
    lastTap = now;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'F2' || e.key === 'F1') { e.preventDefault(); openSettings(); }
    else if (e.key === 'Escape' && current === 'settings') { leaveSettings(); }
  });

  $('#set-close').addEventListener('click', function () { leaveSettings(); });
  $('#set-save').addEventListener('click', function () {
    toast(t('toast.saved'));
    leaveSettings();
  });
  $('#btn-ref').addEventListener('click', function () {
    saveSettings();
    loadFaces().then(function () {
      renderGrid(LAYOUT.ref, true);
      drawTimer(Settings.get('gameTime'), true);
      show('reference');
    });
  });

  function clampInt(el, lo, hi, fallback) {
    var v = parseInt(el.value, 10);
    if (isNaN(v)) v = fallback;
    return clamp(v, lo, hi);
  }

  function saveSettings() {
    Settings.set('gameTime', clampInt($('#cfg-time'), 5, 600, 15));
    Settings.set('countIn', clampInt($('#cfg-count'), 0, 10, 3));
    Settings.set('winPairs', clampInt($('#cfg-winpairs'), 1, PAIRS, 4));
    Settings.set('lastSeconds', clampInt($('#cfg-last'), 1, 120, 5));
    Settings.set('resultIdle', clampInt($('#cfg-result'), 0, 600, 60));
    Settings.set('goText', ($('#cfg-gotext').value || 'MULA!').trim().slice(0, 12) || 'MULA!');
    Settings.set('bgmVolume', clampInt($('#cfg-vol'), 0, 100, 70));
    Settings.set('sfxVolume', clampInt($('#cfg-sfxvol'), 0, 100, 80));
    Settings.set('flipMs', clampInt($('#cfg-flipms'), 100, 800, 420));
    Settings.set('matchHold', clampInt($('#cfg-matchhold'), 0, 800, 260));
    Settings.set('missHold', clampInt($('#cfg-misshold'), 200, 2000, 800));
    Settings.set('speedUp', clampInt($('#cfg-speedup'), 0, 100, 60));
    applyFlipSpeed(1);
    refreshBgm();
    drawTimer(Settings.get('gameTime'), true);
  }

  function syncSettingsUI() {
    I18N.apply();
    $('#bundle-state').textContent = Bundle.present
      ? t('bundle.yes', { when: (Bundle.exportedAt || '').slice(0, 19).replace('T', ' ') })
      : t('bundle.none');
    renderLangPicker();
    renderInstantPicker();
    renderBgmModePicker();
    $('#cfg-time').value = Settings.get('gameTime');
    $('#cfg-count').value = Settings.get('countIn');
    $('#cfg-winpairs').value = winPairs();
    $('#cfg-last').value = Settings.get('lastSeconds');
    $('#cfg-result').value = Settings.get('resultIdle');
    $('#cfg-gotext').value = Settings.getStr('goText');
    $('#cfg-vol').value = Settings.get('bgmVolume');
    $('#cfg-sfxvol').value = Settings.get('sfxVolume');
    $('#cfg-flipms').value = Settings.get('flipMs');
    $('#cfg-matchhold').value = Settings.get('matchHold');
    $('#cfg-misshold').value = Settings.get('missHold');
    $('#cfg-speedup').value = Settings.get('speedUp');
    refreshVals();
    refreshAudioRows();
    refreshFaceGrid();
  }

  function refreshVals() {
    var ms = ' ' + t('unit.ms');
    $('#cfg-vol-val').textContent = $('#cfg-vol').value + '%';
    $('#cfg-sfxvol-val').textContent = $('#cfg-sfxvol').value + '%';
    $('#cfg-flipms-val').textContent = $('#cfg-flipms').value + ms;
    $('#cfg-matchhold-val').textContent = $('#cfg-matchhold').value + ms;
    $('#cfg-misshold-val').textContent = $('#cfg-misshold').value + ms;
    $('#cfg-speedup-val').textContent = $('#cfg-speedup').value + '%';
  }

  /* 滑杆即时生效，方便一边拖一边试 */
  ['#cfg-vol', '#cfg-sfxvol', '#cfg-flipms', '#cfg-matchhold', '#cfg-misshold', '#cfg-speedup']
    .forEach(function (sel) {
      $(sel).addEventListener('input', function () {
        refreshVals();
        if (sel === '#cfg-vol') { Settings.set('bgmVolume', parseInt(this.value, 10) || 0); if (audio.bgm) audio.bgm.volume = bgmTargetVol(); }
        if (sel === '#cfg-sfxvol') Settings.set('sfxVolume', parseInt(this.value, 10) || 0);
        if (sel === '#cfg-flipms') { Settings.set('flipMs', parseInt(this.value, 10) || 420); applyFlipSpeed(1); }
      });
    });

  /* ---------- 分段选择器 ---------- */
  function segment(wrap, options, currentValue, onPick) {
    wrap.innerHTML = '';
    options.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg-btn' + (o.value === currentValue ? ' on' : '');
      b.textContent = o.label;
      b.addEventListener('click', function () {
        if (o.value === currentValue) return;
        onPick(o.value);
      });
      wrap.appendChild(b);
    });
  }

  function renderLangPicker() {
    segment($('#lang-pick'),
      I18N.langs.map(function (l) { return { value: l.code, label: l.label }; }),
      I18N.current,
      function (code) { I18N.setLang(code); syncSettingsUI(); });
  }
  function onOff() { return [{ value: 1, label: t('state.on') }, { value: 0, label: t('state.off') }]; }
  function renderInstantPicker() {
    segment($('#instant-pick'), onOff(), Settings.get('instantAdvance') ? 1 : 0,
      function (v) { Settings.set('instantAdvance', v); renderInstantPicker(); });
  }
  function renderBgmModePicker() {
    segment($('#bgmmode-pick'),
      [{ value: 'always', label: t('bgm.always') }, { value: 'game', label: t('bgm.game') }],
      Settings.getStr('bgmMode'),
      function (v) { Settings.set('bgmMode', v); refreshBgm(); renderBgmModePicker(); });
  }

  /* ---------- 音频行 ---------- */
  function refreshAudioRows() {
    $$('.audio-row').forEach(function (row) {
      var key = row.dataset.key;
      var has = !!audio[key];
      var local = has && !audioFromBundle[key];
      $('.fname', row).textContent = !has
        ? (key === 'bgm' ? t('state.none') : t('state.builtin'))
        : (audioFromBundle[key]
            ? t('state.bundled') + (audioNames[key] ? '（' + audioNames[key] + '）' : '')
            : audioNames[key]);
      var play = $('[data-play]', row);
      var canPlay = has || key !== 'bgm';        // 内置音效随时可试听
      play.disabled = !canPlay;
      play.style.opacity = canPlay ? 1 : .4;
      var clear = $('[data-clear]', row);
      clear.disabled = !local;                   // 随包音效不能在这里删
      clear.style.opacity = local ? 1 : .4;
    });
  }

  $$('.audio-row').forEach(function (row) {
    var key = row.dataset.key;

    $('[data-pick]', row).addEventListener('change', function () {
      var f = this.files && this.files[0];
      this.value = '';
      if (!f) return;
      Media.put('audio-' + key, f)
        .then(function () { return loadAudio(key); })
        .then(function () {
          refreshAudioRows();
          refreshBgm();
          toast(t('toast.updated', { name: t('lbl.' + key) }));
        })
        .catch(function () { toast(t('toast.failed')); });
    });

    $('[data-clear]', row).addEventListener('click', function () {
      Media.del('audio-' + key)
        .catch(function () {})
        .then(function () { return loadAudio(key); })
        .then(function () {
          refreshAudioRows();
          toast(t('toast.cleared', { name: t('lbl.' + key) }));
        });
    });

    $('[data-play]', row).addEventListener('click', function () {
      audioCtx();
      if (key === 'bgm') {
        if (!audio.bgm) { toast(t('toast.nobgm')); return; }
        playBgm(true);
        if (Settings.getStr('bgmMode') !== 'always') later(stopBgm, 6000);
      } else {
        playSfx(key);
      }
    });
  });

  /* ---------- 6 张牌面素材 ---------- */
  function refreshFaceGrid() {
    var wrap = $('#face-grid');
    wrap.innerHTML = '';
    for (var i = 0; i < PAIRS; i++) {
      (function (i) {
        var label = t('face.n', { n: i + 1 });
        var f = faces[i];
        var slot = el('div', 'face-slot');

        var thumb = el('div', 'thumb');
        if (f.full) {
          thumb.appendChild(img('t-full', f.url));
        } else {
          thumb.appendChild(img('t-blank', IMG.blank));
          thumb.appendChild(img('t-icon', f.url));
        }
        var input = el('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', function () {
          var file = this.files && this.files[0];
          this.value = '';
          if (!file) return;
          Media.put('face' + i, file)
            .then(loadFaces)
            .then(function () {
              refreshFaceGrid();
              toast(t('toast.updated', { name: label }));
            })
            .catch(function () { toast(t('toast.failed')); });
        });
        thumb.appendChild(input);

        var cap = el('div', 'cap');
        cap.textContent = label;
        var tag = el('span', 'tag' + (f.custom ? ' custom' : ''));
        tag.textContent = f.custom ? t('face.custom') : t('face.default');
        cap.appendChild(tag);

        slot.appendChild(thumb);
        slot.appendChild(cap);
        wrap.appendChild(slot);
      })(i);
    }
  }

  /* =========================================================
     导出当前配置 → 覆盖到 assets/bundle/config.json，
     整个文件夹拷到别的机器上第一次打开就是这套素材 / 音效 / 参数
     ========================================================= */
  function blobToB64(blob) {
    return new Promise(function (resolve) {
      var fr = new FileReader();
      fr.onload = function () {
        var s = String(fr.result);
        resolve({ name: blob.name || '', type: blob.type || '', data: s.slice(s.indexOf(',') + 1) });
      };
      fr.onerror = function () { resolve(null); };
      fr.readAsDataURL(blob);
    });
  }

  /* 导出一项素材：
       本机上传过 → 编码成 base64 内嵌
       没改过     → 原样搬用配置包里的条目（引用形式的大文件不会被撑大）
       都没有     → null，表示用出厂默认 */
  function exportItem(mediaKey, rawEntry) {
    return Media.get(mediaKey)
      .then(function (b) { return b ? blobToB64(b) : rawEntry; })
      .catch(function () { return rawEntry; });
  }

  function exportConfig() {
    var settings = {};
    Settings.keys.forEach(function (k) {
      settings[k] = Settings.isStr(k) ? Settings.getStr(k) : Settings.get(k);
    });

    var faceJobs = [];
    for (var i = 0; i < PAIRS; i++) {
      faceJobs.push(exportItem('face' + i, Bundle.rawFace(i)));
    }
    var audioJobs = AUDIO_KEYS.map(function (k) {
      return exportItem('audio-' + k, Bundle.rawAudio(k));
    });

    return Promise.all([Promise.all(faceJobs), Promise.all(audioJobs)]).then(function (res) {
      var au = {};
      AUDIO_KEYS.forEach(function (k, idx) { au[k] = res[1][idx]; });
      var out = {
        version: 1,
        exportedAt: new Date().toISOString(),
        note: '把本文件覆盖到 assets/bundle/config.json，这个文件夹在任何机器上第一次打开就是这套配置',
        settings: settings,
        faces: res[0],
        audio: au
      };
      var json = JSON.stringify(out);
      var url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      var a = document.createElement('a');
      a.href = url;
      a.download = 'config.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      return Math.round(json.length / 1024);
    });
  }

  $('#btn-export').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    saveSettings();
    exportConfig()
      .then(function (kb) { toast(t('toast.exported', { kb: kb })); })
      .catch(function () { toast(t('toast.failed')); })
      .then(function () { btn.disabled = false; });
  });

  /* 清掉本机所有改动，回到随包配置 / 出厂默认 */
  $('#btn-factory-reset').addEventListener('click', function () {
    var jobs = [];
    for (var i = 0; i < PAIRS; i++) jobs.push(Media.del('face' + i).catch(function () {}));
    AUDIO_KEYS.forEach(function (k) { jobs.push(Media.del('audio-' + k).catch(function () {})); });
    Promise.all(jobs)
      .then(function () {
        Settings.clearLocal();
        I18N.setLang(Settings.getStr('lang'), false);
        applyFlipSpeed(1);
        return Promise.all([loadFaces(), loadAllAudio()]);
      })
      .then(function () {
        refreshBgm();
        syncSettingsUI();
        toast(t('toast.factoryreset'));
      });
  });

  $('#btn-faces-reset').addEventListener('click', function () {
    var jobs = [];
    for (var i = 0; i < PAIRS; i++) jobs.push(Media.del('face' + i).catch(function () {}));
    Promise.all(jobs)
      .then(loadFaces)
      .then(function () { refreshFaceGrid(); toast(t('toast.facesreset')); });
  });

  /* =========================================================
     启动
     ========================================================= */
  /* 先读随包配置，再按它初始化语言与素材 */
  Bundle.load().then(function () {
    I18N.setLang(Settings.getStr('lang'), false);   // 只应用，不固化成本机改动
    applyFlipSpeed(1);
    return Promise.all([loadFaces(), loadAllAudio(), calibrateTimerFont()]);
  }).then(function () {
    drawTimer(Settings.get('gameTime'), true);
    show('home');
    /* 「一直循环」模式：开机就试着把背景音乐放起来。
       浏览器不给自动播放的话 play() 会被拒（已吞掉），等第一次点击再由 ensureBgm 补上；
       安装版 exe 和 启动游戏.bat 都开了 no-user-gesture-required，这里就直接响了。 */
    ensureBgm();
  });

  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('contextmenu', function (e) {
    if (current !== 'settings') e.preventDefault();
  });
  document.addEventListener('touchmove', function (e) {
    if (current !== 'settings') e.preventDefault();
  }, { passive: false });

  /* 排障 / 自测用：控制台敲 KPJ.state() */
  window.KPJ = {
    state: function () {
      return {
        page: current, running: game.running, matched: game.matched, winPairs: winPairs(), deck: game.deck.slice(),
        left: game.running ? Math.max(0, (game.endAt - performance.now()) / 1000) : null,
        timerShown: timerShown, timerFontSize: timerFontSize,
        faces: faces.map(function (f) { return { full: f.full, custom: f.custom }; }),
        bgm: audio.bgm ? { paused: audio.bgm.paused, volume: audio.bgm.volume } : null,
        audio: {
          mode: USE_WEBAUDIO ? 'webaudio' : 'html',
          ctx: actx ? actx.state : null,
          unlocked: audioUnlocked,
          players: AUDIO_KEYS.reduce(function (o, k) {
            var a = audio[k];
            o[k] = !a ? null : {
              ready: USE_WEBAUDIO ? !!a._buf : a.readyState >= 1,
              error: !!a.error, paused: a.paused,
              playing: USE_WEBAUDIO ? a.playing : !a.paused,
              volume: Math.round(a.volume * 1000) / 1000,
              plays: a.plays || 0
            };
            return o;
          }, {})
        },
        fontLoaded: !!(document.fonts && document.fonts.check && document.fonts.check('700 82px Poppins'))
      };
    },
    show: show, startRound: startRound, goHome: goHome, openSettings: openSettings,
    toast: toast, fit: fitStage,
    layout: LAYOUT
  };
})();
