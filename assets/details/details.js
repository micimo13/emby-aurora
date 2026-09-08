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
  var inFlight = null;   // 正在抓取的 itemId，避免并发重复注入

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
    // 与 external-player 同源的多路兜底：hash → 完整 URL → 详情页容器内的 data-id
    var m = location.hash.match(/[?&]id=([^&#]+)/i) || location.href.match(/[?&]id=([^&#]+)/i);
    if (m) return decodeURIComponent(m[1]);
    // 仅在「详情页容器」内取 data-id，避免首页卡片 [data-id] 被误判成详情条目
    var page = doc.querySelector('.itemDetailPage, .detailPageWrapperContainer, .detailPagePrimaryContainer');
    var el = page ? page.querySelector('[data-id]') : null;
    return el ? el.getAttribute('data-id') : null;
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
    if (!id || !client || !client.getCurrentUserId) { cb(null); return; }
    var uid;
    try { uid = client.getCurrentUserId(); } catch (e) { cb(null); return; }
    // 主路径：getItem（最可靠，与 external-player 同源）；失败再 getItems 带全字段补齐
    try {
      unwrap(client.getItem(uid, id), function (item) {
        if (item && item.Id) { cb(item); return; }
        try {
          unwrap(client.getItems(uid, {
            Ids: id, Recursive: true, Fields: FIELDS, EnableUserData: true, EnableTotalRecordCount: false
          }), function (res) {
            cb((res && res.Items && res.Items[0]) || null);
          });
        } catch (e) { cb(null); }
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

  /* ---- 剧照墙（多张 Backdrop，三级回退 + 灯箱 + 左右箭头兜底） ---- */
  function buildStills(urls) {
    var imgs = urls.map(function (u, i) {
      return '<div class="aurora-still" data-index="' + i + '"><img src="' + esc(u) + '" loading="lazy" alt="" draggable="false">' +
        '<div class="aurora-still__zoom"><svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg></div></div>';
    }).join('');
    if (!imgs) return '';
    return '<div class="aurora-details__section aurora-details__section--stills"><h4>剧照</h4>' +
      '<div class="aurora-details__stills-wrap">' +
        '<button class="aurora-still-nav aurora-still-nav--prev" type="button" aria-label="上一张">‹</button>' +
        '<div class="aurora-details__stills">' + imgs + '</div>' +
        '<button class="aurora-still-nav aurora-still-nav--next" type="button" aria-label="下一张">›</button>' +
      '</div></div>';
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

  /* ---- 相关推荐（JAV 精髓：同类 + 同演员，多路回退） ---- */
  function buildCards(list) {
    if (!list || !list.length) return '';
    return list.slice(0, 12).map(function (it) {
      var url = it.Id ? getImageUrl(it.Id, 'Primary') : '';
      var art = url
        ? '<img src="' + esc(url) + '" loading="lazy" alt="">'
        : '<div class="aurora-rel__ph">' + esc((it.Name || '?').charAt(0)) + '</div>';
      return '<div class="aurora-rel" data-id="' + esc(it.Id || '') + '">' + art +
        '<div class="aurora-rel__name">' + esc(it.Name || '') + '</div></div>';
    }).join('');
  }

  function relatedRows(item, append) {
    var client = api();
    if (!client || !client.getCurrentUserId) return;
    var uid;
    try { uid = client.getCurrentUserId(); } catch (e) { return; }

    function addSection(label, list) {
      var cards = buildCards(list);
      if (cards) {
        append('<div class="aurora-details__section"><h4>' + label + '</h4>' +
          '<div class="aurora-details__related">' + cards + '</div></div>');
      }
    }
    function withoutSelf(list) {
      return (list || []).filter(function (it) { return it.Id !== item.Id; });
    }

    // ① 相关推荐：优先 getSimilarItems；amilys 社区版可能返回空 → 同题材兜底
    function similarOrGenre(done) {
      if (client.getSimilarItems) {
        try {
          unwrap(client.getSimilarItems(item.Id, uid, { Limit: 12 }), function (res) {
            var list = withoutSelf((res && res.Items) || []);
            if (list.length) { addSection('相关推荐', list); done(); return; }
            byGenre(done);
          });
          return;
        } catch (e) {}
      }
      byGenre(done);
    }
    function byGenre(done) {
      var query = {
        Recursive: true, IncludeItemTypes: item.Type || 'Movie', Limit: 12,
        Fields: 'PrimaryImageAspectRatio', EnableUserData: false,
        EnableTotalRecordCount: false, SortBy: 'Random'
      };
      if (item.Genres && item.Genres.length) query.Genres = item.Genres[0];
      try {
        unwrap(client.getItems(uid, query), function (res) {
          addSection('同类推荐', withoutSelf((res && res.Items) || []));
          done();
        });
      } catch (e) { done(); }
    }
    // ② 同演员推荐（JAV 详情页精髓：同女优/演员作品）
    function byActor() {
      var people = (item.People || []).filter(function (p) { return p.Id; });
      if (!people.length) return;
      try {
        unwrap(client.getItems(uid, {
          Recursive: true, PersonIds: people[0].Id, Limit: 12,
          Fields: 'PrimaryImageAspectRatio', EnableUserData: false,
          EnableTotalRecordCount: false
        }), function (res) {
          addSection('同演员推荐', withoutSelf((res && res.Items) || []));
        });
      } catch (e) {}
    }

    similarOrGenre(function () { byActor(); });
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

  /* ---- 拖动滑动（Pointer Events：鼠标/触屏/触控笔统一，setPointerCapture 拖出元素也能继续） ---- */
  function makeDraggable(el) {
    var down = false, startX = 0, startScroll = 0, moved = false, pid = null;

    function onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return; // 仅左键
      down = true; moved = false; startX = e.clientX; startScroll = el.scrollLeft; pid = e.pointerId;
      el.classList.add('is-drag');
      if (el.setPointerCapture) { try { el.setPointerCapture(pid); } catch (err) {} }
    }
    function onMove(e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      if (moved) {
        if (e.cancelable) e.preventDefault();
        el.scrollLeft = startScroll - dx;
      }
    }
    function onEnd() {
      down = false; el.classList.remove('is-drag');
      if (pid != null && el.releasePointerCapture) { try { el.releasePointerCapture(pid); } catch (err) {} }
      pid = null;
    }

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onEnd);
    el.addEventListener('pointercancel', onEnd);

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

  /* ---- 组装并挂载 ----
   * 排版（修复「按钮被挤出首屏、要下滑才看得到」）：
   *   · 紧凑元信息条（评分 + 预告片）紧跟 .mainDetailButtons 之后，横向一行，不撑高；
   *   · 大块增强（剧照 / 演职员 / 相关推荐 / 同演员）放到 .itemOverview 之后，
   *     不打断 Emby 原生「标题 → 按钮 → 简介」的主视觉流。
   */
  function mount(item) {
    var btnAnchor = doc.querySelector('.mainDetailButtons, .detailButtons, .detailButtonContainer');
    if (!btnAnchor || !btnAnchor.parentNode) return false;

    // ① 紧凑元信息条：评分 + 预告片（紧跟按钮组，不挤出首屏）
    var metaHtml = ratingRow(item) + trailerRow(item);
    var meta = doc.createElement('div');
    meta.className = 'aurora-details aurora-details--meta';
    meta.id = 'aurora-details-meta';
    meta.innerHTML = metaHtml;
    if (metaHtml) btnAnchor.parentNode.insertBefore(meta, btnAnchor.nextSibling);

    // ② 大块增强：剧照 / 演职员 / 相关推荐 / 同演员（放到简介之后）
    var extras = doc.createElement('div');
    extras.className = 'aurora-details aurora-details--extras';
    extras.id = 'aurora-details';
    extras.setAttribute('data-id', item.Id);
    extras.innerHTML = castRow(item);
    var overview = doc.querySelector('.itemOverview, .itemMiscInfo');
    if (overview && overview.parentNode) {
      overview.parentNode.insertBefore(extras, overview.nextSibling);
    } else {
      btnAnchor.parentNode.appendChild(extras);
    }

    // 剧照（异步补齐，插到第一个 section 之前；含拖动 + 灯箱）
    var firstSection = extras.querySelector('.aurora-details__section');
    stillsRow(item, function (html) {
      if (!html || !extras.parentNode) return;
      var n = toNode(html);
      if (firstSection && firstSection.parentNode) extras.insertBefore(n, firstSection);
      else extras.appendChild(n);
      var strip = n.querySelector('.aurora-details__stills');
      if (strip) {
        makeDraggable(strip);
        // 左右箭头按钮（悬停显示，兜底：即使拖拽失效也能滚动查看后面的剧照）
        var prev = n.querySelector('.aurora-still-nav--prev');
        var next = n.querySelector('.aurora-still-nav--next');
        var stepWidth = function () {
          var card = strip.querySelector('.aurora-still');
          return (card ? card.getBoundingClientRect().width : 248) + 14; // 卡片宽 + 间距
        };
        function scrollBy(dir) {
          try { strip.scrollBy({ left: dir * stepWidth(), behavior: 'smooth' }); }
          catch (e) { strip.scrollLeft += dir * stepWidth(); }
        }
        if (prev) prev.addEventListener('click', function (e) { e.stopPropagation(); scrollBy(-1); });
        if (next) next.addEventListener('click', function (e) { e.stopPropagation(); scrollBy(1); });

        var imgs = Array.prototype.slice.call(strip.querySelectorAll('.aurora-still img')).map(function (im) { return im.getAttribute('src'); });
        strip.addEventListener('click', function (e) {
          var still = e.target && e.target.closest ? e.target.closest('.aurora-still') : null;
          if (!still) return;
          openLightbox(imgs, Number(still.getAttribute('data-index')) || 0);
        });
      }
    });

    // 相关推荐 + 同演员（异步补齐，追加到最后）
    relatedRows(item, function (html) {
      if (html && extras.parentNode) extras.appendChild(toNode(html));
    });

    // 点击推荐卡片跳转（委托到 extras，含同类/同演员）
    extras.addEventListener('click', function (e) {
      var rel = e.target && e.target.closest ? e.target.closest('.aurora-rel') : null;
      if (!rel) return;
      var id = rel.getAttribute('data-id');
      if (!id) return;
      global.AURORA.router(function (r) {
        if (r && r.showItem) { try { r.showItem(id); return; } catch (e) {} }
        location.hash = '#/item?id=' + encodeURIComponent(id);
      });
    });

    return true;
  }

  function tryInject() {
    if (!global.AURORA) return;
    var id = getItemId();
    if (!id) return; // 非详情页：什么都不做（Emby 导航会自行移除旧 DOM）
    // 已正确注入则跳过（基于 DOM 存在性判断，不依赖易泄漏的内存状态）
    var existing = doc.getElementById('aurora-details');
    if (existing && existing.getAttribute('data-id') === id) return;
    if (inFlight === id) return; // 正在抓取该条目，避免并发重复
    inFlight = id;
    fetchItem(function (item) {
      inFlight = null;
      if (!item || !item.Id) return;
      if (getItemId() !== id) return; // 抓取期间用户已切走
      // 移除旧注入（元信息条 + 大块增强），再注入新的，避免跨条目残留
      var old = doc.getElementById('aurora-details');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      var oldMeta = doc.getElementById('aurora-details-meta');
      if (oldMeta && oldMeta.parentNode) oldMeta.parentNode.removeChild(oldMeta);
      mount(item);
    });
  }

  function start() {
    tryInject();
    if (global.MutationObserver) {
      var mo = new MutationObserver(function () { tryInject(); });
      mo.observe(doc.body || doc.documentElement, { childList: true, subtree: true });
    }
    setInterval(tryInject, 1500);
  }

  if (global.AURORA && global.AURORA.onReady) {
    global.AURORA.onReady(start);
  } else {
    doc.addEventListener('DOMContentLoaded', function () { setTimeout(start, 1200); });
  }
})(window);
