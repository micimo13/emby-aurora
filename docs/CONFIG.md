# EmbyAurora · 配置说明

所有个性化设置集中在 `config/aurora.config.json`。安装时由 `install.sh` 读取并写入容器的
`dashboard-ui/aurora/config.js`（即 `window.AURORA_CONFIG`）。修改后重跑 `bash install.sh --yes` 生效。

> 主题颜色、渐变开关等「运行时设置」无需改配置——部署后打开页面右下角「🎨」设置中心即可，改动自动保存在浏览器本地。

## 配置结构

```json
{
  "basePath": "aurora",
  "loading": {
    "enabled": true,
    "style": "aurora",
    "slogan": "EMBY · AURORA"
  },
  "theme": {
    "name": "cinema",
    "accent": "#c9a227"
  },
  "logo": {
    "type": "preset",
    "preset": "aurora",
    "imageUrl": "",
    "text": "AURORA",
    "color": "#ffffff",
    "fontSize": 34,
    "header": true,
    "keepText": false
  },
  "carousel": {
    "enabled": true,
    "style": "immersive",
    "interval": 8000,
    "maxCount": 10
  },
  "features": {
    "details": true,
    "extplayer": false,
    "douban": false,
    "danmaku": false,
    "speed": true,
    "fluent": false,
    "externalScheme": "potplayer"
  }
}
```

## 字段说明

### loading（预热加载页）

| 字段 | 取值 | 说明 |
|---|---|---|
| `enabled` | `true`/`false` | 是否启用加载页（全屏接管，替换 Emby 默认黑屏 logo 启动页） |
| `style` | `aurora` / `cinema` / `neon` / `spotlight` / `space` / `ink` | 极光光幕（默认）/ 影院倒计时 / 霓虹灯管 / 舞台聚光 / 深空跃迁 / 水墨晕染。每套都有独立构图与动效，非配色差异 |
| `slogan` | 文本 | 加载页标语 |
| `logo` | `aurora` / `emby` / `image` / `auto` | 加载页图标：AI 设计的极光图标 / Emby 原生图标 / 自定义图片 / 跟随顶栏 Logo |
| `logoUrl` | 图片 URL | `logo=image` 时的自定义图片地址 |

### theme（默认主题）

| 字段 | 取值 | 说明 |
|---|---|---|
| `name` | `cinema` / `snow` / `space` / `poster` | 默认主题（部署后可在设置中心切换） |
| `accent` | 颜色 | 主色覆盖（可选） |

### logo（顶栏 Logo）

| 字段 | 取值 | 说明 |
|---|---|---|
| `type` | `preset` / `image` / `text` | 预设扁平 Logo / 图片 URL / 文字 |
| `preset` | `aurora` / `emby` / `minimal` / `cinema` / `film` | 扁平 Logo 预设（`type=preset` 时生效） |
| `imageUrl` | URL | 自定义图片（`type=image` 时生效） |
| `text` / `color` | 文本 / 颜色 | 文字 Logo（`type=text` 时生效） |

> 部署后可在页面设置中心「Logo 预设」随时切换，实时生效。

### carousel（首页轮播）

| 字段 | 取值 | 说明 |
|---|---|---|
| `enabled` | `true`/`false` | 是否启用轮播 |
| `style` | `immersive` / `glass` / `minimal` | 沉浸满屏 / 玻璃信息条 / 极简 |
| `interval` | 毫秒 | 自动切换间隔 |
| `maxCount` | 数字 | 最多展示条数 |

### features（功能开关）

| 字段 | 默认 | 说明 |
|---|---|---|
| `details` | `true` | 详情页增强（多平台评分/剧照/演职员/同类·同演员推荐） |
| `extplayer` | `false` | 外部播放器按钮（点击弹出下拉菜单：PotPlayer/VLC/mpv/IINA/复制直链） |
| `douban` | `false` | 豆瓣评分/短评 |
| `danmaku` | `false` | 弹幕 |
| `speed` | `true` | 播放倍速记忆 |
| `fluent` | `false` | 旧 Fluent 布局（保留可选） |
| `externalScheme` | `potplayer`/`vlc`/`iina`/`mpv`/`copy` | 外部播放器**默认**协议（点按钮后仍可在页面内实时切换） |
