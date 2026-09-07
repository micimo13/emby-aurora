/*!
 * EmbyAurora — settings.js（网页设置中心）
 * =============================================================================
 *  部署后，用户可在 Emby 页面内直接：换主题 / 自定义颜色 / 开关渐变。
 *  全部通过操作 CSS 变量（--aurora-*）实时生效，并用 localStorage 持久化。
 *  —— 不需要重新部署、不需要改代码、不需要懂技术。
 *
 *  结构：
 *    · 内置 4 套主题的变量表（与 themes/*.css 保持一致）
 *    · 注入右下角浮动按钮 → 打开抽屉面板
 *    · 持久化 key: aurora.settings
 * =============================================================================
 */
(function (global) {
  'use strict';
  var doc = global.document;

  /* ---- 4 套主题变量表（与 assets/themes/*.css 同步） ---- */
  var THEMES = {
    cinema: {
      bg: '#080808', bgSoft: '#101010', glass: 'rgba(16,16,16,.6)',
      glassStrong: 'rgba(10,10,10,.85)', glassBorder: 'rgba(201,162,39,.28)',
      text: '#f2efe7', textDim: '#8f8a7d', accent: '#c9a227', accentSoft: 'rgba(201,162,39,.16)',
      gradient: '#c9a227', font: 'Georgia,"Songti SC","STSong",serif',
      fontUi: '"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif', radius: '3px', gradOn: false
    },
    snow: {
      bg: '#f5f5f7', bgSoft: '#ffffff', glass: 'rgba(255,255,255,.82)',
      glassStrong: 'rgba(255,255,255,.92)', glassBorder: 'rgba(0,0,0,.1)',
      text: '#1d1d1f', textDim: '#6e6e73', accent: '#0066cc', accentSoft: 'rgba(0,102,204,.1)',
      gradient: '#0066cc', font: '-apple-system,"SF Pro Display","PingFang SC",sans-serif',
      fontUi: '-apple-system,"SF Pro Text","PingFang SC","Microsoft YaHei",sans-serif', radius: '16px', gradOn: false
    },
    space: {
      bg: '#0b1020', bgSoft: '#121a30', glass: 'rgba(255,255,255,.06)',
      glassStrong: 'rgba(14,19,38,.72)', glassBorder: 'rgba(255,255,255,.12)',
      text: '#e6ecff', textDim: '#8b94b0', accent: '#7aa2ff', accentSoft: 'rgba(122,162,255,.16)',
      gradient: 'linear-gradient(120deg,#7aa2ff,#a78bfa)',
      font: '"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif',
      fontUi: '"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif', radius: '14px', gradOn: true
    },
    poster: {
      bg: '#f3efe6', bgSoft: '#ffffff', glass: 'rgba(255,255,255,.86)',
      glassStrong: 'rgba(243,239,230,.94)', glassBorder: 'rgba(20,18,16,.16)',
      text: '#141210', textDim: '#6b6257', accent: '#d8482a', accentSoft: 'rgba(216,72,42,.12)',
      gradient: '#d8482a', font: '"Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif',
      fontUi: '"Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif', radius: '0px', gradOn: false
    }
  };
  var THEME_LABELS = { cinema: '影幕 · 黑金', snow: '雪白 · 极简', space: '深空 · 玻璃', poster: '画报 · 编辑' };
  var THEME_COLORS = { cinema: '#c9a227', snow: '#0066cc', space: '#7aa2ff', poster: '#d8482a' };

  var STORE_KEY = 'aurora.settings';
  var root = doc.documentElement;

  /* ---- 工具 ---- */
  function hsl(h, s) { return 'hsl(' + h + ',' + s + '%,60%)'; }
  function gradOf(h, s) {
    return 'linear-gradient(120deg, hsl(' + h + ',' + s + '%,66%) 0%, hsl(' + h + ',' + s + '%,58%) 42%, hsl(' + ((h + 70) % 360) + ',' + s + '%,62%) 100%)';
  }
  function hexOf(h, s) {
    s /= 100; var l = 60; var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    function f(v) { v = Math.round((v + m) * 255); return ('0' + v.toString(16)).slice(-2); }
    return ('#' + f(r) + f(g) + f(b)).toUpperCase();
  }

  /* ---- 应用变量 ---- */
  function applyVars(v, gradOn) {
    root.style.setProperty('--aurora-bg', v.bg);
    root.style.setProperty('--aurora-bg-soft', v.bgSoft);
    root.style.setProperty('--aurora-glass', v.glass);
    root.style.setProperty('--aurora-glass-strong', v.glassStrong);
    root.style.setProperty('--aurora-glass-border', v.glassBorder);
    root.style.setProperty('--aurora-text', v.text);
    root.style.setProperty('--aurora-text-dim', v.textDim);
    root.style.setProperty('--aurora-accent', v.accent);
    root.style.setProperty('--aurora-accent-soft', v.accentSoft);
    root.style.setProperty('--aurora-gradient', gradOn ? v.gradient : v.accent);
    root.style.setProperty('--aurora-font', v.font);
    root.style.setProperty('--aurora-font-ui', v.fontUi);
    root.style.setProperty('--aurora-radius', v.radius);
  }

  /* ---- 自定义色相覆盖 ---- */
  function applyCustom(h, s, gradOn) {
    var accent = hsl(h, s);
    root.style.setProperty('--aurora-accent', accent);
    root.style.setProperty('--aurora-accent-soft', 'hsla(' + h + ',' + s + '%,60%,.16)');
    root.style.setProperty('--aurora-gradient', gradOn ? gradOf(h, s) : accent);
    root.style.setProperty('--aurora-glass-border', 'hsla(' + h + ',' + s + '%,60%,.28)');
  }

  /* ---- 持久化 ---- */
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }
  function save(obj) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); } catch (e) {}
  }

  /* ---- 应用持久化设置（启动时） ---- */
  function applyStored() {
    var s = load();
    if (!s) return false;
    if (s.theme && THEMES[s.theme]) {
      applyVars(THEMES[s.theme], s.gradOn !== undefined ? s.gradOn : THEMES[s.theme].gradOn);
    }
    if (s.customH !== undefined) {
      applyCustom(s.customH, s.customS, s.gradOn);
    }
    if (s.logo && global.AURORA && global.AURORA.setLogo) {
      global.AURORA.setLogo(s.logo);
    }
    return true;
  }

  /* ---- UI 样式 ---- */
  var CSS = [
    '#aurora-settings-btn{position:fixed;right:18px;bottom:18px;z-index:2147483000;',
    'height:44px;padding:0 16px;display:flex;align-items:center;gap:8px;',
    'border-radius:999px;border:1px solid var(--aurora-glass-border);',
    'background:var(--aurora-glass-strong,rgba(12,12,16,.92));backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);',
    'color:var(--aurora-text);font-family:var(--aurora-font-ui);font-size:13px;font-weight:600;cursor:pointer;',
    'box-shadow:0 8px 24px -8px rgba(0,0,0,.5);transition:transform .2s,box-shadow .2s,border-color .2s;}',
    '#aurora-settings-btn:hover{transform:translateY(-2px);border-color:var(--aurora-accent);',
    'box-shadow:0 12px 28px -8px var(--aurora-accent);}',
    '#aurora-settings-btn svg{flex:none;color:var(--aurora-accent);}',
    '#aurora-settings-mask{position:fixed;inset:0;z-index:2147482998;background:rgba(0,0,0,.5);',
    'opacity:0;pointer-events:none;transition:opacity .3s;}',
    '#aurora-settings-mask.show{opacity:1;pointer-events:auto;}',
    '#aurora-settings-panel{position:fixed;top:0;right:0;bottom:0;width:320px;max-width:92vw;z-index:2147482999;',
    'background:var(--aurora-glass-strong,rgba(12,12,16,.92));backdrop-filter:blur(28px);',
    '-webkit-backdrop-filter:blur(28px);border-left:1px solid var(--aurora-glass-border,rgba(255,255,255,.1));',
    'padding:22px;transform:translateX(100%);transition:transform .32s cubic-bezier(.4,0,.2,1);',
    'overflow-y:auto;font-family:var(--aurora-font-ui);color:var(--aurora-text);}',
    '#aurora-settings-panel.show{transform:translateX(0);}',
    '#aurora-settings-panel h3{margin:0 0 4px;font-size:17px;}',
    '#aurora-settings-panel .sub{font-size:12px;color:var(--aurora-text-dim);margin-bottom:18px;}',
    '#aurora-settings-panel .close{position:absolute;top:16px;right:16px;width:30px;height:30px;',
    'border:none;border-radius:8px;background:rgba(255,255,255,.1);color:inherit;cursor:pointer;font-size:16px;}',
    '#aurora-settings-panel .sec{font-size:12px;font-weight:700;letter-spacing:.08em;',
    'text-transform:uppercase;color:var(--aurora-text-dim);margin:18px 0 10px;}',
    '#aurora-settings-panel .themes{display:grid;grid-template-columns:1fr 1fr;gap:10px;}',
    '#aurora-settings-panel .theme{aspect-ratio:16/9;border-radius:10px;cursor:pointer;border:2px solid transparent;',
    'position:relative;overflow:hidden;transition:transform .15s;}',
    '#aurora-settings-panel .theme:hover{transform:scale(1.05);}',
    '#aurora-settings-panel .theme.on{border-color:#fff;box-shadow:0 0 0 2px var(--aurora-accent);}',
    '#aurora-settings-panel .theme span{position:absolute;left:8px;bottom:6px;font-size:11px;',
    'color:#fff;font-weight:700;text-shadow:0 1px 4px rgba(0,0,0,.6);}',
    '#aurora-settings-panel .logos{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}',
    '#aurora-settings-panel .logo{aspect-ratio:10/3;border-radius:8px;cursor:pointer;border:2px solid transparent;' +
    'background:linear-gradient(135deg,#1a1a22,#0e0e14);display:flex;align-items:center;justify-content:center;' +
    'overflow:hidden;padding:4px 6px;transition:transform .15s;}',
    '#aurora-settings-panel .logo:hover{transform:scale(1.04);}',
    '#aurora-settings-panel .logo.on{border-color:#fff;box-shadow:0 0 0 2px var(--aurora-accent);}',
    '#aurora-settings-panel .logo img{width:100%;height:100%;object-fit:contain;display:block;}',
    '#aurora-settings-panel .row{display:flex;align-items:center;gap:10px;margin-bottom:12px;}',
    '#aurora-settings-panel .row label{flex:none;width:48px;font-size:12px;color:var(--aurora-text-dim);}',
    '#aurora-settings-panel input[type=range]{flex:1;height:6px;border-radius:99px;-webkit-appearance:none;outline:none;}',
    '#aurora-settings-panel input.hue{background:linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);}',
    '#aurora-settings-panel input.sat{background:linear-gradient(90deg,#888,var(--aurora-accent));}',
    '#aurora-settings-panel input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;',
    'border-radius:50%;background:#fff;border:3px solid var(--aurora-accent);cursor:pointer;}',
    '#aurora-settings-panel .sw{display:flex;align-items:center;justify-content:space-between;margin:6px 0;}',
    '#aurora-settings-panel .sw span{font-size:13px;color:var(--aurora-text-dim);}',
    '#aurora-settings-panel .toggle{position:relative;width:42px;height:23px;cursor:pointer;}',
    '#aurora-settings-panel .toggle input{opacity:0;width:0;height:0;}',
    '#aurora-settings-panel .toggle .knob{position:absolute;inset:0;border-radius:99px;background:rgba(128,128,128,.4);transition:.3s;}',
    '#aurora-settings-panel .toggle .knob::before{content:"";position:absolute;left:3px;top:3px;width:17px;height:17px;',
    'border-radius:50%;background:#fff;transition:.3s;}',
    '#aurora-settings-panel .toggle input:checked+.knob{background:var(--aurora-accent);}',
    '#aurora-settings-panel .toggle input:checked+.knob::before{transform:translateX(19px);}',
    '#aurora-settings-panel .hex{margin-top:14px;padding:10px 12px;border-radius:10px;',
    'border:1px solid var(--aurora-glass-border);font-family:monospace;font-size:14px;font-weight:700;',
    'display:flex;align-items:center;gap:10px;}',
    '#aurora-settings-panel .hex .dot{width:26px;height:26px;border-radius:8px;background:var(--aurora-gradient);flex:none;}',
    '#aurora-settings-panel .reset{width:100%;margin-top:12px;padding:10px;border-radius:10px;border:1px solid var(--aurora-glass-border);',
    'background:rgba(255,255,255,.05);color:inherit;cursor:pointer;font-size:13px;}',
    '#aurora-settings-panel .reset:hover{background:var(--aurora-accent-soft);}'
  ].join('');

  function injectCSS() {
    if (doc.getElementById('aurora-settings-css')) return;
    var s = doc.createElement('style');
    s.id = 'aurora-settings-css';
    s.appendChild(doc.createTextNode(CSS));
    (doc.head || doc.documentElement).appendChild(s);
  }

  /* ---- 构建面板 ---- */
  function buildUI() {
    var btn = doc.createElement('button');
    btn.id = 'aurora-settings-btn';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
      '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>' +
      '<line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>' +
      '<line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>' +
      '<line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/>' +
      '<line x1="17" y1="16" x2="23" y2="16"/></svg><span>主题</span>';
    btn.title = 'EmbyAurora 主题设置';

    var mask = doc.createElement('div');
    mask.id = 'aurora-settings-mask';

    var panel = doc.createElement('div');
    panel.id = 'aurora-settings-panel';

    var themeBtns = Object.keys(THEMES).map(function (k) {
      return '<div class="theme" data-theme="' + k + '" style="background:linear-gradient(135deg,' +
        (THEMES[k].gradOn ? '#7aa2ff,#a78bfa' : THEMES[k].accent + ',' + THEMES[k].accent) + ' 40%,' + THEMES[k].bg + ')">' +
        '<span>' + THEME_LABELS[k] + '</span></div>';
    }).join('');

    panel.innerHTML =
      '<button class="close" id="aurora-close">✕</button>' +
      '<h3>主题设置</h3>' +
      '<div class="sub">改完立即生效，自动保存在本浏览器</div>' +
      '<div class="sec">预设主题</div>' +
      '<div class="themes">' + themeBtns + '</div>' +
      '<div class="sec">Logo 预设</div>' +
      '<div class="logos" id="aurora-logos"></div>' +
      '<div class="sec">自定义颜色</div>' +
      '<div class="row"><label>色相</label><input type="range" class="hue" id="aurora-hue" min="0" max="360" value="45"></div>' +
      '<div class="row"><label>饱和度</label><input type="range" class="sat" id="aurora-sat" min="20" max="100" value="70"></div>' +
      '<div class="sw"><span>渐变色（关 = 纯色更克制）</span>' +
      '<label class="toggle"><input type="checkbox" id="aurora-grad"><span class="knob"></span></label></div>' +
      '<div class="hex"><span class="dot"></span><span id="aurora-hex">#C9A227</span></div>' +
      '<button class="reset" id="aurora-reset">恢复默认主题</button>';

    doc.body.appendChild(btn);
    doc.body.appendChild(mask);
    doc.body.appendChild(panel);

    function open() { panel.classList.add('show'); mask.classList.add('show'); }
    function close() { panel.classList.remove('show'); mask.classList.remove('show'); }
    btn.addEventListener('click', open);
    mask.addEventListener('click', close);
    panel.querySelector('#aurora-close').addEventListener('click', close);

    var hue = panel.querySelector('#aurora-hue');
    var sat = panel.querySelector('#aurora-sat');
    var grad = panel.querySelector('#aurora-grad');
    var hexEl = panel.querySelector('#aurora-hex');

    function syncHex() { hexEl.textContent = hexOf(+hue.value, +sat.value); }

    panel.querySelectorAll('.theme').forEach(function (el) {
      el.addEventListener('click', function () {
        var k = el.getAttribute('data-theme');
        var v = THEMES[k];
        applyVars(v, v.gradOn);
        panel.querySelectorAll('.theme').forEach(function (t) { t.classList.remove('on'); });
        el.classList.add('on');
        grad.checked = v.gradOn;
        var m = v.accent.match(/^#([0-9a-f]{6})$/i);
        if (m) {
          var rgb = parseInt(m[1], 16), r = (rgb >> 16) & 255, g = (rgb >> 8) & 255, b = rgb & 255;
          var hslv = rgbToHsl(r, g, b);
          hue.value = Math.round(hslv[0]); sat.value = Math.round(hslv[1] * 100);
        }
        syncHex();
        var s0 = load() || {};
        s0.theme = k; s0.gradOn = v.gradOn;
        save(s0);
      });
    });

    // Logo 预设选择（实时切换 + 持久化）
    var logoBox = panel.querySelector('#aurora-logos');
    function buildLogos() {
      if (!global.AURORA || !global.AURORA.logoPresets) return;
      var presets = global.AURORA.logoPresets();
      logoBox.innerHTML = presets.map(function (p) {
        return '<div class="logo" data-logo="' + p.key + '" title="' + p.label + '">' +
          '<img src="' + p.file + '" alt="' + p.label + '"></div>';
      }).join('');
      logoBox.querySelectorAll('.logo').forEach(function (el) {
        el.addEventListener('click', function () {
          var k = el.getAttribute('data-logo');
          if (global.AURORA.setLogo) global.AURORA.setLogo(k);
          logoBox.querySelectorAll('.logo').forEach(function (t) { t.classList.remove('on'); });
          el.classList.add('on');
          var s1 = load() || {};
          s1.logo = k;
          save(s1);
        });
      });
      var cur = load();
      if (cur && cur.logo) {
        logoBox.querySelectorAll('.logo').forEach(function (t) {
          t.classList.toggle('on', t.getAttribute('data-logo') === cur.logo);
        });
      }
    }
    buildLogos();

    function onPicker() {
      applyCustom(+hue.value, +sat.value, grad.checked);
      syncHex();
      panel.querySelectorAll('.theme').forEach(function (t) { t.classList.remove('on'); });
      var s = load() || {};
      s.customH = +hue.value; s.customS = +sat.value; s.gradOn = grad.checked;
      save(s);
    }
    hue.addEventListener('input', onPicker);
    sat.addEventListener('input', onPicker);
    grad.addEventListener('change', onPicker);

    panel.querySelector('#aurora-reset').addEventListener('click', function () {
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
      applyVars(THEMES.cinema, false);
      panel.querySelectorAll('.theme').forEach(function (t) {
        t.classList.toggle('on', t.getAttribute('data-theme') === 'cinema');
      });
      if (global.AURORA && global.AURORA.setLogo) global.AURORA.setLogo('aurora');
      panel.querySelectorAll('.logo').forEach(function (t) {
        t.classList.toggle('on', t.getAttribute('data-logo') === 'aurora');
      });
      grad.checked = false;
      hue.value = 45; sat.value = 70; syncHex();
    });
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h * 360, s];
  }

  function start() {
    applyStored();
    injectCSS();
    buildUI();
  }

  if (global.AURORA && global.AURORA.onReady) {
    global.AURORA.onReady(start);
  } else {
    doc.addEventListener('DOMContentLoaded', function () { setTimeout(start, 800); });
  }
})(window);
