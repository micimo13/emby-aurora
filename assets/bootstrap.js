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
   * 3. 预热加载页（6 套风格，全内嵌，零闪烁，接管 Emby 默认启动画面）
   * =======================================================================
   * 结构骨架统一（bg / 装饰层 / logo / 标语 / 进度条），配色与装饰由
   * `.aurora-loading.is-{style}` 控制。样式键：aurora(默认)/cinema/minimal/
   * snow/space/poster。额外注入 CSS 隐藏 Emby 自带启动 logo，保证加载全程
   * 只看到极光页（真正「替换」Emby 的黑屏 logo 页，而非叠加）。
   * ======================================================================= */
  var loadingBaseCSS = [
    // 骨架：全屏不透明覆盖层，接管 Emby 默认加载画面
    '.aurora-loading{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;overflow:hidden;' +
      'opacity:0;transition:opacity .35s ease;pointer-events:all;}',
    '.aurora-loading.is-show{opacity:1;}',
    '.aurora-loading.is-hide{opacity:0;pointer-events:none;}',
    '.aurora-loading__bg{position:absolute;inset:0;}',
    '.aurora-loading__inner{position:relative;display:flex;flex-direction:column;' +
      'align-items:center;gap:28px;padding:0 24px;z-index:3;}',
    '.aurora-loading__logo{width:120px;height:120px;display:flex;align-items:center;justify-content:center;}',
    '.aurora-loading__logo img,.aurora-loading__logo svg{width:100%;height:100%;object-fit:contain;}',
    '.aurora-loading__slogan{font-size:15px;letter-spacing:.42em;text-indent:.42em;' +
      'font-family:"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:#e8eaf6;}',
    '.aurora-loading__bar{width:220px;height:3px;border-radius:99px;overflow:hidden;position:relative;background:rgba(255,255,255,.12);}',
    '.aurora-loading__bar i{position:absolute;top:0;bottom:0;width:42%;border-radius:99px;' +
      'animation:aurora-slide 1.6s ease-in-out infinite;}',
    '@keyframes aurora-slide{0%{left:-45%}100%{left:105%}}',
    '@keyframes aurora-fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    '@keyframes aurora-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}',
    '@keyframes aurora-spin{to{transform:rotate(360deg)}}',
    // 装饰层默认隐藏，由各套样式按需开启
    '.aurora-loading__aurora,.aurora-loading__aurora-band,.aurora-loading__countdown,' +
      '.aurora-loading__grain,.aurora-loading__filmstrip,.aurora-loading__scanline,' +
      '.aurora-loading__spot,.aurora-loading__dust,.aurora-loading__warp,' +
      '.aurora-loading__stars,.aurora-loading__ink{display:none;}'
  ].join('\n');

  // 隐藏 Emby 自带启动画面（多版本选择器兜底），真正「替换」黑屏 logo 页
  var hideEmbySplashCSS = [
    '.splashLogo,.splashScreen,#splashScreen,#appLoading,#loadingScreen,#loading-page,' +
      '.appLoadingIndicator,.docTitle-splash,body>.loading-spinner{display:none!important;}'
  ].join('\n');

  var loadingThemeCSS = {
    // 极光（默认）：夜空 + 流动极光光幕（真正的极光带，非气泡）
    aurora: [
      '.aurora-loading.is-aurora .aurora-loading__bg{background:linear-gradient(180deg,#0b0d1f 0%,#070814 45%,#04050c 100%);}',
      '.aurora-loading.is-aurora .aurora-loading__aurora{position:absolute;inset:0;display:block;overflow:hidden;}',
      '.aurora-loading.is-aurora .aurora-loading__aurora-band{position:absolute;left:-20%;right:-20%;height:52%;' +
        'border-radius:50%;filter:blur(46px);opacity:.62;mix-blend-mode:screen;}',
      '.aurora-loading.is-aurora .aurora-loading__aurora-band--1{top:-8%;background:linear-gradient(90deg,transparent,#22d3ee,transparent);animation:aurora-sway1 9s ease-in-out infinite;}',
      '.aurora-loading.is-aurora .aurora-loading__aurora-band--2{top:16%;background:linear-gradient(90deg,transparent,#6d5dfc,transparent);animation:aurora-sway2 11s ease-in-out infinite;}',
      '.aurora-loading.is-aurora .aurora-loading__aurora-band--3{top:40%;background:linear-gradient(90deg,transparent,#f472b6,transparent);animation:aurora-sway3 13s ease-in-out infinite;}',
      '.aurora-loading.is-aurora .aurora-loading__logo{animation:aurora-breathe 2.6s ease-in-out infinite;filter:drop-shadow(0 0 28px rgba(139,124,255,.6));}',
      '.aurora-loading.is-aurora .aurora-loading__slogan{color:#d7d6f5;animation:aurora-fadein 1.2s ease .3s both;}',
      '.aurora-loading.is-aurora .aurora-loading__bar i{background:linear-gradient(90deg,#22d3ee,#6d5dfc,#f472b6);}',
      '@keyframes aurora-sway1{0%,100%{transform:translateX(-4%) rotate(-3deg) skewX(8deg)}50%{transform:translateX(4%) rotate(3deg) skewX(-8deg)}}',
      '@keyframes aurora-sway2{0%,100%{transform:translateX(5%) rotate(3deg) skewX(-6deg)}50%{transform:translateX(-5%) rotate(-3deg) skewX(6deg)}}',
      '@keyframes aurora-sway3{0%,100%{transform:translateX(-3%) rotate(-2deg)}50%{transform:translateX(3%) rotate(2deg)}}'
    ].join('\n'),
    // 影院倒计时：环形进度 + 暗角颗粒 + 底部胶片齿孔滚动
    cinema: [
      '.aurora-loading.is-cinema .aurora-loading__bg{background:radial-gradient(80% 60% at 50% 45%,#181204 0%,#000 65%);}',
      '.aurora-loading.is-cinema .aurora-loading__countdown{position:absolute;display:block;width:230px;height:230px;animation:aurora-spin 2.4s linear infinite;}',
      '.aurora-loading.is-cinema .aurora-loading__countdown .track{fill:none;stroke:rgba(212,175,55,.18);stroke-width:3;}',
      '.aurora-loading.is-cinema .aurora-loading__countdown .ring{fill:none;stroke:#d4af37;stroke-width:3;stroke-linecap:round;stroke-dasharray:283;animation:aurora-countdown 2.4s ease-in-out infinite;}',
      '.aurora-loading.is-cinema .aurora-loading__grain{position:absolute;inset:0;display:block;opacity:.5;pointer-events:none;' +
        'background:radial-gradient(120% 120% at 50% 50%,transparent 55%,rgba(0,0,0,.75) 100%);animation:cinema-flicker 2.2s steps(2) infinite;}',
      '.aurora-loading.is-cinema .aurora-loading__filmstrip{position:absolute;bottom:12%;left:0;right:0;height:14px;display:flex;gap:10px;justify-content:center;overflow:hidden;opacity:.6;}',
      '.aurora-loading.is-cinema .aurora-loading__filmstrip i{flex:none;width:24px;height:14px;border-radius:3px;background:#d4af37;animation:cinema-film 1.2s linear infinite;}',
      '.aurora-loading.is-cinema .aurora-loading__logo{filter:drop-shadow(0 0 22px rgba(212,175,55,.5));animation:aurora-breathe 2.6s ease-in-out infinite;}',
      '.aurora-loading.is-cinema .aurora-loading__slogan{color:#f0e3b6;}',
      '.aurora-loading.is-cinema .aurora-loading__bar i{background:linear-gradient(90deg,#d4af37,#fff7d6,#d4af37);}',
      '@keyframes aurora-countdown{0%{stroke-dashoffset:283}100%{stroke-dashoffset:0}}',
      '@keyframes cinema-film{0%{opacity:.2;transform:translateX(0)}50%{opacity:1}100%{opacity:.2;transform:translateX(-22px)}}',
      '@keyframes cinema-flicker{0%,100%{opacity:.42}50%{opacity:.58}}'
    ].join('\n'),
    // 霓虹：灯管发光 + 通电闪烁 + 扫描线（赛博感）
    neon: [
      '.aurora-loading.is-neon .aurora-loading__bg{background:radial-gradient(100% 100% at 50% 0%,#1a0a24 0%,#0a0512 60%,#050208 100%);}',
      '.aurora-loading.is-neon .aurora-loading__scanline{position:absolute;left:0;right:0;height:130px;display:block;' +
        'background:linear-gradient(180deg,transparent,rgba(255,0,200,.08),transparent);animation:neon-scan 3s linear infinite;}',
      '.aurora-loading.is-neon .aurora-loading__logo{animation:neon-flicker 3.2s linear infinite;' +
        'filter:drop-shadow(0 0 12px #ff00c8) drop-shadow(0 0 30px #ff00c8) drop-shadow(0 0 58px #a200ff);}',
      '.aurora-loading.is-neon .aurora-loading__slogan{color:#ffb6f0;text-shadow:0 0 12px #ff00c8;}',
      '.aurora-loading.is-neon .aurora-loading__bar{background:rgba(255,0,200,.15);}',
      '.aurora-loading.is-neon .aurora-loading__bar i{background:linear-gradient(90deg,#ff00c8,#a200ff);box-shadow:0 0 16px #ff00c8;}',
      '@keyframes neon-scan{0%{top:-20%}100%{top:120%}}',
      '@keyframes neon-flicker{0%,90%,94%,100%{opacity:1}91%,93%{opacity:.45}92%{opacity:.8}}'
    ].join('\n'),
    // 舞台聚光：锥形光束 + 漂浮光尘 + 暗角
    spotlight: [
      '.aurora-loading.is-spotlight .aurora-loading__bg{background:radial-gradient(60% 50% at 50% 40%,#141210 0%,#000 72%);}',
      '.aurora-loading.is-spotlight .aurora-loading__spot{position:absolute;top:-10%;left:50%;width:62%;height:78%;' +
        'transform:translateX(-50%);display:block;background:linear-gradient(180deg,rgba(255,240,200,.30),transparent 82%);' +
        'clip-path:polygon(42% 0,58% 0,100% 100%,0 100%);filter:blur(2px);animation:spotlight-sway 6s ease-in-out infinite;}',
      '.aurora-loading.is-spotlight .aurora-loading__dust{position:absolute;inset:0;display:block;overflow:hidden;}',
      '.aurora-loading.is-spotlight .aurora-loading__dust i{position:absolute;bottom:-6%;border-radius:50%;background:#fff;opacity:0;animation:dust-rise 5s linear infinite;}',
      '.aurora-loading.is-spotlight .aurora-loading__logo{animation:aurora-breathe 2.8s ease-in-out infinite;filter:drop-shadow(0 8px 22px rgba(255,240,200,.35));}',
      '.aurora-loading.is-spotlight .aurora-loading__slogan{color:#e9e2cf;}',
      '.aurora-loading.is-spotlight .aurora-loading__bar i{background:linear-gradient(90deg,#f5e6c4,#fff7e0);}',
      '@keyframes spotlight-sway{0%,100%{transform:translateX(-50%) rotate(0)}50%{transform:translateX(-48%) rotate(2deg)}}',
      '@keyframes dust-rise{0%{transform:translateY(0);opacity:0}10%{opacity:.8}100%{transform:translateY(-115vh);opacity:0}}'
    ].join('\n'),
    // 深空跃迁：径向光速线 warp + 星点闪烁
    space: [
      '.aurora-loading.is-space .aurora-loading__bg{background:radial-gradient(120% 100% at 50% 40%,#0d1830 0%,#070d1c 55%,#04060e 100%);}',
      '.aurora-loading.is-space .aurora-loading__stars{position:absolute;inset:0;display:block;' +
        'background-image:radial-gradient(1.6px 1.6px at 18% 24%,#fff,transparent),' +
        'radial-gradient(1.2px 1.2px at 42% 14%,#cfe0ff,transparent),' +
        'radial-gradient(1.4px 1.4px at 68% 22%,#fff,transparent),' +
        'radial-gradient(1px 1px at 82% 38%,#9db9ff,transparent),' +
        'radial-gradient(1.5px 1.5px at 30% 52%,#fff,transparent),' +
        'radial-gradient(1.1px 1.1px at 54% 44%,#fff,transparent),' +
        'radial-gradient(1.6px 1.6px at 76% 60%,#b7c9ff,transparent),' +
        'radial-gradient(1px 1px at 14% 70%,#fff,transparent),' +
        'radial-gradient(1.3px 1.3px at 90% 74%,#fff,transparent),' +
        'radial-gradient(1.2px 1.2px at 48% 82%,#8aa4ff,transparent);' +
        'animation:space-twinkle 3.2s ease-in-out infinite;}',
      '.aurora-loading.is-space .aurora-loading__warp{position:absolute;inset:-50%;display:block;' +
        'background:repeating-conic-gradient(from 0deg,rgba(122,162,255,.14) 0deg 2deg,transparent 2deg 12deg);' +
        'animation:aurora-spin 14s linear infinite;' +
        '-webkit-mask-image:radial-gradient(circle,transparent 20%,#000 58%);mask-image:radial-gradient(circle,transparent 20%,#000 58%);}',
      '.aurora-loading.is-space .aurora-loading__logo{animation:aurora-breathe 3s ease-in-out infinite;filter:drop-shadow(0 0 24px rgba(122,162,255,.6));}',
      '.aurora-loading.is-space .aurora-loading__slogan{color:#c6d4ff;}',
      '.aurora-loading.is-space .aurora-loading__bar i{background:linear-gradient(90deg,#7aa2ff,#a78bfa);}',
      '@keyframes space-twinkle{0%,100%{opacity:.55}50%{opacity:1}}'
    ].join('\n'),
    // 水墨：宣纸 + 墨点晕染 + 楷体标语 + 毛笔笔触进度
    ink: [
      '.aurora-loading.is-ink .aurora-loading__bg{background:linear-gradient(180deg,#f5f0e6 0%,#ede6d8 100%);}',
      '.aurora-loading.is-ink .aurora-loading__ink{position:absolute;inset:0;display:block;overflow:hidden;}',
      '.aurora-loading.is-ink .aurora-loading__ink i{position:absolute;border-radius:50%;' +
        'background:radial-gradient(circle,rgba(30,28,24,.20),rgba(30,28,24,0) 70%);filter:blur(5px);animation:ink-spread 7s ease-out infinite;}',
      '.aurora-loading.is-ink .aurora-loading__logo{animation:aurora-breathe 2.4s ease-in-out infinite;filter:drop-shadow(0 4px 10px rgba(30,28,24,.25));}',
      '.aurora-loading.is-ink .aurora-loading__slogan{color:#4a4238;letter-spacing:.6em;font-weight:600;' +
        'font-family:"STKaiti","KaiTi","Songti SC",serif;}',
      '.aurora-loading.is-ink .aurora-loading__bar{height:6px;background:transparent;}',
      '.aurora-loading.is-ink .aurora-loading__bar i{height:6px;border-radius:2px;background:linear-gradient(90deg,#2b2722,#5a534a);animation:ink-brush 2.2s ease-in-out infinite;}',
      '@keyframes ink-spread{0%{transform:scale(.4);opacity:0}30%{opacity:1}100%{transform:scale(2.8);opacity:0}}',
      '@keyframes ink-brush{0%{left:-45%;width:30%}50%{width:48%}100%{left:105%;width:30%}}'
    ].join('\n')
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function repeat(n, s) { var r = ''; for (var i = 0; i < n; i++) r += s; return r; }

  // 扁平 Logo 预设库（参考旧项目的「平拍 Logo」思路，给用户自行挑选的乐趣）
  var LOGO_PRESETS = {
    aurora:  { file: 'logo.svg',       label: '极光',   color: '#8B7CFF' },
    emby:    { file: 'flat-emby.svg',  label: 'Emby',   color: '#52B54B' },
    minimal: { file: 'flat-minimal.svg', label: '极简', color: '#FFFFFF' },
    cinema:  { file: 'flat-cinema.svg', label: '影院',  color: '#C9A227' },
    film:    { file: 'flat-film.svg',  label: '胶片',   color: '#F4F4F5' }
  };

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
    // 预设扁平 Logo
    var preset = LOGO_PRESETS[LOGO.preset];
    if (preset) {
      return '<img src="' + basePath + '/logo/' + preset.file + '" alt="logo">';
    }
    return '<img src="' + basePath + '/logo/logo.svg" alt="logo">';
  }

  // 加载页图标三选：aurora（AI 设计）/ emby（原生）/ image（自定义）/ auto（跟随顶栏 logo）
  function renderLoadingLogo() {
    var t = LOADING.logo || 'auto';
    if (t === 'aurora') return '<img src="' + basePath + '/logo/loader-aurora.svg" alt="logo">';
    if (t === 'emby') return '<img src="' + basePath + '/logo/loader-emby.svg" alt="logo">';
    if (t === 'image') {
      var src = LOADING.logoUrl;
      if (src) return '<img src="' + esc(src) + '" alt="logo">';
    }
    return renderLogo(); // auto / 兜底
  }

  // 生成 N 个带随机位置/时长/延迟的光尘（聚光）或墨点（水墨）
  // vert=true 时同时随机 top（墨点需全屏散落；光尘用 CSS 的 bottom:-6% 自下而上飘）
  function genParticles(n, cls, minSize, maxSize, minDur, maxDur, vert) {
    var s = '';
    for (var i = 0; i < n; i++) {
      var left = (Math.random() * 100).toFixed(1);
      var top = (Math.random() * 100).toFixed(1);
      var size = (minSize + Math.random() * (maxSize - minSize)).toFixed(1);
      var dur = (minDur + Math.random() * (maxDur - minDur)).toFixed(1);
      var delay = (Math.random() * 6).toFixed(1);
      s += '<i style="left:' + left + '%;' + (vert ? 'top:' + top + '%;' : '') +
        'width:' + size + 'px;height:' + size + 'px;' +
        'animation-duration:' + dur + 's;animation-delay:' + delay + 's;"></i>';
    }
    return s;
  }

  function buildLoading() {
    var el = doc.createElement('div');
    var style = loadingThemeCSS[LOADING.style] ? LOADING.style : 'aurora';
    el.className = 'aurora-loading is-' + style;

    // 每套样式的专属装饰层（默认 display:none，由对应 CSS 开启）
    var decor = '';
    if (style === 'aurora') {
      decor = '<div class="aurora-loading__aurora">' +
        '<i class="aurora-loading__aurora-band aurora-loading__aurora-band--1"></i>' +
        '<i class="aurora-loading__aurora-band aurora-loading__aurora-band--2"></i>' +
        '<i class="aurora-loading__aurora-band aurora-loading__aurora-band--3"></i></div>';
    } else if (style === 'cinema') {
      decor = '<svg class="aurora-loading__countdown" viewBox="0 0 100 100">' +
        '<circle class="track" cx="50" cy="50" r="45"/>' +
        '<circle class="ring" cx="50" cy="50" r="45"/></svg>' +
        '<div class="aurora-loading__grain"></div>' +
        '<div class="aurora-loading__filmstrip">' + repeat(10, '<i></i>') + '</div>';
    } else if (style === 'neon') {
      decor = '<div class="aurora-loading__scanline"></div>';
    } else if (style === 'spotlight') {
      decor = '<div class="aurora-loading__spot"></div>' +
        '<div class="aurora-loading__dust">' + genParticles(12, 'dust', 2, 6, 4, 8) + '</div>';
    } else if (style === 'space') {
      decor = '<div class="aurora-loading__warp"></div><div class="aurora-loading__stars"></div>';
    } else if (style === 'ink') {
      decor = '<div class="aurora-loading__ink">' + genParticles(8, 'ink', 40, 110, 5, 8) + '</div>';
    }

    var logoHtml = renderLoadingLogo();
    el.innerHTML =
      '<div class="aurora-loading__bg"></div>' +
      decor +
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
    details:   { js: basePath + '/details/details.js', css: basePath + '/details/details.css' },
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
  var LIGHT_THEMES = { snow: 1, poster: 1 }; // 浅色主题名（需打 aurora-light 标，压深文字）
  function applyTheme() {
    loadCSS('aurora-base', basePath + '/aurora.css');
    if (THEME.name && THEME.name !== 'default') {
      loadCSS('aurora-theme', basePath + '/themes/' + THEME.name + '.css');
    }
    if (THEME.accent) {
      injectCSS('aurora-accent', ':root{--aurora-accent:' + THEME.accent + ';}');
    }
    // 浅色主题打标：让 aurora.css 里 .aurora-light 的深色文字覆盖生效
    doc.documentElement.classList.toggle('aurora-light', !!LIGHT_THEMES[THEME.name]);
  }

  /* =========================================================================
   * 7. Logo 替换（顶栏 + 登录页，多版本兜底，SPA 持续生效）
   * =======================================================================
   * 参考老项目的「替换 Emby 原生 logo」片段：Emby 的 logo 是一个文字标题
   * （.pageTitle，显示服务器名/Emby）或图片（.headerLogo / a.logo）。不同版本、
   * 不同页面 DOM 结构会变，且 SPA 导航会重建 header，所以：
   *   1) 覆盖多套选择器（顶栏 + 登录页 docTitle）；
   *   2) 幂等（已注入的槽位跳过，实时切换 Logo 时先移除旧的）；
   *   3) MutationObserver + 定时兜底持续重扫，导航回来 Logo 不丢。
   * ===================================================================== */
  var LOGO_SLOTS = '.skinHeader .pageTitle, .skinHeader a.logo, .headerLogo, ' +
                   '.skinHeader .headerLogo, a[data-role="logo"], .docTitle';

  function applyHeaderLogo() {
    if (LOGO.header === false || LOGO.header === 'false') return;
    var logoHtml = renderLogo();
    each($all(LOGO_SLOTS), function (slot) {
      // 实时切换：先移除旧的注入
      var old = slot.querySelector('.aurora-hlogo');
      if (old) old.parentNode.removeChild(old);
      var span = doc.createElement('span');
      span.className = 'aurora-hlogo';
      span.style.cssText = 'display:inline-flex;align-items:center;height:100%;';
      span.innerHTML = logoHtml;
      if (!LOGO.keepText) {
        // 隐藏原生文字标题，让品牌 Logo 独占（不误伤返回按钮/图标）
        var txt = slot.querySelector('.pageTitle, .docTitle, .headerTitle');
        if (txt) txt.style.display = 'none';
      }
      slot.insertBefore(span, slot.firstChild);
    });
    injectCSS('aurora-hlogo-css',
      '.aurora-hlogo{display:inline-flex!important;align-items:center;}' +
      '.aurora-hlogo img,.aurora-hlogo svg{height:32px;width:auto;max-width:160px;' +
      'filter:drop-shadow(0 1px 3px rgba(0,0,0,.35));}'
    );
  }

  // 是否存在「尚未注入 logo」的候选槽位（用于幂等重扫）
  function hasUnloggedSlot() {
    var slots = $all(LOGO_SLOTS);
    for (var i = 0; i < slots.length; i++) {
      if (!slots[i].querySelector('.aurora-hlogo')) return true;
    }
    return false;
  }

  var logoWatcherStarted = false;
  function startLogoWatcher() {
    if (logoWatcherStarted) return;
    logoWatcherStarted = true;
    applyHeaderLogo();
    // SPA 导航会重建 header，MutationObserver 在出现「无 logo 的新槽位」时立即补上
    if (global.MutationObserver) {
      var mo = new MutationObserver(function () {
        if (hasUnloggedSlot()) applyHeaderLogo();
      });
      mo.observe(doc.body || doc.documentElement, { childList: true, subtree: true });
    }
    // 兜底：每 2s 轻量重扫一次（querySelectorAll 极廉价）
    setInterval(function () {
      if (hasUnloggedSlot()) applyHeaderLogo();
    }, 2000);
  }

  // 替换浏览器标签页 favicon（Emby 自带 logo → 品牌 logo）
  function injectFavicon() {
    try {
      var icon = basePath + '/logo/favicon.svg';
      // 移除 Emby 自带 favicon，避免浏览器沿用旧图标
      each($all('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'), function (l) {
        if (l.parentNode) l.parentNode.removeChild(l);
      });
      var link = doc.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      link.href = icon;
      (doc.head || doc.documentElement).appendChild(link);
      var apple = doc.createElement('link');
      apple.rel = 'apple-touch-icon';
      apple.href = icon;
      (doc.head || doc.documentElement).appendChild(apple);
    } catch (e) {}
  }

  /* =========================================================================
   * 8. 主流程
   * ======================================================================= */
  // 读取浏览器本地保存的 Logo 预设（设置中心选过的话，加载页/顶栏一致生效）
  function applyStoredLogo() {
    try {
      var raw = localStorage.getItem('aurora.settings');
      if (!raw) return;
      var s = JSON.parse(raw);
      if (s && s.logo && LOGO_PRESETS[s.logo]) {
        LOGO.preset = s.logo;
        LOGO.type = 'preset';
      }
    } catch (e) {}
  }

  function main() {
    if (!isEmby()) return;

    injectFavicon();
    applyStoredLogo();
    injectCSS('aurora-loading-css',
      loadingBaseCSS + hideEmbySplashCSS +
      loadingThemeCSS.aurora + loadingThemeCSS.cinema + loadingThemeCSS.neon +
      loadingThemeCSS.spotlight + loadingThemeCSS.space + loadingThemeCSS.ink);

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
      startLogoWatcher();
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
  // Logo 预设库（供设置中心渲染选择卡片）
  global.AURORA.logoPresets = function () {
    return Object.keys(LOGO_PRESETS).map(function (k) {
      return { key: k, label: LOGO_PRESETS[k].label, color: LOGO_PRESETS[k].color, file: basePath + '/logo/' + LOGO_PRESETS[k].file };
    });
  };
  // 切换 Logo 预设（设置中心实时调用）
  global.AURORA.setLogo = function (preset) {
    if (LOGO_PRESETS[preset]) {
      LOGO.preset = preset;
      LOGO.type = 'preset';
      applyHeaderLogo();
      return true;
    }
    return false;
  };

  main();
})(window);
