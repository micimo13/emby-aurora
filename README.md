# 🎨 EmbyAurora

> **一键脚本部署的 Emby 前端美化工具箱** —— 预热加载页 · 主题魔改 · Logo 替换 · 首页轮播 · 功能增强。
> 零依赖原生实现，告别 jQuery 遗留与历史包袱，一行命令即用。

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License"/>
  <img src="https://img.shields.io/badge/Emby-4.8%20%7C%204.9-green" alt="Emby 4.8|4.9"/>
  <img src="https://img.shields.io/badge/Platform-Docker%20%7C%20NAS-blueviolet" alt="Docker|NAS"/>
  <img src="https://img.shields.io/badge/镜像-官方%20%7C%20LinuxServer%20%7C%20社区-orange" alt="镜像兼容"/>
</p>

---

## ✨ 它是什么？

EmbyAurora 面向自建媒体库爱好者，让你的 Emby（群晖 / 威联通 / 飞牛 / UNRAID / 任意 Linux + Docker）**一行命令焕然一新**：

- 🌌 **预热加载页**：进入首页先展示全屏品牌过渡动画（极光 / 影院黑金 / 极简 3 风格），零闪烁、零依赖
- 🎠 **首页轮播**：原创「极光玻璃信息条」构图——顶部流动极光线 + 底部毛玻璃信息条 + 播放/详情按钮（非 misty-banner 换皮）
- 🎨 **主题美化**：极光 / 冰川 / 星云 / 影院黑金 4 套主题，每套是一套完整设计语言（极光渐变 + 玻璃拟态 + 氛围光晕）
- 🔤 **Logo 替换**：顶栏 + 加载页统一替换为你的品牌 Logo（图片 / 文字两种模式）
- ⚡ **功能增强**：播放倍速记忆 / 外部播放器 / 豆瓣评分 / 弹幕 / Fluent 布局，全部可独立开关

> 💡 核心设计：**单一注入点**（`index.html` 只插一行 `<script>`）+ **配置驱动**（一个 JSON 管所有个性化）。架构清爽，绝无历史包袱。

---

## 🆚 为什么说它「自成一派」

市面上的 Emby 美化方案，基本是两派，都卡在同一个致命局限上——**只对装了插件的那台设备生效**：

| 方案 | 派别 | 生效方式 | 手机/平板/TV/他人设备 |
|---|---|---|---|
| emby-crx | 浏览器扩展派 | 装 Chrome 扩展 | ❌ 全部无效 |
| embyExternalUrl | 油猴脚本派 | 装 Tampermonkey | ❌ 全部无效 |
| Emby-Home-Swiper-UI | 单点派 | 只做轮播 | — |
| Emby-Javascript-Details | 单点派 | 只做详情页 | — |
| **EmbyAurora** | **服务端注入派** | 改 `dashboard-ui/` + 注入 `index.html` | ✅ 任何设备 Web 访问即生效 |

**EmbyAurora 改的是「服务端」，不是「浏览器」。** 资源写进 `dashboard-ui/`、`index.html` 注入一次，于是任何设备、任何浏览器、任何人访问你的 Emby 就自动生效——零客户端安装、可团队共享。这，就是它自成的一派。

再叠加三个独有特性：

1. **一体化工具箱**：轮播 + 主题 + Logo + 加载页 + 功能增强 + 第三方详情页，一个 `config.json` 管所有，而非零散单点。
2. **交互式安装向导**：`install.sh` 逐个询问要装什么，回车用默认值；带幂等标记、自动备份、容器重建 `--restore` 恢复。
3. **预热加载页**：进入首页先有品牌过渡动画，多数方案没有。

---

## 🚀 30 秒上手

在 Emby 宿主机上执行：

```bash
# 一键安装（自动检测容器，交互式向导）
curl -sL https://raw.githubusercontent.com/micimo13/emby-aurora/main/online-install.sh | bash

# 免确认全家桶
curl -sL https://raw.githubusercontent.com/micimo13/emby-aurora/main/online-install.sh | bash -s -- --yes

# 指定容器
curl -sL https://raw.githubusercontent.com/micimo13/emby-aurora/main/online-install.sh | bash -s -- --container emby

# 集成第三方详情页增强（Emby-Javascript-Details：剧照/演员作品/预告片/翻译/Javdb）
curl -sL https://raw.githubusercontent.com/micimo13/emby-aurora/main/online-install.sh | bash -s -- --yes --details
```

