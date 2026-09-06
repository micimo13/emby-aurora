# EmbyAurora 设计文档

> 记录项目调研结论、架构决策与关键教训。本轮（v3 重建）两大变化：**① 轮播从「复用卡片 DOM」改为「ApiClient API 驱动」；② 美学从「换色」升级为「极光设计语言」，部署从「单 Docker」扩展为「4 种形态」。**

## 1. 定位

面向自建媒体库（Docker / NAS / 裸机 / 套件）的 **Emby 前端美化工具箱**：一键部署、预热加载页、首页轮播大屏、主题美化、Logo 替换、功能增强（外部播放器/评分/弹幕/倍速等），全部配置驱动、可交互选择安装。

**自成一派的两个支点：**

1. **服务端注入，而非浏览器端插件。** 市面主流方案分两派——浏览器扩展派（emby-crx，装 Chrome 扩展）与油猴脚本派（embyExternalUrl，装 Tampermonkey），它们都只对「装了插件的那台设备那个浏览器」生效。EmbyAurora 直接改服务端 `dashboard-ui/` 并注入 `index.html`，任何设备、任何浏览器、任何人 Web 访问即生效，零客户端安装。这是三类里唯一的「服务端方案」。

2. **极光设计语言，而非换色皮肤。** emby-crx 的 misty-banner 是「整图渐隐 + 左下信息块」；EmbyAurora 以「极光」为核心意象构建一套原创视觉系统（见第 5 节），构图、渐变、玻璃、光晕都是自己的，不是照搬。

## 2. 技术路线

采用 **静态文件注入**（拷贝资源到 `dashboard-ui/aurora/`，改 `index.html` 注入引用），这是 `Nolovenodie/emby-crx`（1.2k stars，即「CRX 大佬」）与 `Emby-Home-Swiper-UI` 等主流方案验证过的路径，最贴合 Docker/NAS 自建场景。

## 3. 调研结论（关键 Emby 事实）

深入研读 emby-crx / embyExternalUrl / Emby-Home-Swiper-UI 源码后，纠正了 v1 的多个错误假设：

| 主题 | 结论 | 来源 |
|---|---|---|
| **轮播数据来源** | 用 `ApiClient.getItems(userId, query)` 查最新影视 + `getImageUrl(itemId, {type})` 取图，**不是复用卡片 DOM** | emby-crx `content/main.js` |
| **图片获取** | `ApiClient.getImageUrl(id, {type: "Backdrop"/"Logo"/"Primary", maxWidth})` 同步返回 URL | emby-crx |
| **跳转详情页** | `appRouter.showItem(id)`（经 `window.require(["appRouter"])` 获取） | emby-crx `initEvent` |
| **就绪信号** | `window.ApiClient`（轮播/播放器都依赖它，比猜 DOM 可靠） | emby-crx `injectCall` |
| **首页 URL 判断** | `location.href.indexOf("!/home")` | emby-crx `Home.start` |
| **外部播放器直链** | `${ApiClient._serverAddress}/emby/Videos/{id}/stream?api_key=&Static=true&DeviceId=` | embyExternalUrl |
| **播放器注入点** | `div[is='emby-scroller']:not(.hide) .mainDetailButtons` | embyExternalUrl |
| **Emby 检测** | `meta[name=application-name]` content == "Emby" | emby-crx |
| **卡片海报** | `.cardImage` div 背景图 + `data-src` 懒加载（不是 `<img>`） | emby-crx CSS / community |

## 4. 核心架构

```
install.sh ──► choose_deploy（docker / bare / proxy / userscript）
           ├─ docker     ：detect.sh（容器/镜像/目录/版本）→ push assets → inject index.html
           ├─ bare       ：detect_bare_dir（探测宿主机 dashboard-ui）→ cp assets → inject index.html
           ├─ proxy      ：gen_proxy（生成 Nginx sub_filter 片段，不改 Emby 文件）
           └─ userscript ：gen_userscript（生成 Tampermonkey 脚本，资源从 GitHub 加载）
           └─ 交互式选择功能（choose_features）→ 覆盖 config
```

**部署后端抽象**：`DEPLOY_MODE`（docker/bare）贯穿 `common.sh`，同一套 `push_dir`/`inject_index`/`backup_index` 逻辑在容器与宿主机之间切换，避免重复代码。

**前端加载时序**：

```
index.html </head> 前注入
   ├─ <script src="aurora/config.js">     → window.AURORA_CONFIG
   └─ <script src="aurora/bootstrap.js">  → 同步执行：
         1. 检测 Emby（meta application-name）
         2. 同步挂载加载页（documentElement，零闪烁）
         3. 应用主题 CSS
         4. 等待 ApiClient 就绪（20s 兜底）
         5. 就绪后：Logo 替换 / 加载模块 / 淡出加载页
```

