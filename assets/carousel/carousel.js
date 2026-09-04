/*!
 * EmbyAurora — carousel.js
 * =============================================================================
 *  沉浸式首页轮播：复用首页 section 已有卡片数据（零 API 依赖、零 token 处理），
 *  跨 Emby 4.8/4.9 稳定运行。海报模糊作背景，前景海报 + 信息 + 播放/详情按钮。
 * =============================================================================
 */
(function (global) {
  'use strict';

  var CONFIG = (global.AURORA_CONFIG && global.AURORA_CONFIG.carousel) || {};
  var INTERVAL = Number(CONFIG.interval) || 8000;
  var MAX = Number(CONFIG.maxCount) || 8;

  function collectCards() {
    // 收集首页各 section 的卡片，去重，最多 MAX 张
    var cards = [];
    var sections = document.querySelectorAll('.homeSection, .homeLibraryContainer .verticalSection, section[data-type]');
    var seen = {};
    Array.prototype.forEach.call(sections.length ? sections : [document], function (sec) {
      var list = sec.querySelectorAll ? sec.querySelectorAll('.card, .cardContent, .backdropCard') : [];
      Array.prototype.forEach.call(list, function (card) {
        var id = card.getAttribute('data-id') || card.getAttribute('data-itemid');
        if (!id || seen[id]) return;
        var title = (card.querySelector('.cardText, .cardTitle, .itemName') || {}).textContent || '';
        title = title.trim();
        if (!title) return;
        var img = card.querySelector('img.cardImage, img');
        var poster = img ? (img.getAttribute('src') || img.getAttribute('data-src') || '') : '';
        if (!poster) return;
        seen[id] = 1;
        cards.push({
          id: id,
          title: title,
          poster: poster,
          serverId: card.getAttribute('data-serverid') || card.getAttribute('data-serverId') || getServerId(),
          type: card.getAttribute('data-type') || ''
        });
        if (cards.length >= MAX) return;
      });
    });
    return cards;
  }

  function getServerId() {
    var m = location.href.match(/[?&]serverId=([^&]+)/);
    if (m) return m[1];
    var api = global.ApiClient;
    if (api && api.serverId) { try { return api.serverId(); } catch (e) {} }
    return '';
  }

  function build(cards) {
    var container = document.createElement('div');
    container.className = 'aurora-carousel';

    var track = '<div class="aurora-carousel__track">' + cards.map(function (c, i) {
      return '<div class="aurora-carousel__slide' + (i === 0 ? ' is-active' : '') + '" data-id="' + c.id + '" data-serverid="' + c.serverId + '">' +
        '<div class="aurora-carousel__bg" style="background-image:url(\'' + c.poster.replace(/'/g, '\\\'') + '\')"></div>' +
        '<div class="aurora-carousel__shade"></div>' +
        '<div class="aurora-carousel__content">' +
          '<img class="aurora-carousel__poster" src="' + c.poster.replace(/'/g, '\\\'') + '" alt="">' +
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

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  }); }

  function mount(cards) {
    // 插入到首页第一个 section 之前
    var anchor = document.querySelector('.homeSection, .homeLibraryContainer .verticalSection, .pageTabContent');
    if (!anchor) return;
    var el = build(cards);
    anchor.parentNode.insertBefore(el, anchor);

    var slides = Array.prototype.slice.call(el.querySelectorAll('.aurora-carousel__slide'));
    var dots = Array.prototype.slice.call(el.querySelectorAll('.aurora-carousel__dot'));
    var idx = 0;
    var timer = null;

    function go(n) {
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

    el.querySelector('.aurora-carousel__arrow--next').addEventListener('click', function () { go(idx + 1); play(); });
    el.querySelector('.aurora-carousel__arrow--prev').addEventListener('click', function () { go(idx - 1); play(); });
    dots.forEach(function (d) {
      d.addEventListener('click', function () { go(Number(d.getAttribute('data-index'))); play(); });
    });
    el.addEventListener('mouseenter', stop);
    el.addEventListener('mouseleave', play);

    // 播放/详情跳转
    el.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-action]') : null;
      if (!btn) return;
      var slide = slides[idx];
      var id = slide.getAttribute('data-id');
      var sid = slide.getAttribute('data-serverid');
      var action = btn.getAttribute('data-action');
      if (action === 'detail') {
        openItem(id, sid);
      } else if (action === 'play') {
        openItem(id, sid, true);
      }
    });

    play();
  }

  function openItem(id, serverId, play) {
    var hash = '#/item?id=' + encodeURIComponent(id);
    if (serverId) hash += '&serverId=' + encodeURIComponent(serverId);
    if (play) hash += '&autoplay=true';
    // 优先用 Emby 路由，失败则回退 hash 跳转
    try {
      if (global.Emby && global.Emby.Page && global.Emby.Page.show) {
        var params = { Id: id, serverId: serverId };
        if (play) params.autoplay = true;
        global.Emby.Page.show({ url: 'itemdetails.html', params: params });
        return;
      }
    } catch (e) {}
    location.hash = hash;
  }

  function init() {
    var cards = collectCards();
    if (cards.length >= 2) {
      mount(cards);
      document.body.classList.add('aurora-carousel-active');
    }
  }

  if (global.AURORA && global.AURORA.onReady) {
    global.AURORA.onReady(function () {
      // 等首页 section 渲染
      var tries = 0;
      (function wait() {
        var ok = document.querySelector('.homeSection, .homeLibraryContainer .verticalSection');
        if (ok || tries > 60) { init(); return; }
        tries++;
        setTimeout(wait, 200);
      })();
    });
  } else {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 1500); });
  }
})(window);
