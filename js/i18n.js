/* =========================================================
   i18n.js — 设定页语言
   新增语言：在 LANGS 里加一项，在 DICT 里补一套 key 即可，
   其余程式码不需要改动。
   游戏本身的五个页面是设计稿图片（马来文），不随这里切换。
   ========================================================= */
(function (global) {
  'use strict';

  /* 语言清单：code 用于存档，label 是选择器上显示的名字 */
  var LANGS = [
    { code: 'zh', label: '中文' },
    { code: 'en', label: 'English' }
  ];

  var DICT = {
    zh: {
      'set.title':        '游戏设定',
      'set.close':        '关闭',
      'set.save':         '保存并返回首页',

      'sec.time':         '一、时间',
      'lbl.time':         '游戏限时（秒）',
      'lbl.countin':      '开局倒数（秒）',
      'lbl.winpairs':     '成功门槛（组）',
      'lbl.last':         '最后一页停留（秒）',
      'lbl.result':       '结果页无人点击自动跳转（秒）',
      'lbl.gotext':       '倒数结束的字样',
      'hint.time':        '限时内配齐 6 组立刻进成功页；时间到时按配齐的组数判定：达到「成功门槛」（默认 4，即 4~6 组）→ 成功页，不够（0~3 组）→ 失败页。门槛填 6 = 必须全部配齐才算成功。成功页点 TEBUS HADIAH、失败页点 CUBA LAGI 进最后一页，最后一页停留到点自动回首页（倒数不显示在屏幕上）。「结果页无人点击自动跳转」是防止有人玩完就走、画面卡在结果页的保险：超过这个秒数没人点按钮就自动进最后一页，填 0 = 一直等人点。开局倒数填 0 则跳过。',

      'sec.feel':         '二、翻牌手感',
      'lbl.flipms':       '翻牌动画',
      'lbl.matchhold':    '配对成功停顿',
      'lbl.misshold':     '配对失败回翻',
      'lbl.speedup':      '快点加速',
      'lbl.instant':      '抢先翻牌',
      'hint.feel':        '「快点加速」：连续快速点击时，上面三项自动按比例缩短，点得越快翻得越快；拉到 0 关闭。「抢先翻牌」：两张不配对的牌还没翻回去时，直接点第三张即可立刻继续，不必等。',

      'sec.audio':        '三、音乐与音效',
      'lbl.bgm':          '背景音乐',
      'lbl.bgmmode':      '背景音乐播放',
      'lbl.win':          '成功页音效',
      'lbl.lose':         '失败页音效',
      'lbl.flip':         '翻牌音效',
      'lbl.miss':         '翻牌错误音效',
      'lbl.match':        '配对成功音效',
      'lbl.click':        '按钮音效',
      'lbl.bgmvol':       '背景音乐音量',
      'lbl.sfxvol':       '音效音量',
      'hint.audio':       '背景音乐没上传就不播。「一直循环」= 玩家第一次点 MULA 之后整天循环，进成功 / 失败页会自动压低让位给音效；「只在游戏中」= 开局倒数结束才播，一局结束就停。其余音效没上传时用内置合成音，点「清除」就回到内置音。',
      'bgm.always':       '一直循环',
      'bgm.game':         '只在游戏中',

      'btn.play':         '试听',
      'btn.pick':         '选择',
      'btn.clear':        '清除',
      'state.builtin':    '内置音效',
      'state.none':       '未设定',
      'state.on':         '开',
      'state.off':        '关',
      'unit.ms':          '毫秒',

      'sec.faces':        '四、牌面图片（6 组）',
      'btn.facesreset':   '恢复预设牌面',
      'btn.ref':          '查看参考图',
      'btn.back':         '返回',
      'hint.faces':       '每张图会成对出现，共 12 张牌，每局位置重新随机。点缩略图即可换图：上传的图片会放在米白色的牌面中央（建议正方形 PNG，带透明底最好，至少 400 × 400）。「恢复预设牌面」还原成设计稿自带的 6 张。',
      'face.n':           '第 {n} 组',
      'face.default':     '设计稿',
      'face.custom':      '已上传',

      'sec.bundle':       '五、配置打包',
      'btn.export':       '导出当前配置',
      'btn.factoryreset': '恢复出厂设置',
      'state.bundled':    '随包配置',
      'bundle.none':      '这个文件夹没有随包配置（assets/bundle/config.json），使用出厂默认。',
      'bundle.yes':       '已读到随包配置（导出于 {when}）。',
      'hint.bundle':      '点「导出当前配置」会下载一个 config.json，内含此刻生效的 6 张牌面、全部音效与所有参数。把它覆盖到 assets/bundle/config.json，这个文件夹拷到任何一台机器上第一次打开就是这套配置。「恢复出厂设置」清除本机的全部改动（含上传的图片和音频），回到随包配置 / 出厂默认。',

      'toast.saved':      '已保存',
      'toast.exported':   '已导出 config.json（{kb} KB）',
      'toast.factoryreset': '已恢复出厂设置',
      'toast.updated':    '{name}已更新',
      'toast.cleared':    '{name}已清除',
      'toast.failed':     '保存失败：文件可能过大，或者是用 file:// 直接打开的（请用 启动游戏.bat）',
      'toast.facesreset': '已恢复预设牌面',
      'toast.nobgm':      '还没有背景音乐',

      /* ---- 以下只有 iPad 版用得到（ipad.js 在设定页加的「六、iPad 离线」卡片） ---- */
      'sec.ipad':         '六、iPad 离线',
      'lbl.runmode':      '运行方式',
      'lbl.offline':      '离线资源',
      'lbl.storage':      '存储',
      'lbl.wakelock':     '屏幕常亮',
      'ipad.standalone':  '主画面 App ✓',
      'ipad.browser':     'Safari 网页 —— 请改从主画面的「KPJ Game」图标打开（Safari 和主画面 App 的资料是分开的）',
      'ipad.ready':       '已就绪 ✓ 可以断网使用（{n} 个文件，{mb} MB，版本 {v}）',
      'ipad.partial':     '下载中 {c} / {n}……',
      'ipad.none':        '未就绪：请在电脑的「iPad安装服务」运行时打开一次',
      'ipad.nosw':        '不可用：要从 https 网址打开（用电脑上的 iPad安装服务 安装）',
      'ipad.swerror':     '出错：{e}',
      'ipad.persisted':   '已设为持久保存，系统不会自动清掉',
      'ipad.notpersisted':'普通保存（从主画面打开、常用的话一般不会被清掉）',
      'ipad.wake.on':     '已开启',
      'ipad.wake.off':    '系统没给 —— 请到 设置 → 显示与亮度 → 自动锁定 选「永不」',
      'btn.checkupdate':  '检查更新',
      'toast.update.none':  '已经是最新版本',
      'toast.update.found': '发现新版本，正在下载，回到首页时自动换新',
      'toast.update.fail':  '连不上安装服务（断网时是正常的）',
      'hint.ipad':        'iPad 版装在主画面后可以完全断网使用，设定和上传的图片 / 音乐都存在这台 iPad 里。要更新游戏：电脑上重新运行「iPad安装服务.bat」，iPad 连同一个 Wi-Fi，打开游戏进设定点「检查更新」，回到首页就会换成新版。'
    },

    en: {
      'set.title':        'Settings',
      'set.close':        'Close',
      'set.save':         'Save & back to home',

      'sec.time':         '1. Timing',
      'lbl.time':         'Game time limit (sec)',
      'lbl.countin':      'Count-in (sec)',
      'lbl.winpairs':     'Pairs needed to win',
      'lbl.last':         'Last screen (sec)',
      'lbl.result':       'Result screen idle timeout (sec)',
      'lbl.gotext':       'Word shown after count-in',
      'hint.time':        'All 6 pairs before the time is up → success screen immediately. When time runs out the matched pairs decide: at least "Pairs needed to win" (default 4, i.e. 4–6 pairs) → success screen, fewer (0–3) → fail screen. Set it to 6 to require every pair. Tap TEBUS HADIAH / CUBA LAGI to continue to the last screen, which returns to home automatically (that countdown is not shown). "Result screen idle timeout" is a safety net for players who walk away without tapping: after this many seconds the last screen comes up by itself; 0 = wait forever. Count-in 0 skips it.',

      'sec.feel':         '2. Card feel',
      'lbl.flipms':       'Flip animation',
      'lbl.matchhold':    'Pause after a match',
      'lbl.misshold':     'Flip-back delay',
      'lbl.speedup':      'Fast-tap speed-up',
      'lbl.instant':      'Interrupt to continue',
      'hint.feel':        '"Fast-tap speed-up": while the player taps quickly the three timings above shorten proportionally. Set to 0 to disable. "Interrupt to continue": tapping a third card while a mismatched pair is still shown flips them back immediately instead of waiting.',

      'sec.audio':        '3. Music & sounds',
      'lbl.bgm':          'Background music',
      'lbl.bgmmode':      'Music playback',
      'lbl.win':          'Success screen sound',
      'lbl.lose':         'Fail screen sound',
      'lbl.flip':         'Card flip sound',
      'lbl.miss':         'Wrong pair sound',
      'lbl.match':        'Match sound',
      'lbl.click':        'Button sound',
      'lbl.bgmvol':       'Music volume',
      'lbl.sfxvol':       'Sound effects volume',
      'hint.audio':       'No music plays until one is uploaded. "Loop always" = loops all day after the first MULA tap, ducked on the success / fail screens; "During game only" = starts after the count-in and stops when the round ends. Other sounds fall back to a built-in tone until uploaded; "Clear" returns to the built-in tone.',
      'bgm.always':       'Loop always',
      'bgm.game':         'During game only',

      'btn.play':         'Preview',
      'btn.pick':         'Choose',
      'btn.clear':        'Clear',
      'state.builtin':    'Built-in',
      'state.none':       'Not set',
      'state.on':         'On',
      'state.off':        'Off',
      'unit.ms':          'ms',

      'sec.faces':        '4. Card images (6 pairs)',
      'btn.facesreset':   'Restore default images',
      'btn.ref':          'View reference',
      'btn.back':         'Back',
      'hint.faces':       'Each image appears twice (12 cards), shuffled every round. Tap a thumbnail to replace it: uploaded images are centred on the cream card face (square PNG with transparency, at least 400 × 400, works best). "Restore default images" brings back the 6 artwork faces.',
      'face.n':           'Pair {n}',
      'face.default':     'Artwork',
      'face.custom':      'Uploaded',

      'sec.bundle':       '5. Config bundle',
      'btn.export':       'Export current config',
      'btn.factoryreset': 'Factory reset',
      'state.bundled':    'Bundled',
      'bundle.none':      'No bundled config in this folder (assets/bundle/config.json); factory defaults are in use.',
      'bundle.yes':       'Bundled config loaded (exported {when}).',
      'hint.bundle':      '"Export current config" downloads a config.json containing the 6 card images, every sound and all parameters currently in effect. Drop it over assets/bundle/config.json and this folder starts with exactly this setup on any machine. "Factory reset" clears every local change (including uploaded images and audio) and returns to the bundled config / factory defaults.',

      'toast.saved':      'Saved',
      'toast.exported':   'Exported config.json ({kb} KB)',
      'toast.factoryreset': 'Factory settings restored',
      'toast.updated':    '{name} updated',
      'toast.cleared':    '{name} cleared',
      'toast.failed':     'Save failed: file too large, or the page was opened via file:// (use 启动游戏.bat)',
      'toast.facesreset': 'Default images restored',
      'toast.nobgm':      'No background music yet',

      /* ---- iPad build only (the "6. iPad offline" card added by ipad.js) ---- */
      'sec.ipad':         '6. iPad offline',
      'lbl.runmode':      'Running as',
      'lbl.offline':      'Offline files',
      'lbl.storage':      'Storage',
      'lbl.wakelock':     'Keep screen on',
      'ipad.standalone':  'Home Screen app ✓',
      'ipad.browser':     'Safari tab — open it from the "KPJ Game" Home Screen icon instead (Safari and the Home Screen app keep separate data)',
      'ipad.ready':       'Ready ✓ works offline ({n} files, {mb} MB, version {v})',
      'ipad.partial':     'Downloading {c} / {n}…',
      'ipad.none':        'Not ready: open it once while the PC "iPad install service" is running',
      'ipad.nosw':        'Unavailable: must be opened from an https address (install it with the PC iPad install service)',
      'ipad.swerror':     'Error: {e}',
      'ipad.persisted':   'Persistent — the system will not clear it',
      'ipad.notpersisted':'Normal (not cleared as long as it is opened from the Home Screen regularly)',
      'ipad.wake.on':     'On',
      'ipad.wake.off':    'Not granted — set Settings → Display & Brightness → Auto-Lock to Never',
      'btn.checkupdate':  'Check for update',
      'toast.update.none':  'Already up to date',
      'toast.update.found': 'New version found — downloading, it switches over when back on the home screen',
      'toast.update.fail':  'Cannot reach the install service (normal when offline)',
      'hint.ipad':        'Once on the Home Screen the iPad build runs fully offline; settings and uploaded pictures / music are stored on this iPad. To update: run "iPad安装服务.bat" on the PC again, put the iPad on the same Wi-Fi, open the game, go to Settings and tap "Check for update" — it switches to the new version when back on the home screen.'
    }
  };

  var cur = 'zh';

  function t(key, vars) {
    var table = DICT[cur] || DICT.zh;
    var s = table[key];
    if (s === undefined) s = (DICT.zh[key] !== undefined ? DICT.zh[key] : key);
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      });
    }
    return s;
  }

  /* 把所有 [data-i18n] 元素的文字换成当前语言 */
  function apply(root) {
    var scope = root || document;
    Array.prototype.forEach.call(scope.querySelectorAll('[data-i18n]'), function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.documentElement.setAttribute('lang', cur === 'zh' ? 'zh-CN' : cur);
  }

  /* persist=false 时只切换显示，不写 localStorage。
     启动时套用「随包配置 / 出厂默认」的语言要用这个模式，
     否则会把默认值固化成本机改动，之后更新配置包就不再生效。 */
  function setLang(code, persist) {
    if (!DICT[code]) code = 'zh';
    cur = code;
    if (persist !== false) Settings.set('lang', code);
    apply();
  }

  global.I18N = {
    langs: LANGS,
    t: t,
    apply: apply,
    setLang: setLang,
    get current() { return cur; }
  };
})(window);
