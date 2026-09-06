/*!
 * EmbyAurora — features/external-player.js
 * 外部播放器调用：在详情页注入「外部播放」按钮，复制直链 / 调起本地播放器。
 * 支持协议：potplayer:// vlc:// iina:// mpv:// 及复制直链。
 * 直链需在浏览器已登录（携带 api_key），否则外部播放器可能无法鉴权。
 */
(function (global) {
  'use strict';

  var CONFIG = (global.AURORA_CONFIG && global.AURORA_CONFIG.features) || {};
  var scheme = CONFIG.externalScheme || 'potplayer'; // potplayer | vlc | iina | mpv | copy

  function getItemId() {
    var m = location.hash.match(/[?&]id=([^&#]+)/i) || location.href.match(/[?&]id=([^&#]+)/i);
    if (m) return decodeURIComponent(m[1]);
    var el = document.querySelector('[data-id][data-type], .itemDetailPage [data-id], [data-id]');
    return el ? el.getAttribute('data-id') : null;
  }

  function getApiKey() {
    var api = global.ApiClient;
    if (api && api.getAccessToken) { try { return api.getAccessToken() || ''; } catch (e) {} }
    return '';
  }

  function getBaseUrl() {
    var api = global.ApiClient;
    if (api && api.getUrl) { try { return api.getUrl('') || ''; } catch (e) {} }
    var m = location.href.match(/^https?:\/\/[^/]+/);
    return m ? m[0] : '';
  }

  function buildStreamUrl(itemId) {
    var base = getBaseUrl();
    var key = getApiKey();
    var url = base + '/emby/Videos/' + encodeURIComponent(itemId) + '/stream?static=true';
    if (key) url += '&api_key=' + encodeURIComponent(key);
    return url;
  }

  function openExternal(url) {
    if (scheme === 'copy') { copyText(url); return; }
    var protocols = {
      potplayer: 'potplayer://' + url,
      vlc: 'vlc://' + url,
      iina: 'iina://weblink?url=' + encodeURIComponent(url),
      mpv: 'mpv://' + url
    };
    var link = document.createElement('a');
    link.href = protocols[scheme] || url;
    link.style.display = 'none';
    (document.body || document.documentElement).appendChild(link);
    link.click();
    link.remove();
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

  function injectButton(itemId) {
    if (document.getElementById('aurora-ext-btn')) return;
    // .mainDetailButtons 是 Emby 详情页按钮组（跨 4.8/4.9 稳定，参考社区 embyExternalUrl）
    var host = document.querySelector('.mainDetailButtons, .detailButtons, .detailButtonContainer, .itemDetailPage .mainDetailButtons');
    if (!host) return;
    var btn = document.createElement('button');
    btn.id = 'aurora-ext-btn';
    btn.type = 'button';
    btn.className = 'button-flat aurora-ext-btn';
    btn.textContent = scheme === 'copy' ? '复制直链' : '外部播放';
    btn.style.cssText = 'margin-left:8px;';
    btn.addEventListener('click', function () {
      openExternal(buildStreamUrl(itemId));
    });
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
