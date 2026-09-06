/*!
 * EmbyAurora — carousel.js
 * =============================================================================
 *  沉浸式首页轮播（数据驱动，参考 Nolovenodie/emby-crx 的成熟实现）
 *
 *  数据来源：window.ApiClient（Emby 前端全局 API 客户端）
 *   - ApiClient.getItems(userId, query)     查询最新电影/剧集（含 Overview/年份）
 *   - ApiClient.getImageUrl(itemId, {type}) 取 Backdrop 横版图 / Logo 图
 *  跳转：window.appRouter.showItem(id)（通过 AURORA.router 获取）
 *
 *  之前「复用卡片 DOM」的思路是错的——Emby 卡片海报是 .cardImage 背景图、且拿不到
 *  Overview/Logo/Backdrop，数据也不可控。改为 API 驱动后数据完整、图高清、跨版本稳定。
 * =============================================================================
 */
(function (global) {
  'use strict';

  var CONFIG = (global.AURORA_CONFIG && global.AURORA_CONFIG.carousel) || {};
  var INTERVAL = Number(CONFIG.interval) || 8000;
  var MAX = Number(CONFIG.maxCount) || 10;
  var mounted = false;

  function api() { return global.AURORA ? global.AURORA.api() : global.ApiClient; }

  // 兼容 Promise 与同步返回
  function unwrap(maybePromise, cb) {
    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.then(cb, function () { cb(null); });
    } else {
      cb(maybePromise);
    }
  }

  // 查询最新电影/剧集（含 Overview、年份，一次拿全，避免逐个 getItem）
  function fetchItems(cb) {
    var client = api();
    if (!client || !client.getItems || !client.getCurrentUserId) { cb([]); return; }
    var userId;
    try { userId = client.getCurrentUserId(); } catch (e) { cb([]); return; }
    var query = {
      IncludeItemTypes: 'Movie,Series',
      SortBy: 'ProductionYear, PremiereDate, SortName',
      SortOrder: 'Descending',
      Recursive: true,
      Limit: MAX,
      Fields: 'ProductionYear,Overview,Genres',
      ImageTypeLimit: 1,
      EnableUserData: false,
      EnableTotalRecordCount: false
    };
    try {
      unwrap(client.getItems(userId, query), function (result) {
        var items = (result && result.Items) || [];
        cb(items);
      });
    } catch (e) { cb([]); }
  }

  function getImageUrl(itemId, type) {
    var client = api();
    if (!client || !client.getImageUrl) return '';
    try {
      var url = client.getImageUrl(itemId, { type: type, maxWidth: 3000 });
      return url || '';
    } catch (e) { return ''; }
  }

  function showItem(id) {
    var routerFn = global.AURORA && global.AURORA.router;
    if (routerFn) {
      routerFn(function (router) {
        if (router && router.showItem) {
          try { router.showItem(id); return; } catch (e) {}
        }
        location.hash = '#/item?id=' + encodeURIComponent(id);
      });
    } else {
      location.hash = '#/item?id=' + encodeURIComponent(id);
    }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function build(items) {
    var container = document.createElement('div');
    container.className = 'aurora-carousel';

    var slides = items.map(function (item, i) {
      var id = item.Id || '';
      var name = item.Name || '';
      var overview = item.Overview || '';
      var year = item.ProductionYear || '';
      var backdrop = getImageUrl(id, 'Backdrop');
      var logo = (item.ImageTags && item.ImageTags.Logo) ? getImageUrl(id, 'Logo') : '';
      var typeLabel = item.Type === 'Series' ? '剧集' : (item.Type === 'Movie' ? '电影' : '');
      var meta = [typeLabel, year].filter(Boolean).join(' · ');

      var logoHtml = logo ? '<img class="aurora-carousel__logo" src="' + esc(logo) + '" alt="">' : '';
      var playIcon = '<svg class="aurora-carousel__playicon" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
      return '<div class="aurora-carousel__slide' + (i === 0 ? ' is-active' : '') + '" data-id="' + esc(id) + '">' +
        (backdrop ? '<img class="aurora-carousel__bg" src="' + esc(backdrop) + '" alt="">' : '<div class="aurora-carousel__bg aurora-carousel__bg--empty"></div>') +
        '<div class="aurora-carousel__auroraline"></div>' +
        '<div class="aurora-carousel__glassbar">' +
          '<div class="aurora-carousel__info">' +
            logoHtml +
            '<h2 class="aurora-carousel__title">' + esc(name) + '</h2>' +
            (meta ? '<div class="aurora-carousel__meta">' + esc(meta) + '</div>' : '') +
            (overview ? '<p class="aurora-carousel__desc">' + esc(overview) + '</p>' : '') +
            '<div class="aurora-carousel__actions">' +
              '<button class="aurora-carousel__btn aurora-carousel__btn--play" data-action="detail">' + playIcon + '播放</button>' +
              '<button class="aurora-carousel__btn aurora-carousel__btn--detail" data-action="detail">详细信息</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    container.innerHTML =
      '<div class="aurora-carousel__track">' + slides + '</div>' +
      (items.length > 1
        ? '<button class="aurora-carousel__arrow aurora-carousel__arrow--prev">‹</button>' +
          '<button class="aurora-carousel__arrow aurora-carousel__arrow--next">›</button>' +
          '<div class="aurora-carousel__dots">' + items.map(function (_, i) {
            return '<button class="aurora-carousel__dot' + (i === 0 ? ' is-active' : '') + '" data-index="' + i + '"></button>';
          }).join('') + '</div>'
        : '');
    return container;
  }

  function mount(items) {
    if (mounted) return;
    // 挂到首页媒体库 section 容器之前（参考 emby-crx 的 .homeSectionsContainer）
    var anchor = document.querySelector('.homeSectionsContainer, .homeLibraryContainer, .view:not(.hide) .pageTabContent');
    if (!anchor) return;

    var el = build(items);
    anchor.parentNode.insertBefore(el, anchor);
    mounted = true;

    var slides = Array.prototype.slice.call(el.querySelectorAll('.aurora-carousel__slide'));
    var dots = Array.prototype.slice.call(el.querySelectorAll('.aurora-carousel__dot'));
    if (!slides.length) return;

    var idx = 0;
    var timer = null;

    function go(n) {
      if (n < 0) n = slides.length - 1;
      if (n >= slides.length) n = 0;
      slides[idx].classList.remove('is-active');
      if (dots[idx]) dots[idx].classList.remove('is-active');
      idx = n;
      slides[idx].classList.add('is-active');
      if (dots[idx]) dots[idx].classList.add('is-active');
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
      var id = slides[idx].getAttribute('data-id');
      if (id) showItem(id);
    });

    play();
  }

  function tryInit() {
    if (mounted || !(global.AURORA && global.AURORA.isHome())) return;
    fetchItems(function (items) {
      var usable = items.filter(function (it) { return it && it.Id; });
      if (usable.length >= 1) mount(usable.slice(0, MAX));
    });
  }

  function start() {
    tryInit();
    // SPA：首页异步渲染 + 导航切换，用 MutationObserver 持续监听
    if (global.MutationObserver) {
      var mo = new MutationObserver(function () {
        if (!mounted) tryInit();
      });
      mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
    }
    // 兜底：前 30 秒每 1s 补扫
    var guard = 0;
    var t = setInterval(function () {
      if (mounted) { clearInterval(t); return; }
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
