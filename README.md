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

- 🌌 **预热加载页**：进入首页先展示全屏品牌过渡动画（3 种风格：极光 / 影院黑金 / 极简），零闪烁、零依赖
- 🎠 **首页轮播**：沉浸式大图轮播 + 信息卡 + 播放/详情按钮，自动轮播 + 箭头 + 指示点
- 🎨 **主题美化**：极光蓝紫 / 影院黑金双主题，毛玻璃 + 圆角 + 悬浮发光，CSS 变量驱动
- 🔤 **Logo 替换**：顶栏 + 加载页统一替换为你的品牌 Logo（图片 / 文字两种模式）
- ⚡ **功能增强**：播放倍速记忆 / 外部播放器 / 豆瓣评分 / 弹幕 / Fluent 布局，全部可独立开关

> 💡 核心设计：**单一注入点**（`index.html` 只插一行 `<script>`）+ **配置驱动**（一个 JSON 管所有个性化）。架构清爽，绝无历史包袱。

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
```

安装完成后浏览器 **Ctrl+F5 / Cmd+Shift+R** 强制刷新即可看到效果 ✨

### 本地安装

```bash
git clone https://github.com/micimo13/emby-aurora.git
cd emby-aurora
bash install.sh                 # 交互式安装
bash install.sh --yes           # 免确认
bash install.sh --detect-only   # 只检测环境
bash install.sh --restore       # 容器重建后恢复
bash uninstall.sh               # 卸载
```

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
| 🎠 轮播 | 沉浸式首页轮播 | 复用首页数据，零 API 依赖，自动轮播 + 导航 |
| 🎨 主题 | 极光 / 影院黑金 | 毛玻璃 + 圆角 + 悬浮发光，CSS 变量可深度定制 |
| 🔤 Logo | 顶栏 + 加载页替换 | 图片 / 文字双模式 |
| ⚡ 增强 | 倍速记忆 | Ctrl+↑/↓ 调速，刷新/重启恢复 |
| ⚡ 增强 | 外部播放器 | PotPlayer/VLC/IINA/复制直链 |
| ⚡ 增强 | 豆瓣 / Bangumi 评分 | 详情页评分徽章 |
| ⚡ 增强 | 弹幕 | 弹幕渲染引擎 + 可配置数据源 |
| ⚡ 增强 | Fluent 布局 | 侧边栏浮层 + 顶栏沉浸 + 卡片间距 |

---

## 📂 目录结构

```
emby-aurora/
├── install.sh             # 一键安装（主入口）
├── uninstall.sh           # 卸载
├── online-install.sh      # curl | bash 在线入口
├── lib/
│   ├── common.sh          # 公共函数（注入/备份/持久化）
│   └── detect.sh          # 环境检测（容器/镜像/目录/版本）
├── config/
│   └── aurora.config.json # 个性化配置模板
├── assets/                # 注入到 dashboard-ui/aurora/
│   ├── bootstrap.js       # 核心加载器（含加载页，零依赖）
│   ├── aurora.css         # 主题变量 + 基础美化
│   ├── logo/logo.svg      # 默认 Logo
│   ├── themes/            # 主题配色
│   ├── carousel/          # 首页轮播
│   └── features/          # 功能增强模块
└── docs/                  # 设计文档 + 配置说明
```

---

## 🛠️ 技术原理

1. **环境检测**：自动识别容器 / 镜像类型（官方 / LinuxServer / 社区）/ Web 目录 / Emby 版本。
2. **资源部署**：把 `assets/` 拷贝到容器的 `dashboard-ui/aurora/` 目录。
3. **单点注入**：在 `index.html` 的 `</head>` 前插入一行 `<script src="aurora/config.js">` + `<script src="aurora/bootstrap.js">`，用 marker 幂等防重复。
4. **加载页优先**：`bootstrap.js` 同步挂载加载页到 `documentElement`，在 Emby 渲染任何内容前即出现，杜绝白屏闪烁。
5. **持久化**：每次注入前自动备份 `index.html` 到 `/config/backups/aurora/`；社区版镜像写入启动钩子，容器重建自动恢复。

---

## 📄 License

MIT
