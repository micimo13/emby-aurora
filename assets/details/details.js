/*!
 * EmbyAurora — details/details.js（详情页增强，内置）
 * =============================================================================
 *  深度融合「JAV 详情页增强」思路，全部内置、零外部依赖、零 API key：
 *    · 评分徽章：直接读元数据已有评分（CommunityRating/CriticRating/VoteCount/
 *      OfficialRating）+ IMDb/TMDB/TVDB 外链（敏感片也能显示本地刮削的评分）
 *    · 剧照墙：横向拖动滑动 + 点击放大（灯箱查看，支持键盘/箭头切换）
 *    · 预告片：读 RemoteTrailers 一键播放
 *    · 演职员：头像行
 *    · 相关推荐：SimilarItems 海报行
 *
 *  数据源 = window.ApiClient（零配置）。SPA 适配：MutationObserver + setInterval。
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

  /* =======================================================================
   * 抓取 item：用 getItems + 全字段（确保评分/剧照/演职员/预告片都回传，
   * 社区版 amilys 的 getItem 可能缺字段，故统一走 getItems）。
   * ===================================================================== */
  var FIELDS = 'CommunityRating,CriticRating,VoteCount,OfficialRating,ProviderIds,' +
    'ProductionYear,Genres,Overview,People,BackdropImageTags,RemoteTrailers,' +
    'Taglines,Studios,OriginalTitle';

  function fetchItem(cb) {
    var id = getItemId();
    var client = api();
    if (!id || !client || !client.getItems || !client.getCurrentUserId) { cb(null); return; }
    var uid;
    try { uid = client.getCurrentUserId(); } catch (e) { cb(null); return; }
    try {
      unwrap(client.getItems(uid, {
        Ids: id,
        Recursive: true,
        Fields: FIELDS,
        EnableUserData: true,
        EnableTotalRecordCount: false
      }), function (res) {
        cb((res && res.Items && res.Items[0]) || null);
      });
    } catch (e) { cb(null); }
  }

  /* ---- 评分徽章：直接读元数据已有评分（敏感片也能显示） ---- */
  function ratingRow(item) {
    var html = '';
    var cr = item.CommunityRating;          // 社区评分（TMDB/IMDb/自定义刮削写入）
    var critic = item.CriticRating;         // 影评人评分（0-100）
    var votes = item.VoteCount;
    var official = item.OfficialRating;     // 分级，如 R18/PG-13

    if (cr != null && cr > 0) {
      html += '<span class="aurora-rate aurora-rate--main">' +
        '<b>' + (Math.round(cr * 10) / 10).toFixed(1) + '</b>' +
        (votes ? '<small>' + votes + ' 票</small>' : '') + '</span>';
    }
    if (critic != null && critic > 0) {
      html += '<span class="aurora-rate"><i></i>影评人 ' + critic + '%</span>';
    }
    if (official) {
      html += '<span class="aurora-rate aurora-rate--official">' + esc(official) + '</span>';
    }

    // IMDb / TMDB / TVDB / Douban 外链（ProviderIds 已由刮削器写入）
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
    if (p.DoubanId || p.Douban) {
      html += '<a class="aurora-rate aurora-rate--link" style="color:#2e963d" target="_blank" rel="noopener" ' +
        'href="https://movie.douban.com/subject/' + esc(p.DoubanId || p.Douban) + '/">豆瓣</a>';
    }
    return html ? '<div class="aurora-details__ratings">' + html + '</div>' : '';
  }

  /* ---- 预告片 ---- */
  function trailerRow(item) {
    var tr = item.RemoteTrailers || [];
    if (!tr.length) return '';
    var url = tr[0].Url || tr[0].url || '';
    if (!url) return '';
    return '<a class="aurora-rate aurora-rate--play" target="_blank" rel="noopener" href="' + esc(url) + '">' +
      '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>预告片</a>';
  }

  /* ---- 剧照墙（多张 Backdrop，三级回退 + 灯箱） ---- */
  function buildStills(urls) {
    var imgs = urls.map(function (u, i) {
      return '<div class="aurora-still" data-index="' + i + '"><img src="' + esc(u) + '" loading="lazy" alt="">' +
        '<div class="aurora-still__zoom"><svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg></div></div>';
    }).join('');
    return imgs ? '<div class="aurora-details__section"><h4>剧照</h4><div class="aurora-details__stills">' + imgs + '</div></div>' : '';
  }

  function stillsRow(item, cb) {
    // 1) BackdropImageTags（数组 = 多张剧照）
    var tags = item.BackdropImageTags;
    if (tags && tags.length) {
      cb(buildStills(tags.slice(0, 12).map(function (_, i) {
        return getImageUrl(item.Id, 'Backdrop', i);
      }).filter(Boolean)));
      return;
    }
    // 2) 单张 Backdrop 兜底
    if (item.ImageTags && item.ImageTags.Backdrop) {
      var one = getImageUrl(item.Id, 'Backdrop');
      cb(one ? buildStills([one]) : '');
      return;
    }
    cb('');
  }

  /* ---- 演职员 ---- */
  function castRow(item) {
    var people = (item.People || []).slice(0, 12);
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
      unwrap(client.getSimilarItems(item.Id, uid, { Limit: 10 }), function (res) {
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

  /* ---- 灯箱查看大图 ---- */
  function openLightbox(urls, index) {
    if (!urls.length) return;
    var ov = doc.createElement('div');
    ov.className = 'aurora-lb';
    ov.innerHTML =
      '<div class="aurora-lb__bg"></div>' +
      '<img class="aurora-lb__img" src="" alt="">' +
      '<button class="aurora-lb__close" type="button">✕</button>' +
      (urls.length > 1 ? '<button class="aurora-lb__prev" type="button">‹</button>' +
        '<button class="aurora-lb__next" type="button">›</button>' : '') +
      '<div class="aurora-lb__count"></div>';
    (doc.body || doc.documentElement).appendChild(ov);

    var img = ov.querySelector('.aurora-lb__img');
    var count = ov.querySelector('.aurora-lb__count');
    var idx = 0;

    function show(i) {
      idx = (i + urls.length) % urls.length;
      img.src = urls[idx];
      if (count) count.textContent = (idx + 1) + ' / ' + urls.length;
    }
    function close() {
      doc.removeEventListener('keydown', onKey);
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
    }

    show(index || 0);
    ov.querySelector('.aurora-lb__close').addEventListener('click', close);
    ov.querySelector('.aurora-lb__bg').addEventListener('click', close);
    var prev = ov.querySelector('.aurora-lb__prev');
    var next = ov.querySelector('.aurora-lb__next');
    if (prev) prev.addEventListener('click', function () { show(idx - 1); });
    if (next) next.addEventListener('click', function () { show(idx + 1); });
    doc.addEventListener('keydown', onKey);
  }

  /* ---- 拖动滑动（桌面鼠标拖拽；触屏原生滚动） ---- */
  function makeDraggable(el) {
    var down = false, startX = 0, startScroll = 0, moved = false;
    el.addEventListener('mousedown', function (e) {
      down = true; moved = false; startX = e.pageX; startScroll = el.scrollLeft;
      el.classList.add('is-drag');
    });
    el.addEventListener('mouseleave', function () { down = false; el.classList.remove('is-drag'); });
    el.addEventListener('mouseup', function () { down = false; el.classList.remove('is-drag'); });
    el.addEventListener('mousemove', function (e) {
      if (!down) return;
      var dx = e.pageX - startX;
      if (Math.abs(dx) > 4) moved = true;
      if (moved) { e.preventDefault(); el.scrollLeft = startScroll - dx; }
    });
    // 拖动后抑制 click，避免误触灯箱
    el.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);
  }

  /* ---- DOM 工具 ---- */
  function toNode(html) {
    var t = doc.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  /* ---- 组装并挂载 ---- */
  function mount(item) {
    var container = doc.querySelector('.itemDetailPage, .detailPageWrapperContainer, .itemBackdrop');
    if (!container) return false;

    var host = doc.createElement('div');
    host.className = 'aurora-details';
    host.id = 'aurora-details';
    host.innerHTML = ratingRow(item) + trailerRow(item) + castRow(item);

    // 插到主信息区之后（详情页主按钮组下方）
    var anchor = doc.querySelector('.mainDetailButtons, .itemOverview, .detailPagePrimaryContainer');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(host, anchor.nextSibling);
    } else {
      container.appendChild(host);
    }

    // 剧照（异步补齐，插到演职员 section 之前；含拖动 + 灯箱）
    var firstSection = host.querySelector('.aurora-details__section');
    stillsRow(item, function (html) {
      if (!html || !host.parentNode) return;
      var n = toNode(html);
      if (firstSection && firstSection.parentNode) host.insertBefore(n, firstSection);
      else host.appendChild(n);
      var strip = n.querySelector('.aurora-details__stills');
      if (strip) {
        makeDraggable(strip);
        var imgs = Array.prototype.slice.call(strip.querySelectorAll('.aurora-still img')).map(function (im) { return im.getAttribute('src'); });
        strip.addEventListener('click', function (e) {
          var still = e.target.closest ? e.target.closest('.aurora-still') : null;
          if (!still) return;
          openLightbox(imgs, Number(still.getAttribute('data-index')) || 0);
        });
      }
    });

    // 相关推荐异步补齐（追加到最后）
    similarRow(item, function (html) {
      if (html && host.parentNode) host.appendChild(toNode(html));
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
    return true;
  }

  function tryInject() {
    if (!global.AURORA) return;
    var id = getItemId();
    if (!id) { mountedId = null; return; }
    if (mountedId === id || tried[id]) return;
    fetchItem(function (item) {
      if (item && item.Id && mountedId !== id) {
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
