# EmbyAurora 深度代码审查报告

> 审查范围：全部前端 JS / CSS、Shell 安装脚本、配置模板。
> 审查视角：前端工程师 + 设计师 + 系统运维。
> 结论：发现 **2 个致命 Bug**、**3 个中等问题**、**3 个低风险问题**，全部已修复；另有若干设计取舍项记录在案。

---

## 一、致命 Bug（已修复）

### 1. 加载页挂载在 `document.body` 上 → 注入时 `body` 为 null，脚本崩溃
**文件**：`assets/bootstrap.js`（原第 290 行）

`bootstrap.js` 通过 `sed` 注入在 `</head>` 之前。脚本同步执行时，浏览器尚未解析到 `<body>`，
此刻 `document.body === null`。原代码：

```js
doc.body.appendChild(loadingEl);   // TypeError: Cannot read properties of null
```

这会让 `main()` 直接抛错中断，**加载页、主题、Logo、所有功能全部失效**。

**修复**：回退到 `documentElement`（`<html>` 元素），`position:fixed` 覆盖层仍相对视口渲染，不受影响：

```js
(doc.body || doc.documentElement).appendChild(loadingEl);
```

---

### 2. `AURORA.onReady` 竞态 → 功能模块永远不执行
**文件**：`assets/bootstrap.js` + `assets/features/*.js`、`assets/carousel/carousel.js`

功能模块（轮播 / 倍速 / 弹幕 / 豆瓣 / 外部播放器）是通过 `loadJS` **动态注入**的。
HTML 规范规定：`document.createElement('script')` 插入的脚本是**异步**的——即使设置
`async=false`，也只保证执行顺序，不阻塞当前脚本。

原时序：
1. `waitForEmby` 就绪回调里先 `loadEnabledModules()`（挂 script 标签，异步加载）
2. 紧接着 `each(onReady, fn)` 派发回调队列
3. **但此时功能模块脚本还没加载完**，它们后续才调用 `AURORA.onReady(cb)`，`cb` 被塞进
   一个已经被清空的队列，**永远不被调用**。

结果：所有动态功能增强（轮播、倍速记忆、弹幕、评分、外部播放器）**静默失效**，
只有纯 CSS 主题和同步挂载的加载页能正常工作。

**修复**：引入 `AURORA._ready` 就绪标记。就绪后 `onReady(fn)` 立即执行而非入队：

```js
global.AURORA.onReady = function (fn) {
  if (global.AURORA._ready) { try { fn(); } catch (e) {} }
  else { onReady.push(fn); }
};
```

---

## 二、中等问题（已修复）

### 3. `loading.enabled` 是「死配置」
**文件**：`assets/bootstrap.js` / `config/aurora.config.json`

配置里声明了 `"loading": { "enabled": true }`，但 `bootstrap.js` 从不读取 `LOADING.enabled`，
导致用户设 `enabled: false` 也无法关闭加载页。

**修复**：`main()` 中按 `LOADING.enabled` 判断是否构建与挂载加载页，并同步跳过淡出逻辑。

### 4. `--restore` 只恢复 index.html，容器重建后 assets 丢失 → 注入的 script 404
**文件**：`install.sh`

容器重建会清空 writable 层——**`dashboard-ui/aurora/` 资源目录和 `index.html` 注入一起丢失**。
原 `restore` 分支只从 `/config/backups/aurora/` 拷贝 `index.html` 备份，但 `aurora/` 目录没有
重新部署，导致 `<script src="aurora/bootstrap.js">` 404，美化依旧失效。

**修复**：抽取 `deploy()` 函数（资源拷贝 + 配置生成 + 幂等注入 + 持久化钩子 + 可选第三方集成），
`install` 与 `restore` 共用同一路径——restore 即完整重装。

### 5. `detect_version` 成功时返回非零 → `set -e` 下中断 `--detect-only`
**文件**：`lib/detect.sh`

```bash
[ -z "$VER" ] && VER=$(...)
```

当版本号成功获取时，`[ -z "$VER" ]` 求值为假（退出码 1），`&&` 短路，函数返回 1。
`install.sh` 顶部有 `set -e`，`detect` 模式下 `run_health_check` 是独立语句（无 `||` 保护），
函数返回 1 会直接中断脚本。

**修复**：命令替换追加 `|| true`，函数末尾显式 `return 0`。

---

## 三、低风险问题（已修复）

### 6. `loadCSS` / `loadJS` 缺 `documentElement` 回退
与 `injectCSS` 的 `(doc.head || doc.documentElement)` 不一致。虽在 `</head>` 前 `doc.head`
已存在（实际可用），为防御性一致已统一回退。

### 7. `detect_dashboard_dir` find 兜底触发 `set -e`
`find ... | head -1 | xargs dirname` 在无结果时 `xargs dirname` 空输入非零退出。追加 `|| true` 保护。

### 8. carousel `openItem` 依赖 `Emby.Page.show`
`Emby.Page.show` 在不同 Emby 版本间签名不一致，可能「存在但不生效」且因 `return` 提前返回而阻断
hash 回退。改为直接 `location.hash = '#/item?id=...'`，走 Emby 自身的 hashchange 路由，跨 4.8/4.9 稳定。

---

## 四、已知限制（记录，未改动，避免过度工程）

| 项 | 说明 | 判断 |
|---|---|---|
| `.backgroundContainer/.itemBackdrop` 的 `blur(14px)+scale(1.08)` | 可能与 Emby 原生背景动效叠加 | 设计取舍，非 bug |
| carousel `collectCards` 的 `.cardText/.cardTitle/.itemName` 与 `data-id/data-serverid` 大小写 | 多版本兜底选择器 | best-effort，可接受 |
| `speed.js` 顶层 `localStorage.getItem` | 受限上下文（file://、沙箱）可能抛错 | Emby http/https 下无碍 |
| `install_ext_hook` 仅写 echo 占位 | 未真正实现「重建自动恢复」 | 需手动 `--restore`，README 已说明 |
| shell `sed -i` 依赖 GNU sed | BusyBox 环境可能不兼容 | Emby 镜像均为 Ubuntu 系，可用 |

---

## 五、验证结果

- 全部 6 个 JS 文件：`node --check` 通过 ✅
- 全部 6 个 shell 脚本：`bash -n` 通过 ✅
- `config/aurora.config.json`：JSON 解析通过 ✅
- `.gitattributes` 强制 LF，shell 脚本无 CR 字节 ✅
