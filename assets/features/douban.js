/*!
 * EmbyAurora — features/douban.js
 * 豆瓣 / Bangumi 评分展示（可配置数据源，API 失败静默降级，不影响 Emby 使用）
 * 数据源优先级：自建代理(可配) → Bangumi 公开 API
 */
(function (global) {
  'use strict';

  var CONFIG = (global.AURORA_CONFIG && global.AURORA_CONFIG.features) || {};
  var SOURCE = CONFIG.ratingSource || 'bangumi'; // bangumi | douban
  var DOUBAN_API = CONFIG.doubanApi || '';       // 自建豆瓣代理，如 https://your-proxy/douban

  function getTitle() {
    var el = document.querySelector('.detailPagePrimaryContainer .itemName, .itemName, .parentName, .detailImageContainer .itemName');
    return el ? el.textContent.trim() : '';
  }
  function getYear() {
    var el = document.querySelector('.itemMiscInfo, .itemYear');
    if (!el) return '';
    var m = el.textContent.match(/(19|20)\d{2}/);
    return m ? m[0] : '';
  }

  function fetchJSON(url, cb) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = 8000;
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { cb(JSON.parse(xhr.responseText)); } catch (e) {}
        }
      };
      xhr.send();
    } catch (e) {}
  }

  function queryBangumi(title, year, cb) {
    // 搜索番剧
    fetchJSON('https://api.bgm.tv/search/subject/' + encodeURIComponent(title) +
      '?type=2&responseGroup=small', function (data) {
      var list = (data && data.list) || [];
      if (!list.length) return;
      // 按年份过滤，否则取第一个
      var hit = list[0];
      for (var i = 0; i < list.length; i++) {
        if (year && list[i].air_date && list[i].air_date.indexOf(year) === 0) { hit = list[i]; break; }
      }
      cb({ score: hit.rating && hit.rating.score, count: hit.rating && hit.rating.total, src: 'Bangumi' });
    });
  }

  function queryDouban(title, year, cb) {
    if (!DOUBAN_API) return;
    fetchJSON(DOUBAN_API + '/search?q=' + encodeURIComponent(title + (year ? ' ' + year : '')), function (data) {
      var item = (data && data.subjects && data.subjects[0]) || (data && data[0]);
      if (!item) return;
      var rating = item.rating;
      if (!rating) return;
      cb({ score: rating.value || rating.average, count: rating.count, src: '豆瓣' });
    });
  }

  function stars(score) {
    // 5 分制转 5 星显示
    var s = Math.round((score / 2) * 2) / 2;
    var full = Math.floor(s);
    var half = (s - full) >= 0.5;
    var out = '';
    for (var i = 0; i < 5; i++) {
      if (i < full) out += '★';
      else if (i === full && half) out += '⯪';
      else out += '☆';
    }
    return out;
  }

  function render(info) {
    if (document.getElementById('aurora-rating')) return;
    var host = document.querySelector('.detailPagePrimaryContainer .itemMiscInfo, .itemMiscInfo, .mainDetailButtons, .itemDetailPage .detailPagePrimaryContainer');
    if (!host) return;
    var el = document.createElement('div');
    el.id = 'aurora-rating';
    el.className = 'aurora-rating';
    el.innerHTML =
      '<span class="aurora-rating__score">' + (info.score || '—') + '</span>' +
      '<span class="aurora-rating__stars">' + stars(info.score || 0) + '</span>' +
      (info.count ? '<span class="aurora-rating__count">' + info.count + '人</span>' : '') +
      '<span class="aurora-rating__src">' + info.src + '</span>';
    host.parentNode.insertBefore(el, host);
  }

  function init() {
    var title = getTitle();
    if (!title) return;
    var year = getYear();
    var done = function (info) { if (info && info.score) render(info); };
    if (SOURCE === 'douban') {
      queryDouban(title, year, done);
    } else {
      queryBangumi(title, year, done);
    }
  }

  if (global.AURORA && global.AURORA.onReady) {
    global.AURORA.onReady(function () { setTimeout(init, 1500); });
  } else {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 2500); });
  }
})(window);
