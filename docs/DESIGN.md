# EmbyAurora 设计文档

> 本文记录项目从调研到架构的完整设计决策，供后续迭代与协作参考。

## 1. 定位

面向自建媒体库（Docker / NAS）的 **Emby 前端美化工具箱**，核心诉求：

1. **一键脚本部署** —— 一行命令完成检测、部署、注入。
2. **好看的预热加载页** —— 进入首页先有全屏品牌动画，零闪烁。
3. **前端美化 / 魔改** —— 主题、毛玻璃、圆角、悬浮、滚动条等。
4. **Logo 替换** —— 顶栏与加载页统一品牌。
5. **丰富个性化** —— 配置驱动，所有功能可独立开关。

## 2. 技术路线选型

调研生态后，Emby 前端美化主要有四种注入方案：

| 方案 | 机制 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| **静态文件注入** | 拷贝资源到 `dashboard-ui/`，改 `index.html` 注入引用 | 零依赖、可控性强、最贴合自建场景 | 升级会覆盖，需持久化 | ✅ **采用** |
| CustomCssJS 插件 | 装 .dll 插件 + 后台管理面板 | 最正统、用户可自助改 | 依赖插件与 Emby 版本兼容 | 备选 |
| 反向代理注入 | nginx/caddy 层注入 | 不碰 Emby 文件 | 需自建反代 | 备选 |
| 浏览器扩展 | 用户侧装扩展 | 无需动服务端 | 需每用户安装 | 不采用 |

**结论**：采用「静态文件注入 + 持久化钩子」，这是 emby-crx（1.2k stars，即用户参考的「CRX 大佬」）与主流方案验证过的路径，也最贴合 Docker/NAS 自建场景。

## 3. 核心架构

```
install.sh ──► detect.sh（检测容器/镜像/目录/版本）
           ──► push assets/ ──► 容器 dashboard-ui/aurora/
           ──► gen config.js（window.AURORA_CONFIG）
           ──► inject index.html（单点注入 bootstrap.js）
```

**前端加载时序（关键设计）**：

```
index.html  </head> 前注入
   ├─ <script src="aurora/config.js">      → 定义 window.AURORA_CONFIG
   └─ <script src="aurora/bootstrap.js">   → 立即同步执行：
         1. 挂载加载页到 documentElement   ← Emby 渲染任何内容前即出现
         2. 异步注入主题 CSS（不阻塞加载页）
         3. 轮询等待 Emby 就绪（DOM 哨兵 + 10s 兜底）
         4. 就绪后：应用 Logo / 加载轮播与功能模块 / 淡出加载页
```

## 4. 与旧项目（Vanvy Emby Kit）对比

旧项目功能已很全面，但工程失控导致「bug 说不清」。本项目针对性重构：

| 维度 | 旧项目（Vanvy Kit） | 新项目（EmbyAurora） |
|---|---|---|
| 注入点 | 多行 link/script + 复杂 awk | **单一 script**（bootstrap.js） |
| 依赖 | jQuery 89KB + md5 | **零依赖原生 ES5** |
| 脚本 | 4 套 install 并存 + 2 个 common.sh | **1 个 install.sh** + 2 个 lib |
| 版本残留 | blackgold/showcase/v15/extension 并存 | 单一版本，无残留 |
| 仓库体积 | 40MB+（tar.gz 入库） | 纯文本，KB 级（.gitignore 阻断产物） |
| 加载页 | 与轮播抢渲染（"LOGO 过于优先"） | **同步挂载 documentElement，零闪烁** |
| 配置 | 分散多处 | **单一 config.json 驱动** |

## 5. 关键设计决策

1. **零依赖**：不引入 jQuery/md5，避免与 Emby 内置库冲突，也消除 89KB 冗余。
2. **单点注入**：`index.html` 只插一行，升级覆盖后恢复成本最低。
3. **加载页内嵌 bootstrap**：HTML/CSS/JS 全内嵌，无额外请求，保证首帧零闪烁。
4. **DOM 选择器兜底**：主题/Logo/轮播对 Emby 4.8/4.9 做多重选择器兜底，失效只降级不报错。
5. **配置驱动**：`config.js` 由 JSON 生成，用户改 JSON 重装即可，无需碰代码。
6. **防御式功能增强**：豆瓣/弹幕依赖外部源，失败静默降级，不影响 Emby 本体。

## 6. 路线图

- [x] 加载页（3 风格）+ 主题（2 款）+ Logo 替换 + 轮播 + 倍速/外部播放器/评分/弹幕/布局
- [ ] 更多主题（冰川蓝 / 樱花粉 / 石墨黑）
- [ ] 轮播内容策展（按评分/年份/库过滤，参考旧项目 carousel-rules）
- [ ] 配置可视化向导（交互式选主题/Logo/加载页）
- [ ] 移动端 / TV 端适配优化
