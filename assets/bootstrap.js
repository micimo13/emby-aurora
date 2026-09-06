/*!
 * EmbyAurora — bootstrap.js
 * =============================================================================
 *  核心加载器（零依赖，单一注入点）
 *
 *  职责：Emby 检测 → 挂载预热加载页 → 等待 ApiClient 就绪 → 应用主题/Logo/加载功能模块
 *
 *  设计原则（基于对 Nolovenodie/emby-crx、bpking1/embyExternalUrl 等成熟项目的源码调研）：
 *   1. 零依赖：静态注入 index.html，脚本直接运行在页面上下文，可直接访问
 *      window.ApiClient / window.require / window.appRouter，无需 jQuery/md5/BroadcastChannel。
 *   2. 就绪信号 = window.ApiClient（轮播/外部播放器等都依赖它，比猜 DOM 更可靠）。
 *   3. 首帧无闪烁：加载页 HTML/CSS 全内嵌，同步挂载，无额外网络请求。
 *   4. 配置驱动：一切个性化由 window.AURORA_CONFIG 控制（install.sh 生成 config.js）。
 * =============================================================================
 */
(function (global) {
  'use strict';

  /* =========================================================================
   * 0. 配置
   * ======================================================================= */
  var CONFIG = global.AURORA_CONFIG || {};
  var LOADING = CONFIG.loading || {};
  var THEME = CONFIG.theme || {};
  var LOGO = CONFIG.logo || {};
  var FEATURES = CONFIG.features || {};
  var CAROUSEL = CONFIG.carousel || {};

  var basePath = CONFIG.basePath || 'aurora'; // 资源目录（相对 dashboard-ui）
  var doc = global.document;
  var onReady = []; // Emby 就绪后的回调队列

  /* =========================================================================
   * 1. 工具函数
   * ======================================================================= */
  function each(list, fn) {
    for (var i = 0; i < list.length; i++) fn(list[i], i);
  }
  function $(sel, root) {
    return (root || doc).querySelector(sel);
  }
  function $all(sel, root) {
    return Array.prototype.slice.call((root || doc).querySelectorAll(sel));
  }
  function injectCSS(id, css) {
    if (doc.getElementById(id)) return;
    var s = doc.createElement('style');
    s.id = id;
    s.type = 'text/css';
    s.appendChild(doc.createTextNode(css));
    (doc.head || doc.documentElement).appendChild(s);
  }
  function loadCSS(id, href) {
    if (doc.getElementById(id)) return;
    var l = doc.createElement('link');
    l.id = id;
    l.rel = 'stylesheet';
    l.href = href;
    (doc.head || doc.documentElement).appendChild(l);
  }
  function loadJS(src, cb) {
    var s = doc.createElement('script');
    s.src = src;
    s.async = false;
    if (cb) s.onload = cb;
    (doc.head || doc.documentElement).appendChild(s);
  }

  /* =========================================================================
   * 2. Emby 环境检测（非 Emby 页面不运行任何注入）
   * ======================================================================= */
  function isEmby() {
    // 宽松检测，多路兜底。关键：Emby Web 入口 URL 必含 /web/（最可靠的信号，
    // 因为本脚本只会被注入到 Emby 的 index.html，且 </head> 前 body/ApiClient 尚未就绪）。
    if (location.pathname.indexOf('/web/') !== -1) return true;
    var meta = doc.querySelector('meta[name="application-name"]');
    var m = meta ? (meta.getAttribute('content') || '') : '';
    if (/emby/i.test(m)) return true;
    if (doc.querySelector('.accent-emby, .skinHeader, .emby-scroller, #loginPage')) return true;
    return !!(global.ApiClient || global.Emby);
  }

  /* =========================================================================
   * 3. 预热加载页（三种风格，全内嵌，零闪烁）
   * ======================================================================= */
  var auroraPalette = LOADING.aurora || {
    bg: 'radial-gradient(120% 120% at 50% 0%, #10102a 0%, #0a0a18 55%, #050510 100%)',
    blob1: '#6d5dfc', blob2: '#22d3ee', blob3: '#f472b6',
    text: '#e8eaf6', accent: '#a5b4fc', bar: 'linear-gradient(90deg,#6d5dfc,#22d3ee,#f472b6)'
  };

  var loadingCSS = [
    '.aurora-loading{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;overflow:hidden;' +
      'opacity:0;transition:opacity .35s ease;pointer-events:all;}',
    '.aurora-loading.is-show{opacity:1;}',
    '.aurora-loading.is-hide{opacity:0;pointer-events:none;}',
    '.aurora-loading__bg{position:absolute;inset:0;background:' + auroraPalette.bg + ';}',
    '.aurora-loading__blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:.55;will-change:transform;}',
    '.aurora-loading__blob--1{width:52vmax;height:52vmax;left:-14vmax;top:-18vmax;' +
      'background:' + auroraPalette.blob1 + ';animation:aurora-drift1 11s ease-in-out infinite;}',
    '.aurora-loading__blob--2{width:44vmax;height:44vmax;right:-12vmax;top:6vmax;' +
      'background:' + auroraPalette.blob2 + ';animation:aurora-drift2 14s ease-in-out infinite;}',
    '.aurora-loading__blob--3{width:40vmax;height:40vmax;left:20%;bottom:-20vmax;' +
      'background:' + auroraPalette.blob3 + ';animation:aurora-drift3 17s ease-in-out infinite;}',
    '.aurora-loading__inner{position:relative;display:flex;flex-direction:column;' +
      'align-items:center;gap:26px;padding:0 24px;}',
    '.aurora-loading__logo{width:120px;height:120px;display:flex;align-items:center;' +
      'justify-content:center;animation:aurora-breathe 2.6s ease-in-out infinite;' +
      'filter:drop-shadow(0 0 26px rgba(139,124,255,.55));}',
    '.aurora-loading__logo img,.aurora-loading__logo svg{width:100%;height:100%;object-fit:contain;}',
    '.aurora-loading__slogan{color:' + auroraPalette.text + ';font-size:15px;' +
      'letter-spacing:.42em;text-indent:.42em;font-family:"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;' +
      'animation:aurora-fadein 1.2s ease .3s both;}',
    '.aurora-loading__bar{width:220px;height:3px;border-radius:99px;overflow:hidden;' +
      'background:rgba(255,255,255,.10);position:relative;}',
    '.aurora-loading__bar i{position:absolute;top:0;bottom:0;width:42%;border-radius:99px;' +
      'background:' + auroraPalette.bar + ';animation:aurora-slide 1.6s ease-in-out infinite;}',
    '@keyframes aurora-drift1{0%,100%{transform:translate(0,0) scale(1) rotate(0)}' +
      '50%{transform:translate(6vmax,4vmax) scale(1.12) rotate(25deg)}}',
    '@keyframes aurora-drift2{0%,100%{transform:translate(0,0) scale(1) rotate(0)}' +
      '50%{transform:translate(-5vmax,-3vmax) scale(1.1) rotate(-20deg)}}',
    '@keyframes aurora-drift3{0%,100%{transform:translate(0,0) scale(1)}' +
      '50%{transform:translate(4vmax,-5vmax) scale(1.15)}}',
    '@keyframes aurora-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}',
    '@keyframes aurora-fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    '@keyframes aurora-slide{0%{left:-45%}100%{left:105%}}'
  ].join('\n');

  var cinemaCSS = [
    '.aurora-loading.is-cinema .aurora-loading__bg{background:radial-gradient(90% 70% at 50% -10%,#1a1408 0%,#000 60%);}',
    '.aurora-loading.is-cinema .aurora-loading__blob{display:none;}',
    '.aurora-loading.is-cinema .aurora-loading__beam{position:absolute;top:-30%;left:50%;width:140%;height:60%;' +
      'transform:translateX(-50%);background:linear-gradient(180deg,rgba(212,175,55,.22),transparent 70%);' +
      'clip-path:polygon(46% 0,54% 0,78% 100%,22% 100%);filter:blur(2px);animation:cinema-sway 5s ease-in-out infinite;}',
    '.aurora-loading.is-cinema .aurora-loading__film{position:absolute;bottom:14%;left:0;right:0;height:8px;' +
      'display:flex;gap:8px;justify-content:center;opacity:.5;}',
    '.aurora-loading.is-cinema .aurora-loading__film i{width:22px;height:8px;border-radius:2px;' +
      'background:#d4af37;animation:cinema-film 1.4s linear infinite;}',
    '.aurora-loading.is-cinema .aurora-loading__logo{filter:drop-shadow(0 0 20px rgba(212,175,55,.5));}',
    '.aurora-loading.is-cinema .aurora-loading__bar i{background:linear-gradient(90deg,#d4af37,#fff7d6,#d4af37);}',
    '@keyframes cinema-sway{0%,100%{transform:translateX(-52%) rotate(0)}50%{transform:translateX(-48%) rotate(1.5deg)}}',
    '@keyframes cinema-film{0%{opacity:.2}50%{opacity:1}100%{opacity:.2}}'
  ].join('\n');

  var minimalCSS = [
    '.aurora-loading.is-minimal .aurora-loading__bg{background:#0b0d12;}',
    '.aurora-loading.is-minimal .aurora-loading__blob{display:none;}',
    '.aurora-loading.is-minimal .aurora-loading__logo{filter:none;animation:none;width:96px;height:96px;}',
    '.aurora-loading.is-minimal .aurora-loading__bar{height:2px;}',
    '.aurora-loading.is-minimal .aurora-loading__bar i{background:#e8eaf6;}'
  ].join('\n');

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function repeat(n, s) { var r = ''; for (var i = 0; i < n; i++) r += s; return r; }

  function renderLogo() {
    if (LOGO.type === 'image') {
      var src = LOGO.imageUrl || (basePath + '/logo/logo.svg');
      return '<img src="' + esc(src) + '" alt="logo">';
    }
    if (LOGO.type === 'text') {
      var t = LOGO.text || 'AURORA';
      var c = LOGO.color || '#ffffff';
      return '<svg viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">' +
        '<text x="100" y="42" text-anchor="middle" font-size="' + (LOGO.fontSize || 34) +
        '" fill="' + esc(c) + '" font-weight="700" font-family="Segoe UI,PingFang SC,Microsoft YaHei,sans-serif" ' +
        'letter-spacing="4">' + esc(t) + '</text></svg>';
    }
    return '<img src="' + basePath + '/logo/logo.svg" alt="logo">';
  }

  function buildLoading() {
    var el = doc.createElement('div');
    el.className = 'aurora-loading';
    var styleClass = '';
    var film = '';
    if (LOADING.style === 'cinema') { styleClass = ' is-cinema'; film = '<div class="aurora-loading__beam"></div><div class="aurora-loading__film">' + repeat(9, '<i></i>') + '</div>'; }
    else if (LOADING.style === 'minimal') { styleClass = ' is-minimal'; }

    var logoHtml = renderLogo();
    el.className = 'aurora-loading' + styleClass;
    el.innerHTML =
      '<div class="aurora-loading__bg"></div>' +
      '<div class="aurora-loading__blob aurora-loading__blob--1"></div>' +
      '<div class="aurora-loading__blob aurora-loading__blob--2"></div>' +
      '<div class="aurora-loading__blob aurora-loading__blob--3"></div>' +
      film +
      '<div class="aurora-loading__inner">' +
        '<div class="aurora-loading__logo">' + logoHtml + '</div>' +
        '<div class="aurora-loading__slogan">' + esc(LOADING.slogan || 'EMBY · AURORA') + '</div>' +
        '<div class="aurora-loading__bar"><i></i></div>' +
      '</div>';
    return el;
  }

  /* =========================================================================
   * 4. 等待 Emby 就绪（以 ApiClient 为信号，轮播/播放器都依赖它）
   * ======================================================================= */
  function embyReady() {
    return !!(global.ApiClient && global.ApiClient.getCurrentUserId);
  }

  function waitForEmby(cb, tries) {
    tries = tries || 0;
    if (embyReady()) { cb(); return; }
    if (tries > 200) { cb(); return; } // 20s 兜底
    setTimeout(function () { waitForEmby(cb, tries + 1); }, 100);
  }

  /* =========================================================================
   * 5. 模块加载器（配置驱动，按需加载）
   * ======================================================================= */
  var modules = {
    carousel:  { js: basePath + '/carousel/carousel.js', css: basePath + '/carousel/carousel.css' },
    danmaku:   { js: basePath + '/features/danmaku.js' },
    douban:    { js: basePath + '/features/douban.js', css: basePath + '/features/douban.css' },
    speed:     { js: basePath + '/features/speed.js' },
    extplayer: { js: basePath + '/features/external-player.js' },
    fluent:    { css: basePath + '/features/fluent.css' }
  };

  function loadEnabledModules() {
    each(Object.keys(modules), function (name) {
      if (FEATURES[name] === true || FEATURES[name] === 'true' || FEATURES[name] === 1) {
        var m = modules[name];
        if (m.css) loadCSS('aurora-mod-' + name, m.css);
        if (m.js) loadJS(m.js);
      }
    });
    // 轮播单独开关
    if ((CAROUSEL.enabled === true || CAROUSEL.enabled === 'true') && !FEATURES.carousel) {
      loadCSS('aurora-mod-carousel', modules.carousel.css);
      loadJS(modules.carousel.js);
    }
  }

  /* =========================================================================
   * 6. 主题应用
   * ======================================================================= */
  function applyTheme() {
    loadCSS('aurora-base', basePath + '/aurora.css');
    if (THEME.name && THEME.name !== 'default') {
      loadCSS('aurora-theme', basePath + '/themes/' + THEME.name + '.css');
    }
    if (THEME.accent) {
      injectCSS('aurora-accent', ':root{--aurora-accent:' + THEME.accent + ';}');
    }
  }

  /* =========================================================================
   * 7. Logo 替换（顶栏，多版本兜底）
   * ======================================================================= */
  function applyHeaderLogo() {
    if (LOGO.header === false || LOGO.header === 'false') return;
    var logoHtml = renderLogo();
    var slots = $all('.skinHeader .pageTitle, .skinHeader a.logo, .headerLogo, ' +
                     '.skinHeader .headerLeft a, a[data-role="logo"]');
    each(slots, function (slot) {
      if (slot.querySelector('.aurora-hlogo')) return;
      var span = doc.createElement('span');
      span.className = 'aurora-hlogo';
      span.style.cssText = 'display:inline-flex;align-items:center;height:100%;';
      span.innerHTML = logoHtml;
      if (!LOGO.keepText) {
        var txt = slot.querySelector('.pageTitle');
        if (txt) txt.style.display = 'none';
      }
      slot.insertBefore(span, slot.firstChild);
    });
    injectCSS('aurora-hlogo-css',
      '.skinHeader .aurora-hlogo{display:inline-flex!important;align-items:center;}' +
      '.skinHeader .aurora-hlogo img,.skinHeader .aurora-hlogo svg{height:32px;width:auto;max-width:160px;}'
    );
  }

  /* =========================================================================
   * 8. 主流程
   * ======================================================================= */
  function main() {
    if (!isEmby()) return;

    injectCSS('aurora-loading-css', loadingCSS + cinemaCSS + minimalCSS);

    // 挂载加载页（同步，保证首帧；</head> 前 body 为 null，回退 documentElement）
    var loadingEl = null;
    if (!(LOADING.enabled === false || LOADING.enabled === 'false')) {
      loadingEl = buildLoading();
      (doc.body || doc.documentElement).appendChild(loadingEl);
      loadingEl.offsetHeight;
      loadingEl.classList.add('is-show');
    }

    applyTheme();
    loadJS(basePath + '/settings.js'); // 设置中心（总是加载，网页内换主题）

    waitForEmby(function () {
      global.AURORA._ready = true;
      applyHeaderLogo();
      loadEnabledModules();
      if (loadingEl) {
        loadingEl.classList.add('is-hide');
        setTimeout(function () {
          if (loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
        }, 420);
      }
      each(onReady, function (fn) { try { fn(); } catch (e) {} });
      onReady.length = 0;
    });
  }

  /* =========================================================================
   * 9. 对外工具（供 carousel / external-player 等模块使用）
   * ======================================================================= */
  global.AURORA = global.AURORA || {};
  global.AURORA.onReady = function (fn) {
    if (global.AURORA._ready) { try { fn(); } catch (e) {} }
    else { onReady.push(fn); }
  };
  // 获取 ApiClient（轮播/播放器/评分的统一入口）
  global.AURORA.api = function () { return global.ApiClient; };
  // 获取 appRouter（跳转详情页用），Emby 通过 require(["appRouter"]) 加载
  global.AURORA.router = function (cb) {
    if (global.appRouter) { cb(global.appRouter); return; }
    if (global.require) {
      try {
        global.require(['appRouter'], function (r) { cb(r && r.default ? r.default : r); });
        return;
      } catch (e) {}
    }
    cb(null);
  };
  // 是否在首页（Emby 首页 URL 含 "!/home"）
  global.AURORA.isHome = function () {
    return location.href.indexOf('!/home') !== -1 || location.hash.indexOf('home') !== -1;
  };

  main();
})(window);
