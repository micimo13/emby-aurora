/*!
 * EmbyAurora — carousel.js
 * =============================================================================
 *  沉浸式首页轮播：复用首页 section 已有卡片数据（零 token 处理），
 *  跨 Emby 4.8/4.9 稳定运行。
 *
 *  关键点：
 *   - Emby 卡片海报是 .cardImage div 的「背景图 + data-src 懒加载」，不是 <img>，
 *     因此同时支持 <img> 与背景图两种提取方式。
 *   - 背景优先用横版 Backdrop（由海报 URL 推导），加载失败自动回退竖版海报。
 *   - Emby 是 SPA，首页 section 异步渲染，用 MutationObserver 持续监听，导航回来也能挂载。
 * =============================================================================
 */
(function (global) {
  'use strict';

  var CONFIG = (global.AURORA_CONFIG && global.AURORA_CONFIG.carousel) || {};
  var INTERVAL = Number(CONFIG.interval) || 8000;
  var MAX = Number(CONFIG.maxCount) || 8;

  function getServerId() {
    var m = location.href.match(/[?&]serverId=([^&]+)/);
    if (m) return m[1];
    var api = global.ApiClient;
    if (api && api.serverId) { try { return api.serverId(); } catch (e) {} }
    return '';
  }

  // 从卡片元素提取海报 URL（兼容 <img> 与 .cardImage 背景图两种渲染）
  function extractPoster(card) {
    // 1) <img> 标签
    var img = card.querySelector('img.cardImage, .cardImageContainer img, img');
    if (img) {
      var s = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original') || '';
      if (s && s.indexOf('data:') !== 0) return s;
    }
    // 2) .cardImage div 的 data-src（懒加载海报）
    var ci = card.querySelector('.cardImage, .cardImageContainer .cardImage, [data-src]');
    if (ci) {
      var ds = ci.getAttribute('data-src');
      if (ds && ds.indexOf('data:') !== 0) return ds;
    }
    // 3) .cardImage 内联背景图 background-image:url(...)
    if (ci) {
      var m = (ci.getAttribute('style') || '').match(/background-image:\s*url\(["']?([^"')]+)["']?\)/i);
      if (m && m[1]) return m[1];
    }
    return '';
  }

  // 由海报 URL 推导横版 Backdrop（背景图用），失败回退用海报本身
  function toBackdrop(poster) {
    if (!poster) return '';
    var b = poster.replace(/\/Images\/Primary(?=[?/]|$)/, '/Images/Backdrop');
    b = b.replace(/maxWidth=\d+/g, 'maxWidth=1920');
    b = b.replace(/maxHeight=\d+/g, 'maxHeight=1080');
    return b;
  }

  function isHome() {
    // 仅在首页收集：首页有媒体库 section 容器
    return !!document.querySelector('.homeLibraryContainer, .verticalSection, [class*="view-home"]');
  }

  function collectCards() {
    var cards = [];
    var seen = {};
    if (!isHome()) return cards;

    // 卡片选择器：覆盖 Emby 4.8/4.9 的 .card / .backdropCard
    var cardEls = document.querySelectorAll('.card, .backdropCard');
    for (var i = 0; i < cardEls.length; i++) {
      var card = cardEls[i];
      var id = card.getAttribute('data-id') || card.getAttribute('data-itemid');
      if (!id || seen[id]) continue;

      var titleEl = card.querySelector('.cardText, .cardTitle, .itemName');
      var title = titleEl ? titleEl.textContent.replace(/\s+/g, ' ').trim() : '';
      if (!title) continue;

      var poster = extractPoster(card);
      if (!poster) continue;

      seen[id] = 1;
      cards.push({
        id: id,
        title: title,
        poster: poster,
        backdrop: toBackdrop(poster),
        serverId: card.getAttribute('data-serverid') || card.getAttribute('data-serverId') || getServerId(),
        type: card.getAttribute('data-type') || ''
      });
      if (cards.length >= MAX) break;
    }
    return cards;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function escUrl(s) {
    return String(s).replace(/'/g, '\\\'').replace(/"/g, '&quot;');
  }

  function build(cards) {
    var container = document.createElement('div');
    container.className = 'aurora-carousel';

    var track = '<div class="aurora-carousel__track">' + cards.map(function (c, i) {
      return '<div class="aurora-carousel__slide' + (i === 0 ? ' is-active' : '') + '" data-id="' + esc(c.id) + '" data-serverid="' + esc(c.serverId) + '">' +
        '<img class="aurora-carousel__bg" alt="" data-fallback="' + escUrl(c.poster) + '" src="' + escUrl(c.backdrop) + '" onerror="if(this.src!==this.dataset.fallback){this.src=this.dataset.fallback}">' +
        '<div class="aurora-carousel__shade"></div>' +
        '<div class="aurora-carousel__content">' +
          '<img class="aurora-carousel__poster" src="' + escUrl(c.poster) + '" alt="">' +
          '<div class="aurora-carousel__info">' +
            '<h2 class="aurora-carousel__title">' + esc(c.title) + '</h2>' +
            '<div class="aurora-carousel__meta">' + esc(c.type || 'Emby') + '</div>' +
            '<div class="aurora-carousel__actions">' +
              '<button class="aurora-carousel__btn aurora-carousel__btn--play" data-action="play">▶ 播放</button>' +
              '<button class="aurora-carousel__btn aurora-carousel__btn--detail" data-action="detail">详情</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';

    track += '<button class="aurora-carousel__arrow aurora-carousel__arrow--prev">‹</button>' +
             '<button class="aurora-carousel__arrow aurora-carousel__arrow--next">›</button>' +
             '<div class="aurora-carousel__dots">' + cards.map(function (c, i) {
               return '<button class="aurora-carousel__dot' + (i === 0 ? ' is-active' : '') + '" data-index="' + i + '"></button>';
             }).join('') + '</div>';

    container.innerHTML = track;
    return container;
  }

  function openItem(id, serverId, play) {
    var hash = '#/item?id=' + encodeURIComponent(id);
    if (serverId) hash += '&serverId=' + encodeURIComponent(serverId);
    if (play) hash += '&autoplay=true';
    location.hash = hash;
  }

  function mount(cards) {
    // 优先插到首页第一个媒体库 section 之前；多个选择器兜底
    var anchor = document.querySelector('.homeLibraryContainer .verticalSection, .verticalSection, .homeSection, .pageTabContent');
    if (!anchor) return;

    var el = build(cards);
    anchor.parentNode.insertBefore(el, anchor);

    var slides = Array.prototype.slice.call(el.querySelectorAll('.aurora-carousel__slide'));
    var dots = Array.prototype.slice.call(el.querySelectorAll('.aurora-carousel__dot'));
    var idx = 0;
    var timer = null;

    function go(n) {
      if (!slides.length) return;
      if (n < 0) n = slides.length - 1;
      if (n >= slides.length) n = 0;
      slides[idx].classList.remove('is-active');
      dots[idx].classList.remove('is-active');
      idx = n;
      slides[idx].classList.add('is-active');
      dots[idx].classList.add('is-active');
    }
    function play() {
      stop();
      timer = setInterval(function () { go(idx + 1); }, INTERVAL);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    var next = el.querySelector('.aurora-carousel__arrow--next');
    var prev = el.querySelector('.aurora-carousel__arrow--prev');
    if (next) next.addEventListener('click', function () { go(idx + 1); play(); });
    if (prev) prev.addEventListener('click', function () { go(idx - 1); play(); });
    dots.forEach(function (d) {
      d.addEventListener('click', function () { go(Number(d.getAttribute('data-index'))); play(); });
    });
    el.addEventListener('mouseenter', stop);
    el.addEventListener('mouseleave', play);

    el.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
      if (!btn) return;
      var slide = slides[idx];
      var id = slide.getAttribute('data-id');
      var sid = slide.getAttribute('data-serverid');
      var action = btn.getAttribute('data-action');
      if (action === 'detail') openItem(id, sid);
      else if (action === 'play') openItem(id, sid, true);
    });

    play();
  }

  function tryInit() {
    if (document.querySelector('.aurora-carousel')) return; // 已挂载
    var cards = collectCards();
    if (cards.length >= 2) {
      mount(cards);
      document.body.classList.add('aurora-carousel-active');
    }
  }

  function start() {
    tryInit();
    // Emby SPA：首页 section 异步渲染、导航切换会重建 DOM，用 MutationObserver 持续监听
    if (global.MutationObserver) {
      var mo = new MutationObserver(function () {
        if (!document.querySelector('.aurora-carousel')) tryInit();
      });
      mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
    }
    // 兜底：前 30 秒每 1s 补扫一次（应对 MutationObserver 遗漏或首页极慢）
    var guard = 0;
    var t = setInterval(function () {
      if (document.querySelector('.aurora-carousel')) { clearInterval(t); return; }
      if (++guard > 30) { clearInterval(t); return; }
      tryInit();
    }, 1000);
  }

  if (global.AURORA && global.AURORA.onReady) {
    global.AURORA.onReady(start);
  } else {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 1500); });
  }
})(window);
