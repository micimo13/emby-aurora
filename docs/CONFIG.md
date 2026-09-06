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
    "style": "cinema",
    "slogan": "EMBY · AURORA"
  },
  "theme": {
    "name": "cinema",
    "accent": "#c9a227"
  },
  "logo": {
    "type": "image",
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
| `enabled` | `true`/`false` | 是否启用加载页 |
| `style` | `cinema` / `minimal` | 影院黑金 / 极简 |
| `slogan` | 文本 | 加载页标语 |

### theme（默认主题）

| 字段 | 取值 | 说明 |
|---|---|---|
| `name` | `cinema` / `snow` / `space` / `poster` | 默认主题（部署后可在设置中心切换） |
| `accent` | 颜色 | 主色覆盖（可选） |

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
| `details` | `true` | 详情页增强（多平台评分/剧照/演职员/相关推荐） |
| `extplayer` | `false` | 外部播放器按钮（PotPlayer/VLC/mpv/IINA） |
| `douban` | `false` | 豆瓣评分/短评 |
| `danmaku` | `false` | 弹幕 |
| `speed` | `true` | 播放倍速记忆 |
| `fluent` | `false` | 旧 Fluent 布局（保留可选） |
| `externalScheme` | `potplayer`/`vlc`/`iina`/`mpv`/`copy` | 外部播放器协议 |
