# EmbyAurora 配置说明

所有个性化设置集中在 `config/aurora.config.json`。安装时由 `install.sh` 读取并写入容器
`dashboard-ui/aurora/config.js`（即 `window.AURORA_CONFIG`）。修改后重跑 `bash install.sh` 生效。

## 完整配置项

```json
{
  "basePath": "aurora",

  "loading": {
    "enabled": true,
    "style": "aurora",
    "slogan": "EMBY · AURORA",
    "aurora": { "blob1": "#6d5dfc", "blob2": "#22d3ee", "blob3": "#f472b6" }
  },

  "theme": { "name": "aurora", "accent": "#6d5dfc" },

  "logo": {
    "type": "image",
    "imageUrl": "",
    "text": "AURORA",
    "color": "#ffffff",
    "fontSize": 34,
    "header": true,
    "keepText": false
  },

  "carousel": { "enabled": true, "interval": 8000, "maxCount": 8 },

  "features": {
    "danmaku": false,
    "douban": false,
    "speed": true,
    "extplayer": false,
    "fluent": true,
    "ratingSource": "bangumi",
    "doubanApi": "",
    "danmakuApi": "",
    "externalScheme": "potplayer",
    "danmakuSpeed": 9
  }
}
```

## 逐项说明

### loading（预热加载页）

| 字段 | 取值 | 说明 |
|---|---|---|
| `enabled` | `true` / `false` | 是否启用加载页 |
| `style` | `aurora` / `cinema` / `minimal` | 加载页风格：极光 / 影院黑金 / 极简 |
| `slogan` | 字符串 | 加载页副标语 |
| `aurora.blob1~3` | 颜色 | 极光风格的三个光斑颜色 |

### theme（主题）

| 字段 | 取值 | 说明 |
|---|---|---|
| `name` | `aurora` / `cinema` / `default` | 主题配色，`default` 为仅基础美化不套配色 |
| `accent` | 颜色 | 顶栏品牌强调色（覆盖默认） |

### logo（Logo 替换）

| 字段 | 取值 | 说明 |
|---|---|---|
| `type` | `image` / `text` | `image` 用图片，`text` 用文字生成 SVG |
| `imageUrl` | URL / 相对路径 | 自定义图片地址（`type=image` 时） |
| `text` | 字符串 | 文字 Logo 内容（`type=text` 时） |
| `color` / `fontSize` | — | 文字 Logo 颜色 / 字号 |
| `header` | `true` / `false` | 是否替换顶栏 Logo |
| `keepText` | `true` / `false` | 是否保留 Emby 原文字（`false` 隐藏原文字） |

> 图片 Logo 默认使用 `aurora/logo/logo.svg`，可直接替换该文件，或通过 `imageUrl` 指向外部图片。

### carousel（首页轮播）

| 字段 | 取值 | 说明 |
|---|---|---|
| `enabled` | `true` / `false` | 是否启用 |
| `interval` | 毫秒 | 自动轮播间隔（默认 8000） |
| `maxCount` | 数字 | 最多展示张数 |

### features（功能增强）

| 字段 | 取值 | 说明 |
|---|---|---|
| `danmaku` | `true` / `false` | 弹幕（需配置 `danmakuApi`） |
| `douban` | `true` / `false` | 豆瓣 / Bangumi 评分 |
| `speed` | `true` / `false` | 播放倍速记忆 |
| `extplayer` | `true` / `false` | 外部播放器按钮 |
| `fluent` | `true` / `false` | Fluent 布局（纯 CSS） |
| `ratingSource` | `bangumi` / `douban` | 评分数据源 |
| `doubanApi` | URL | 自建豆瓣代理（豆瓣无公开稳定 API，需代理） |
| `danmakuApi` | URL | 自建弹幕源：`GET {api}?title=xxx&episode=1` → `{comments:[{t,text,color}]}` |
| `externalScheme` | `potplayer` / `vlc` / `iina` / `copy` | 外部播放器协议 / 复制直链 |
| `danmakuSpeed` | 秒 | 弹幕滚动时长基准 |

> ⚠️ `douban` 与 `danmaku` 依赖外部数据源，国内环境建议自建代理后填入 `doubanApi` / `danmakuApi`，失败时静默降级不影响 Emby 使用。