## 5. 关键设计决策

1. **零依赖**：静态注入直接运行在页面上下文，直接访问 `window.ApiClient` / `window.require` / `window.appRouter`，无需 jQuery/md5/BroadcastChannel（后者是浏览器扩展 content-script 隔离才需要的）。
2. **API 驱动轮播**：`getItems` 一次拿全 Name/Overview/ProductionYear/ImageTags，`getImageUrl` 取高清 Backdrop/Logo，数据完整、跨版本稳定。
3. **AURORA 工具层**：bootstrap 暴露 `AURORA.api()` / `AURORA.router(cb)` / `AURORA.isHome()` / `AURORA.onReady(fn)`，功能模块统一入口。
4. **SPA 适配**：所有「注入详情页/首页/播放页元素」的模块都用 `setInterval` + `MutationObserver` 持续监听注入点（一次性 `setTimeout` 会因异步渲染失效）。
5. **交互式安装**：`install.sh` 逐个询问要装的功能，`sed` 精确覆盖 config 副本开关。
6. **防御式降级**：API/DOM 选择器失效只降级不报错，豆瓣/弹幕依赖外部源失败静默跳过。

## 6. 极光设计系统（Aurora Design Language）

以「极光」为核心意象，四个维度构成一套原创视觉语言（`aurora.css` 定义 token，`themes/*.css` 覆盖变量）：

| 维度 | 说明 | 落点 |
|---|---|---|
| **极光渐变** | 青→蓝紫→紫→品红四段流动渐变（北极光真实色序） | 顶栏签名线 / 轮播极光线 / 播放按钮 / 指示点 / 滚动条 |
| **深空背景** | 夜空蓝黑（`#07070f`），非死黑，有"星空感" | 全局底色 / 轮播底 / 加载页 |
| **玻璃拟态** | 半透明 + 极光细边框 + backdrop-blur | 顶栏 / 卡片信息层 / 轮播玻璃信息条 |
| **氛围光晕** | 悬浮时极光色光晕扩散 | 卡片 hover / 选中描边 / 播放按钮投影 |

**4 套主题**（每套是完整 token，非换强调色）：

| 主题 | 意象 | 主色 |
|---|---|---|
| aurora 极光 | 北极光 | 青→蓝紫→品红 |
| ice 冰川 | 极寒冰川 | 青蓝冷调 |
| nebula 星云 | 玫瑰星云 | 紫红暖调 |
| cinema 黑金 | 影院银幕 | 香槟金 + 纯黑 |

**轮播「极光玻璃信息条」构图**（区别于 emby-crx 的 misty-banner）：
- misty-banner：整图底部渐隐到背景色 + 信息浮在左下角
- Aurora：顶部一条流动极光线（品牌签名）+ 底部一整条毛玻璃信息条（透过玻璃看海报），Logo/标题/简介/播放·详情按钮都承载在玻璃条上

## 7. 部署方式（4 选 1）

| 方式 | 后端 | 是否改 Emby 文件 | 产物 |
|---|---|---|---|
| docker | `docker exec` / `docker cp` | 是（容器内） | 直接生效 |
| bare | 宿主机 `cp` / `sed` | 是（宿主机） | 直接生效 |
| proxy | 不触碰 Emby | 否 | `nginx-emby-aurora.conf` + 说明 |
| userscript | 不触碰 Emby | 否 | `aurora.user.js`（Tampermonkey） |

## 8. v1 → v2 教训

- v1 的轮播用 `card.querySelector('img')` 提取海报——但 Emby 海报是 `.cardImage` 背景图，导致拿不到图、轮播永不渲染。
- v1 的功能模块用一次性 `setTimeout(1200)`——但 Emby 是 SPA，详情页/播放页异步渲染，注入点尚未出现就错过了。
- 教训：**美化 Emby 必须基于真实源码调研，不能凭记忆猜 DOM/API**。本轮已逐行研读 emby-crx / embyExternalUrl 源码并固化结论（见第 3 节）。

## 9. 路线图

- [x] 加载页（3 风格）+ 主题（4 套：极光/冰川/星云/黑金）+ Logo 替换 + API 驱动轮播（极光玻璃信息条）+ 倍速/外部播放器/评分/弹幕/布局 + 交互式安装
- [x] 部署方式 4 选 1（docker / 裸机 / 反向代理 / 油猴）
- [ ] 更多主题（樱花粉 / 石墨黑 / 日间浅色）
- [ ] 轮播内容策展（按评分/年份/库过滤）
- [ ] 配置可视化向导
- [ ] 移动端 / TV 端适配优化
