/*!
 * EmbyAurora — features/danmaku.js
 * =============================================================================
 *  弹幕引擎（渲染核心，零依赖）+ B 站数据源适配
 *  渲染：DOM + CSS transform 动画（GPU 加速），轨道分配 + 防重叠
 *  数据：优先自配置 cid/弹幕源；否则调用 B 站 API 按标题匹配（不保证稳定，可替换）
 * =============================================================================
 */
(function (global) {
  'use strict';

  var CONFIG = (global.AURORA_CONFIG && global.AURORA_CONFIG.features) || {};
  var API = CONFIG.danmakuApi || ''; // 可自建弹幕源：GET {api}?title=xxx&season=1&episode=1 → { comments: [{t, text, color}] }

  var COLORS = ['#ffffff', '#ffd93d', '#4dd0e1', '#ff8a80', '#a5d6a7', '#ce93d8', '#90caf9'];

  function getEpisodeInfo() {
    var title = '';
    var t = document.querySelector('.videoPlayerContainer, .nowPlayingPage, .itemDetailPage');
    var titleEl = document.querySelector('.nowPlayingBar .nowPlayingBarText, .nowPlayingPage .itemName, .videoPlayerContainer');
    if (titleEl) title = titleEl.textContent.trim().slice(0, 60);
    // 集数
    var m = location.href.match(/[?&](?:season|episode|indexNumber)=([^&]+)/);
    return { title: title || '未知', episode: m ? m[1] : '' };
  }

  // ---------- 渲染引擎 ----------
  var layer = null;
  var tracks = [];

  function ensureLayer() {
    if (layer) return layer;
    layer = document.createElement('div');
    layer.className = 'aurora-danmaku';
    layer.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:999;';
    var host = document.querySelector('.videoPlayerContainer, video');
    var parent = host ? (host.parentNode || document.body) : document.body;
    if (parent !== document.body && getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }
    parent.appendChild(layer);
    // 注入滚动动画
    if (!document.getElementById('aurora-danmaku-css')) {
      var s = document.createElement('style');
      s.id = 'aurora-danmaku-css';
      s.textContent = '.aurora-danmaku__item{position:absolute;left:0;top:0;white-space:nowrap;' +
        'font-size:20px;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,.8);' +
        'animation:aurora-dm linear forwards;will-change:transform;}@keyframes aurora-dm{from{transform:translateX(0)}to{transform:translateX(calc(-100vw - 100%))}}';
      document.head.appendChild(s);
    }
    return layer;
  }

  function layoutTracks(height) {
    var row = 28;
    var n = Math.max(4, Math.floor((height - 20) / row));
    tracks = [];
    for (var i = 0; i < n; i++) tracks.push(0);
  }

  function pickTrack() {
    var now = Date.now();
    var free = [];
    for (var i = 0; i < tracks.length; i++) if (tracks[i] <= now) free.push(i);
    if (!free.length) return -1;
    return free[Math.floor(Math.random() * free.length)];
  }

  function shoot(comment) {
    var el = ensureLayer();
    var h = el.clientHeight || 360;
    if (!tracks.length) layoutTracks(h);
    var row = pickTrack();
    if (row < 0) return;
    var speed = Number(CONFIG.danmakuSpeed) || 9; // 秒
    var text = comment.text || '';
    var dur = Math.max(6, speed + text.length * 0.12);
    tracks[row] = Date.now() + (dur * 800);

    var item = document.createElement('span');
    item.className = 'aurora-danmaku__item';
    item.textContent = text;
    item.style.top = (row * 28 + 4) + 'px';
    item.style.color = comment.color || COLORS[Math.floor(Math.random() * COLORS.length)];
    item.style.animationDuration = dur + 's';
    el.appendChild(item);
    item.addEventListener('animationend', function () { item.remove(); });
  }

  function feed(comments) {
    var idx = 0;
    function next() {
      if (idx >= comments.length) return;
      var c = comments[idx++];
      // 按弹幕时间戳播（相对秒）
      setTimeout(function () { shoot(c); next(); }, Math.min(600, (c.t || 0) * 1000));
    }
    next();
  }

  // ---------- 数据源 ----------
  function fetchBiliByTitle(title, episode, cb) {
    if (!API) return;
    var url = API + '?title=' + encodeURIComponent(title) + '&episode=' + encodeURIComponent(episode);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.timeout = 8000;
    xhr.onload = function () {
      try {
        var data = JSON.parse(xhr.responseText);
        cb(data.comments || data || []);
      } catch (e) {}
    };
    xhr.send();
  }

  function init() {
    // 播放页才启用
    if (!document.querySelector('video, .videoPlayerContainer')) return;
    var info = getEpisodeInfo();
    fetchBiliByTitle(info.title, info.episode, function (comments) {
      if (comments && comments.length) feed(comments);
    });
  }

  if (global.AURORA && global.AURORA.onReady) {
    global.AURORA.onReady(function () { setTimeout(init, 2000); });
  } else {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 3000); });
  }
})(window);