安装完成后浏览器 **Ctrl+F5 / Cmd+Shift+R** 强制刷新即可看到效果 ✨

### 本地安装

```bash
git clone https://github.com/micimo13/emby-aurora.git
cd emby-aurora
bash install.sh                 # 交互式安装：逐个选择要装的功能
bash install.sh --yes           # 免确认，用默认配置
bash install.sh --yes --details # 默认配置 + 第三方详情页增强（JAV）
bash install.sh --detect-only   # 只检测环境
bash install.sh --restore       # 容器重建后恢复
bash uninstall.sh               # 卸载
```

> 🎛️ **交互式安装**：运行 `bash install.sh`（不加 `--yes`）会逐个询问要安装的功能——
> ① 预热加载页 ② 首页轮播大屏 ③ 主题 ④ Logo 替换 ⑤ 倍速记忆 ⑥ Fluent 布局
> ⑦ 外部播放器 ⑧ 豆瓣评分 ⑨ 弹幕 ⑩ 第三方详情页增强（JAV）。回车用默认值，按需开/关。

---

## 🎛️ 个性化配置

所有个性化由 `config/aurora.config.json` 控制，安装时自动写入容器。改配置后重跑 `install.sh` 即可生效。常用示例：

```json
{
  "loading": { "style": "cinema", "slogan": "我的私人影院" },
  "theme":   { "name": "cinema" },
  "logo":    { "type": "text", "text": "MY NAS", "color": "#d4af37" },
  "carousel":{ "enabled": true, "interval": 8000 },
  "features":{ "speed": true, "fluent": true, "danmaku": false, "douban": false }
}
```

完整配置项见 [`docs/CONFIG.md`](docs/CONFIG.md)。

---

## 🧩 功能清单

| 类别 | 功能 | 说明 |
|---|---|---|
| 🌌 加载页 | 极光 / 影院黑金 / 极简 | 3 种风格，可配 slogan、配色 |
| 🎠 轮播 | 极光玻璃信息条轮播 | API 驱动（getItems/getImageUrl），顶部极光线 + 底部毛玻璃信息条 |
| 🎨 主题 | 极光 / 冰川 / 星云 / 影院黑金 | 4 套完整设计语言，玻璃拟态 + 圆角 + 氛围光晕 |
| 🔤 Logo | 顶栏 + 加载页替换 | 图片 / 文字双模式 |
| ⚡ 增强 | 倍速记忆 | Ctrl+↑/↓ 调速，刷新/重启恢复 |
| ⚡ 增强 | 外部播放器 | PotPlayer/VLC/IINA/复制直链 |
| ⚡ 增强 | 豆瓣 / Bangumi 评分 | 详情页评分徽章 |
| ⚡ 增强 | 弹幕 | 弹幕渲染引擎 + 可配置数据源 |
| ⚡ 增强 | Fluent 布局 | 侧边栏浮层 + 顶栏沉浸 + 卡片间距 |
| 🔗 第三方 | 详情页增强 | `--details` 一键集成 Emby-Javascript-Details（剧照/演员作品/预告片/翻译/Javdb） |

---

## 🚚 部署方式（4 选 1）

EmbyAurora 不绑定单一部署形态，安装时交互式选择，或 `--deploy` 指定：

| 方式 | 命令 | 适用场景 | 是否改 Emby 文件 |
|---|---|---|---|
| **docker**（默认） | `--deploy docker` | Docker 部署的 Emby | 是（容器内） |
| **bare** 裸机/套件 | `--deploy bare [--dir 路径]` | 裸机 / 群晖 / 套件安装，无 docker | 是（宿主机） |
| **proxy** 反向代理 | `--deploy proxy` | 不想动 Emby 文件，用 Nginx sub_filter | 否（生成 Nginx 片段） |
| **userscript** 油猴 | `--deploy userscript` | 没有宿主机权限，只想本地美化 | 否（生成油猴脚本） |

