<div align="center">

# 🎬 EmbyAurora

**让 Emby 变成属于你自己的影院。**

一个「一条命令部署、网页里点几下完成美化」的 Emby 前端美化方案。

[部署](#-快速开始) · [特性](#-特性) · [主题](#-四套主题) · [部署方式](#-部署方式) · [FAQ](#-常见问题)

</div>

---

## ✨ 为什么是 EmbyAurora

市面上的 Emby 美化方案普遍有个痛点：**要么装浏览器扩展（换设备就失效）、要么装油猴脚本（先装 Tampermonkey）、要么手改文件（门槛高、升级即废）**。

EmbyAurora 走的是 **服务端注入派**：直接往 Emby 的 `dashboard-ui` 注入资源，任何设备、任何浏览器打开就是美化后的样子，**零客户端依赖**。并且把「便捷」做到了极致：

| 阶段 | 体验 |
|---|---|
| **部署** | 一条 `curl \| bash`，自动识别 Emby 版本（4.7/4.8/4.9）与运行环境（Docker/裸机/反代），自动备份、自动回滚 |
| **使用** | 部署后在 Emby 页面里打开「🎨 设置中心」，换主题 / 调颜色 / 开关功能，实时生效、自动保存 |
| **升级** | 一条 `update.sh`，配置与主题自动保留 |

---

## ✨ 特性

- 🎨 **主题引擎** — 单一 CSS 变量接口，四套主题包一键切换，换主题不换结构
- 🖥️ **网页设置中心** — 部署后在页面内实时换主题、自定义颜色、开关渐变，零改代码
- 🖼️ **沉浸式首页轮播** — API 驱动，真正满屏 Backdrop，顶栏透明悬浮（Netflix 式），三种样式可选（沉浸满屏 / 玻璃信息条 / 极简），SPA 自适应
- 📋 **详情页增强** — 多平台评分（社区评分/影评人/IMDb/TMDB/TVDB 外链）、剧照墙、演职员、相关推荐
- ▶️ **外部播放器** — PotPlayer / VLC / mpv / IINA 直链调起（可选）
- 🐳 **四种部署方式** — Docker / 裸机 / 反向代理 / 油猴脚本，自动检测环境路由
- 🧩 **模块化开关** — 安装向导逐项选择功能，装你想要的

---

## 🚀 快速开始

### 一键部署（Docker 用户）

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/micimo13/emby-aurora/main/install.sh)
```

脚本会自动检测 Emby 容器、版本与 Web 目录，然后交互式询问要安装的功能（回车 = 推荐默认）。装完浏览器 `Ctrl+F5` 强制刷新即可看到效果。

### 指定部署方式

```bash
# 裸机 / 套件（直接改宿主机 dashboard-ui）
bash install.sh --deploy bare

# 反向代理（不改 Emby 文件，生成 Nginx 配置片段）
bash install.sh --deploy proxy

# 油猴脚本（Tampermonkey）
bash install.sh --deploy userscript
```

### 常用命令

```bash
bash install.sh --detect-only   # 只检测环境不安装
bash install.sh --restore       # 容器重建后恢复美化
bash install.sh --uninstall     # 卸载（保留备份，可回滚）
bash update.sh                  # 一键升级
```

---

## 🎨 四套主题

| 主题 | 气质 | 说明 |
|---|---|---|
| **影幕 · 黑金** | 庄重影院 | 深色 + 香槟金细线 + 衬线大标题（**默认**） |
| **雪白 · 极简** | 干净克制 | 浅灰白 + 大留白 + 大圆角，Apple 风 |
| **深空 · 玻璃** | 科技通透 | 深蓝黑 + 冰蓝主色 + 真·毛玻璃 |
| **画报 · 编辑** | 艺术前卫 | 暖纸白 + 粗黑标题 + 砖红点缀，杂志风 |

四套主题全部内置，部署后打开页面右下角「🎨」按钮即可随时切换，**不需要重新部署**。

---

## 📁 项目结构

```
emby-aurora/
├── install.sh              # 一键安装向导（主入口）
├── update.sh               # 一键升级
├── uninstall.sh            # 卸载
├── config/aurora.config.json   # 单一数据源配置
├── lib/
│   ├── common.sh           # 公共函数 + docker/bare 双后端 + 备份回滚
│   ├── detect.sh           # Emby 版本识别 + 环境检测
│   └── alt-deploy.sh       # 反代 / 油猴脚本生成
└── assets/
    ├── bootstrap.js        # 核心加载器（注入入口）
    ├── aurora.css          # 主题引擎 + 基础美化
    ├── settings.js         # 网页设置中心
    ├── themes/             # 四套主题包
    ├── carousel/           # 首页轮播
    ├── details/            # 详情页增强
    └── features/           # 可选功能（外部播放器/豆瓣/弹幕/倍速）
```

---

## ⚙️ 配置

部署后，个性化配置由 `config/aurora.config.json` 驱动，安装向导会自动生成副本。也可手动编辑后：

```bash
bash install.sh --config /path/to/your-config.json
```

常见配置项：

```json
{
  "theme": { "name": "cinema", "accent": "#c9a227" },
  "carousel": { "enabled": true, "style": "immersive", "interval": 8000 },
  "features": {
    "details": true,
    "extplayer": false,
    "douban": false
  }
}
```

> 评分默认读 Emby 元数据已有评分（零配置、无需 API key）；豆瓣评分/影评作为可选增强，安装时按需开启。

---

## ❓ 常见问题

**Q：部署后没变化？**
浏览器 `Ctrl+F5`（Windows）/ `Cmd+Shift+R`（Mac）强制刷新。若仍无变化，运行 `bash install.sh --detect-only` 确认注入是否成功。

**Q：容器重建后美化消失？**
运行 `bash install.sh --restore` 即可恢复（镜像若带 `ext.sh` 钩子会自动恢复）。

**Q：如何卸载？**
`bash install.sh --uninstall`。卸载前会自动备份 `index.html`，随时可回滚。

**Q：主题色不喜欢？**
打开页面右下角「🎨」设置中心，自定义色相/饱和度，或切换四套预设主题。

---

## ⚠️ 免责声明

本项目仅修改 Emby 前端展示层（`dashboard-ui` 静态资源与 `index.html` 注入），不修改任何后端代码与数据。请在操作前自行备份。因使用本项目造成的任何问题，请自行承担风险。

## 📄 License

[MIT](LICENSE)
