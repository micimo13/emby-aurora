/*!
 * EmbyAurora — features/speed.js
 * 播放倍速 + 倍速记忆（localStorage 持久化，刷新/重启恢复）
 * 快捷键：Ctrl/Cmd + ↑ / ↓ 调速（0.25 ~ 3.0，步进 0.25）
 */
(function (global) {
  'use strict';
  var KEY = 'aurora_speed';
  var SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  var current = Number(localStorage.getItem(KEY)) || 1;

  function apply(video) {
    if (!video) return;
    try { video.playbackRate = current; } catch (e) {}
  }
  function setSpeed(v, video) {
    current = v;
    localStorage.setItem(KEY, String(v));
    if (video) { try { video.playbackRate = v; } catch (e) {} }
    toast('倍速 ' + v + 'x');
  }
  function nextSpeed(dir, video) {
    var i = SPEEDS.indexOf(current);
    i = i < 0 ? SPEEDS.indexOf(1) : i;
    i = Math.max(0, Math.min(SPEEDS.length - 1, i + dir));
    setSpeed(SPEEDS[i], video);
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

  function bindVideo(video) {
    apply(video);
    // 监听速率变化事件（用户用 Emby 自带菜单改速时同步记忆）
    video.addEventListener('ratechange', function () {
      if (video.playbackRate && video.playbackRate !== current) {
        current = video.playbackRate;
        localStorage.setItem(KEY, String(current));
      }
    });
  }

  function watch() {
    var seen = new WeakMap();
    var timer = setInterval(function () {
      var v = document.querySelector('video');
      if (v && !seen.get(v)) { seen.set(v, 1); bindVideo(v); }
    }, 800);
    document.addEventListener('keydown', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      var video = document.querySelector('video');
      if (!video) return;
      if (e.key === 'ArrowUp') { e.preventDefault(); nextSpeed(1, video); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); nextSpeed(-1, video); }
    });
    // 卸载时保留 timer 无妨（SPA 常驻）
  }

  if (global.AURORA && global.AURORA.onReady) global.AURORA.onReady(watch);
  else document.addEventListener('DOMContentLoaded', watch);
})(window);