```bash
bash install.sh --deploy bare --dir /opt/emby-server/system/dashboard-ui   # 裸机指定目录
bash install.sh --deploy proxy        # 生成 nginx-emby-aurora.conf + 说明
bash install.sh --deploy userscript   # 生成 aurora.user.js（Tampermonkey）
```

---

## 🔗 第三方集成（Emby-Javascript-Details）

EmbyAurora 通过 `--details` 参数一键集成社区优秀项目
[Emby-Javascript-Details](https://github.com/XingyiHua2024/Emby-Javascript-Details)（作者 XingyiHua2024）：

| 能力 | 说明 |
|---|---|
| 🖼️ 高清剧照 | 详情页 fanart 剧照展示，支持排序 |
| 👥 演员/导演作品 | 展示相关作品 |
| 🎬 预告片增强 | 列表页悬停播放 + 源信息显示 |
| 🔤 标题/简介翻译 | OpenAI / Google 翻译（可选） |
| 🔞 Javdb 集成 | JavDB 刮削 / 短评（可选） |

**合规说明**：该项目未附带 LICENSE，EmbyAurora 采用**引用式集成**——安装时从原作者仓库实时下载脚本（保留原出处与署名），不将第三方代码复制进本仓库。安装后第三方脚本位于容器 `dashboard-ui/` 根目录，配置项（`openaiApiKey` 等）见其 `config.json`。

---

## 📂 目录结构

```
emby-aurora/
├── install.sh             # 一键安装（主入口，4 种部署方式）
├── uninstall.sh           # 卸载
├── online-install.sh      # curl | bash 在线入口
├── lib/
│   ├── common.sh          # 公共函数（docker/bare 双后端：注入/备份/持久化）
│   ├── detect.sh          # 环境检测（容器/裸机目录/镜像/版本）
│   ├── details.sh         # 第三方集成（Emby-Javascript-Details）
│   └── alt-deploy.sh      # 反代注入 / 油猴脚本生成
├── config/
│   └── aurora.config.json # 个性化配置模板
├── assets/                # 注入到 dashboard-ui/aurora/
│   ├── bootstrap.js       # 核心加载器（含加载页，零依赖）
│   ├── aurora.css         # 极光设计系统 token + 基础美化
│   ├── logo/logo.svg      # 默认 Logo
│   ├── themes/            # 4 套主题（aurora/ice/nebula/cinema）
│   ├── carousel/          # 首页轮播（极光玻璃信息条）
│   └── features/          # 功能增强模块
└── docs/                  # 设计文档 + 配置说明
```

---

## 🛠️ 技术原理

1. **部署后端抽象**：`DEPLOY_MODE` 在 docker / bare 间切换，同一套注入逻辑适配容器与宿主机文件系统。
2. **环境检测**：自动识别容器 / 镜像类型（官方 / LinuxServer / 社区）/ Web 目录 / Emby 版本；裸机模式自动探测常见 `dashboard-ui` 路径。
3. **资源部署**：把 `assets/` 拷贝到 `dashboard-ui/aurora/` 目录（docker 用 `docker cp`，bare 用 `cp`）。
4. **单点注入**：在 `index.html` 的 `</head>` 前插入 `<script src="aurora/config.js">` + `<script src="aurora/bootstrap.js">`，marker 幂等防重复。
5. **加载页优先**：`bootstrap.js` 同步挂载加载页到 `documentElement`，在 Emby 渲染任何内容前即出现，杜绝白屏闪烁。
6. **API 驱动轮播**：`ApiClient.getItems()` 查最新影视 + `getImageUrl()` 取高清 Backdrop/Logo + `appRouter.showItem()` 跳详情（参考 emby-crx 成熟实现），数据完整、跨 4.8/4.9 稳定。
7. **极光设计系统**：`aurora.css` 定义完整 token（渐变/玻璃/光晕/描边），`themes/*.css` 覆盖变量实现 4 套主题；轮播采用原创「玻璃信息条」构图，不照搬 misty-banner。
8. **SPA 适配**：外部播放器 / 评分 / 弹幕等用 `setInterval` + `MutationObserver` 持续监听注入点，适配 Emby 单页异步渲染。
9. **持久化**：注入前自动备份 `index.html`；社区版镜像写入启动钩子，容器重建后 `--restore` 恢复。

---

## 📄 License

MIT
