/*!
 * EmbyAurora — details/details.js（详情页增强，内置）
 * =============================================================================
 *  参考 Emby-Javascript-Details 的「详情页更丰富」思路，但完全内置、零外部依赖：
 *    · 多平台评分：读 Emby 元数据已有评分（CommunityRating / CriticRating）+ IMDb/TMDB 外链
 *    · 剧照墙（Stills）：Backdrop 横图横向滚动
 *    · 演职员（Cast）：导演/主演头像行
 *    · 相关推荐（Related）：SimilarItems 海报行
 *
 *  数据源 = window.ApiClient（零配置，无需 API key）。
 *  SPA 适配：MutationObserver + setInterval 持续监听详情页渲染。
 * =============================================================================
 */
(function (global) {
  'use strict';
  var doc = global.document;
  var mountedId = null;   // 已注入的 itemId，防止重复注入
  var tried = {};         // 记录已尝试的 itemId，避免死循环

  function api() { return global.AURORA ? global.AURORA.api() : global.ApiClient; }

  function unwrap(maybe, cb) {
    if (maybe && typeof maybe.then === 'function') maybe.then(cb, function () { cb(null); });
    else cb(maybe);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function getItemId() {
    var m = location.hash.match(/[?&]id=([^&#]+)/i);
    if (m) return decodeURIComponent(m[1]);
    return null;
  }

  function getImageUrl(itemId, type, index) {
    var client = api();
    if (!client || !client.getImageUrl) return '';
    try {
      var opts = { type: type, maxWidth: 2400 };
      if (index != null) opts.index = index;
      return client.getImageUrl(itemId, opts) || '';
    } catch (e) { return ''; }
  }

  /* ---- 评分徽章：零配置读 Emby 元数据 ---- */
  function ratingRow(item) {
    var html = '';
    var cr = item.CommunityRating;        // 社区评分（TMDB/IMDb 刮削）
    var critic = item.CriticRating;       // 影评人评分（烂番茄式，若有）
    var votes = item.VoteCount;

    if (cr != null) {
      html += '<span class="aurora-rate aurora-rate--main">' +
        '<b>' + (Math.round(cr * 10) / 10).toFixed(1) + '</b>' +
        (votes ? '<small>' + votes + ' 票</small>' : '') + '</span>';
    }
    if (critic != null && critic > 0) {
      html += '<span class="aurora-rate"><i style="background:#FA320A"></i>影评人 ' +
        critic + '%</span>';
    }

    // IMDb / TMDB 外链（ProviderIds 已由刮削器写入）
    var p = item.ProviderIds || {};
    if (p.Imdb) {
      html += '<a class="aurora-rate aurora-rate--link" style="color:#F5C518" target="_blank" rel="noopener" ' +
        'href="https://www.imdb.com/title/' + esc(p.Imdb) + '/">IMDb</a>';
    }
    if (p.Tmdb) {
      html += '<a class="aurora-rate aurora-rate--link" style="color:#01B4E4" target="_blank" rel="noopener" ' +
        'href="https://www.themoviedb.org/movie/' + esc(p.Tmdb) + '">TMDB</a>';
    }
    if (p.Tvdb) {
      html += '<a class="aurora-rate aurora-rate--link" style="color:#6CB04B" target="_blank" rel="noopener" ' +
        'href="https://thetvdb.com/?tab=series&id=' + esc(p.Tvdb) + '">TVDB</a>';
    }
    return html ? '<div class="aurora-details__ratings">' + html + '</div>' : '';
  }

  /* ---- 剧照墙 ---- */
  function stillsRow(item) {
    var tags = item.BackdropImageTags || [];
    if (!tags.length) return '';
    var imgs = tags.slice(0, 8).map(function (_, i) {
      var url = getImageUrl(item.Id, 'Backdrop', i);
      return url ? '<div class="aurora-still"><img src="' + esc(url) + '" loading="lazy" alt=""></div>' : '';
    }).join('');
    return imgs ? '<div class="aurora-details__section"><h4>剧照</h4><div class="aurora-details__stills">' + imgs + '</div></div>' : '';
  }

  /* ---- 演职员 ---- */
  function castRow(item) {
    var people = (item.People || []).slice(0, 10);
    if (!people.length) return '';
    var cards = people.map(function (p) {
      var url = p.Id ? getImageUrl(p.Id, 'Primary') : '';
      var initial = (p.Name || '?').charAt(0);
      var avatar = url
        ? '<div class="aurora-cast__ava"><img src="' + esc(url) + '" loading="lazy" alt=""></div>'
        : '<div class="aurora-cast__ava aurora-cast__ava--ph">' + esc(initial) + '</div>';
      return '<div class="aurora-cast">' + avatar +
        '<div class="aurora-cast__name">' + esc(p.Name || '') + '</div>' +
        '<div class="aurora-cast__role">' + esc(p.Role || p.Type || '') + '</div></div>';
    }).join('');
    return '<div class="aurora-details__section"><h4>演职员</h4><div class="aurora-details__cast">' + cards + '</div></div>';
  }

  /* ---- 相关推荐 ---- */
  function similarRow(item, cb) {
    var client = api();
    if (!client || !client.getSimilarItems || !client.getCurrentUserId) { cb(''); return; }
    var uid;
    try { uid = client.getCurrentUserId(); } catch (e) { cb(''); return; }
    try {
      unwrap(client.getSimilarItems(item.Id, uid, { Limit: 8 }), function (res) {
        var list = (res && res.Items) || [];
        if (!list.length) { cb(''); return; }
        var cards = list.map(function (it) {
          var url = it.Id ? getImageUrl(it.Id, 'Primary') : '';
          var art = url ? '<img src="' + esc(url) + '" loading="lazy" alt="">' : '<div class="aurora-rel__ph">' + esc((it.Name || '?').charAt(0)) + '</div>';
          return '<div class="aurora-rel" data-id="' + esc(it.Id || '') + '">' + art +
            '<div class="aurora-rel__name">' + esc(it.Name || '') + '</div></div>';
        }).join('');
        cb('<div class="aurora-details__section"><h4>相关推荐</h4><div class="aurora-details__related">' + cards + '</div></div>');
      });
    } catch (e) { cb(''); }
  }

  /* ---- 组装并挂载 ---- */
  function mount(item) {
    var container = doc.querySelector('.itemDetailPage, .detailPageWrapperContainer, .itemBackdrop');
    if (!container) return false;

    var host = doc.createElement('div');
    host.className = 'aurora-details';
    host.id = 'aurora-details';
    host.innerHTML = ratingRow(item) + stillsRow(item) + castRow(item);

    // 插到主信息区之后（详情页主按钮组下方）
    var anchor = doc.querySelector('.mainDetailButtons, .itemOverview, .detailPagePrimaryContainer');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(host, anchor.nextSibling);
    } else {
      container.appendChild(host);
    }

    // 相关推荐异步补齐
    similarRow(item, function (html) {
      if (html && host.parentNode) host.insertAdjacentHTML('beforeend', html);
    });

    // 点击相关推荐跳转
    host.addEventListener('click', function (e) {
      var rel = e.target && e.target.closest ? e.target.closest('.aurora-rel') : null;
      if (!rel) return;
      var id = rel.getAttribute('data-id');
      if (!id) return;
      global.AURORA.router(function (r) {
        if (r && r.showItem) { try { r.showItem(id); return; } catch (e) {} }
        location.hash = '#/item?id=' + encodeURIComponent(id);
      });
    });

    mountedId = item.Id;
  }

  function tryInject() {
    if (!global.AURORA || !global.AURORA.isHome) return;
    // 详情页判断：URL 含 item id，且不在首页
    var id = getItemId();
    if (!id) { mountedId = null; return; }
    if (mountedId === id || tried[id]) return;
    var client = api();
    if (!client || !client.getItem || !client.getCurrentUserId) return;
    var uid;
    try { uid = client.getCurrentUserId(); } catch (e) { return; }
    unwrap(client.getItem(uid, id), function (item) {
      if (item && item.Id && mountedId !== id) {
        // 只有 mount 成功（容器已渲染）才标记，否则等 MutationObserver 重试
        if (mount(item)) { tried[id] = true; mountedId = id; }
      }
    });
  }

  function start() {
    tryInject();
    if (global.MutationObserver) {
      var mo = new MutationObserver(function () {
        if (mountedId !== getItemId()) tryInject();
      });
      mo.observe(doc.body || doc.documentElement, { childList: true, subtree: true });
    }
    setInterval(function () {
      if (mountedId !== getItemId()) tryInject();
    }, 1500);
  }

  if (global.AURORA && global.AURORA.onReady) {
    global.AURORA.onReady(start);
  } else {
    doc.addEventListener('DOMContentLoaded', function () { setTimeout(start, 1200); });
  }
})(window);
