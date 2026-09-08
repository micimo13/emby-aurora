/*!
 * EmbyAurora — features/external-player.js
 * 外部播放器调用：在详情页按钮组注入「外部播放」按钮，点击弹出多协议菜单。
 * 支持协议：potplayer:// vlc:// iina:// mpv:// 及复制直链。
 *
 * 交互：点击按钮 → 下拉菜单（PotPlayer / VLC / IINA / MPV / 复制直链）→ 选择即播放，
 *       并记住最近选择（localStorage，按浏览器）。默认协议由 config 的 externalScheme 决定。
 * 外观：复用按钮组内原生 button 的 class，去掉自定义渐变，视觉与 Emby 原生按钮一致。
 * 直链需在浏览器已登录（携带 api_key），否则外部播放器可能无法鉴权。
 */
(function (global) {
  'use strict';

  var CONFIG = (global.AURORA_CONFIG && global.AURORA_CONFIG.features) || {};
  var DEFAULT_SCHEME = CONFIG.externalScheme || 'potplayer'; // potplayer | vlc | iina | mpv | copy

  var SCHEMES = [
    { key: 'potplayer', label: 'PotPlayer' },
    { key: 'vlc', label: 'VLC' },
    { key: 'iina', label: 'IINA' },
    { key: 'mpv', label: 'MPV' },
    { key: 'copy', label: '复制直链' }
  ];
  var PROTOCOLS = {
    potplayer: 'potplayer://',
    vlc: 'vlc://',
    iina: 'iina://weblink?url=',
    mpv: 'mpv://'
  };

  function storedScheme() {
    try { return localStorage.getItem('aurora.extScheme') || DEFAULT_SCHEME; }
    catch (e) { return DEFAULT_SCHEME; }
  }
  function saveScheme(k) { try { localStorage.setItem('aurora.extScheme', k); } catch (e) {} }

  function getItemId() {
    var m = location.hash.match(/[?&]id=([^&#]+)/i) || location.href.match(/[?&]id=([^&#]+)/i);
    if (m) return decodeURIComponent(m[1]);
    var page = document.querySelector('.itemDetailPage, .detailPageWrapperContainer, .detailPagePrimaryContainer');
    var el = page ? page.querySelector('[data-id]') : null;
    return el ? el.getAttribute('data-id') : null;
  }

  function getApiKey() {
    var api = global.ApiClient;
    if (api && api.getAccessToken) { try { return api.getAccessToken() || ''; } catch (e) {} }
    return '';
  }

  function getServerAddress() {
    var api = global.ApiClient;
    if (api && api._serverAddress) return String(api._serverAddress);
    if (api && api.getUrl) { try { return api.getUrl('') || ''; } catch (e) {} }
    var m = location.href.match(/^https?:\/\/[^/]+/);
    return m ? m[0] : '';
  }

  function buildStreamUrl(itemId) {
    var base = getServerAddress().replace(/\/+$/, '');
    var key = getApiKey();
    var api = global.ApiClient;
    var deviceId = (api && api._deviceId) ? api._deviceId : '';
    var url = base + '/emby/Videos/' + encodeURIComponent(itemId) + '/stream?Static=true';
    if (key) url += '&api_key=' + encodeURIComponent(key);
    if (deviceId) url += '&DeviceId=' + encodeURIComponent(deviceId);
    return url;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      (document.body || document.documentElement).appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
    }
    toast('直链已复制');
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:12%;transform:translateX(-50%);' +
      'background:rgba(0,0,0,.75);color:#fff;padding:8px 18px;border-radius:999px;' +
      'font-size:14px;z-index:2147483000;transition:opacity .4s;';
    (document.body || document.documentElement).appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 450); }, 1200);
  }

  function runScheme(scheme, url) {
    if (scheme === 'copy') { copyText(url); return; }
    var prefix = PROTOCOLS[scheme];
    if (!prefix) return;
    var href = prefix + (scheme === 'iina' ? encodeURIComponent(url) : url);
    var link = document.createElement('a');
    link.href = href;
    link.style.display = 'none';
    (document.body || document.documentElement).appendChild(link);
    link.click();
    link.remove();
  }

  function injectButton(itemId) {
    if (document.getElementById('aurora-ext-btn')) return;
    var host = document.querySelector('.mainDetailButtons, .detailButtons, .detailButtonContainer');
    if (!host) return;

    // 外观对齐 Emby 原生按钮：复用按钮组内兄弟 button 的 class（去掉状态/主色类）
    var native = host.querySelector('button');
    var baseClass = native ? String(native.className) : 'button-flat';
    baseClass = baseClass.replace(/\b(raised|is-active|active)\b/g, '').trim();

    var btn = document.createElement('button');
    btn.id = 'aurora-ext-btn';
    btn.type = 'button';
    btn.className = (baseClass + ' aurora-ext-btn').trim();
    btn.style.cssText = 'margin-left:8px;';

    var cur = storedScheme();
    btn.innerHTML =
      '<span class="aurora-ext-label">外部播放</span>' +
      '<span class="aurora-ext-caret">▾</span>';

    var menu = document.createElement('div');
    menu.className = 'aurora-ext-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = SCHEMES.map(function (s) {
      return '<button class="aurora-ext-item' + (s.key === cur ? ' is-on' : '') +
        '" data-scheme="' + s.key + '" type="button" role="menuitem">' + s.label + '</button>';
    }).join('');
    (document.body || document.documentElement).appendChild(menu);

    function openMenu() {
      var r = btn.getBoundingClientRect();
      menu.style.display = 'block';
      // 先显示再测量，避免菜单在视口右侧溢出
      var mw = menu.offsetWidth || 160;
      var left = Math.min(r.left, window.innerWidth - mw - 12);
      menu.style.left = Math.max(12, left) + 'px';
      menu.style.top = (r.bottom + 6) + 'px';
    }
    function closeMenu() { menu.style.display = 'none'; }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (menu.style.display === 'block') closeMenu();
      else openMenu();
    });

    menu.addEventListener('click', function (e) {
      var it = e.target && e.target.closest ? e.target.closest('.aurora-ext-item') : null;
      if (!it) return;
      var k = it.getAttribute('data-scheme');
      saveScheme(k);
      runScheme(k, buildStreamUrl(itemId));
      closeMenu();
      Array.prototype.forEach.call(menu.querySelectorAll('.aurora-ext-item'), function (x) {
        x.classList.toggle('is-on', x.getAttribute('data-scheme') === k);
      });
    });

    // 点击页面其它地方关闭
    document.addEventListener('click', closeMenu);

    host.appendChild(btn);
  }

  function tryInject() {
    if (document.getElementById('aurora-ext-btn')) return;
    var id = getItemId();
    if (!id) return;
    injectButton(id);
  }

  function start() {
    tryInject();
    // 详情页是 SPA 路由异步渲染，持续监听注入点出现
    setInterval(function () {
      if (!document.getElementById('aurora-ext-btn')) tryInject();
    }, 1000);
  }

  if (global.AURORA && global.AURORA.onReady) {
    global.AURORA.onReady(start);
  } else {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 1500); });
  }
})(window);
