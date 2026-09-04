/*!
 * EmbyAurora — features/external-player.js
 * 外部播放器调用：在详情页注入「外部播放」按钮，复制直链 / 调起本地播放器
 * 支持协议：potplayer:// vlc:// iina:// 及复制直链
 * 直链需在浏览器已登录（携带 api_key），否则外部播放器可能无法鉴权。
 */
(function (global) {
  'use strict';

  var CONFIG = (global.AURORA_CONFIG && global.AURORA_CONFIG.features) || {};
  var scheme = CONFIG.externalScheme || 'potplayer'; // potplayer | vlc | iina | copy

  function getItemId() {
    // 从 URL hash 或详情页 DOM 提取 item id
    var m = location.hash.match(/[?&]id=([^&#]+)/i) || location.href.match(/[?&]id=([^&#]+)/i);
    if (m) return decodeURIComponent(m[1]);
    var el = document.querySelector('[data-id][data-type], .itemDetailPage [data-id]');
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
    var url = base + '/emby/Videos/' + itemId + '/stream?static=true';
    if (key) url += '&api_key=' + encodeURIComponent(key);
    return url;
  }

  function openExternal(url) {
    if (scheme === 'copy') {
      copyText(url);
      return;
    }
    var protocols = {
      potplayer: 'potplayer://' + url,
      vlc: 'vlc://' + url,
      iina: 'iina://weblink?url=' + encodeURIComponent(url)
    };
    var link = document.createElement('a');
    link.href = protocols[scheme] || url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    toast('直链已复制');
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:12%;transform:translateX(-50%);' +
      'background:rgba(0,0,0,.75);color:#fff;padding:8px 18px;border-radius:999px;' +
      'font-size:14px;z-index:2147483000;transition:opacity .4s;';
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 450); }, 1200);
  }

  function injectButton(itemId) {
    if (document.getElementById('aurora-ext-btn')) return;
    var host = document.querySelector('.detailButtons, .detailButtonContainer, .itemDetailPage .mainDetailButtons');
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

  function init() {
    var id = getItemId();
    if (!id) return;
    injectButton(id);
  }

  if (global.AURORA && global.AURORA.onReady) {
    global.AURORA.onReady(function () { setTimeout(init, 1200); });
  } else {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 2000); });
  }
})(window);
