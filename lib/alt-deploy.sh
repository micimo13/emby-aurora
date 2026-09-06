#!/usr/bin/env bash
# =============================================================================
#  EmbyAurora · lib/alt-deploy.sh
#  两种「不改动 Emby 文件」的部署产物生成：
#    · gen_proxy      反向代理注入（Nginx sub_filter + 静态托管）
#    · gen_userscript 油猴脚本（Tampermonkey，资源从 GitHub 加载）
# =============================================================================

OUT_DIR="$(pwd)/aurora-deploy"

# 生成反向代理注入配置（Nginx 完整可用 + Caddy/Traefik 提示）
gen_proxy() {
  mkdir -p "$OUT_DIR"
  local nginx="$OUT_DIR/nginx-emby-aurora.conf"

  cat > "$nginx" <<'NGINX'
# ═══════════════════════════════════════════════════════════════════════
#  EmbyAurora · Nginx 反向代理注入片段
#  原理：不修改 Emby 任何文件，在反代层用 sub_filter 向返回的 HTML
#        注入 <script>，并额外托管 /aurora/ 静态资源。
#  用法：
#    1. 把 EmbyAurora 的 assets/ 目录拷贝到固定路径，例如 /srv/emby-aurora/
#    2. 把下面的内容合并进你 Emby 站点的 server { } 块
#    3. 把 <EMBY_HOST> 替换成你的 Emby 地址（127.0.0.1:8096 或容器 IP）
#    4. nginx -t && nginx -s reload
#  依赖：nginx 需编译 ngx_http_sub_module（官方/多数发行版默认自带）
# ═══════════════════════════════════════════════════════════════════════

# —— 静态资源托管（/aurora/ 指向 assets 目录）——
location /aurora/ {
    alias /srv/emby-aurora/;
    expires 7d;
}

# —— 反向代理 Emby + 注入脚本 ——
location / {
    proxy_pass http://<EMBY_HOST>;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_http_version 1.1;

    sub_filter '</head>' '<script src="/aurora/config.js"></script><script src="/aurora/bootstrap.js"></script></head>';
    sub_filter_once on;
    sub_filter_types text/html;
}
NGINX

  cat > "$OUT_DIR/README-proxy.md" <<'MD'
# EmbyAurora 反向代理部署说明

## Nginx（推荐，sub_filter 原生支持）
直接使用同目录的 `nginx-emby-aurora.conf`，按注释合并进你的 `server {}` 块即可。
注意把 `assets/` 拷贝到 `/srv/emby-aurora/`（或自行调整 alias 路径）。

## Caddy
Caddy 2 的响应体替换需要编译进 `http.filter` 插件（非默认模块）。
若你的 Caddy 已带 filter 插件，等价写法：
```
route /aurora/* {
    root * /srv/emby-aurora
    file_server
}
route /* {
    reverse_proxy <EMBY_HOST>
    filter {
        search_pattern </head>
        replacement <script src="/aurora/config.js"></script><script src="/aurora/bootstrap.js"></script></head>
    }
}
```
若没有 filter 插件，建议改用 Nginx，或直接使用「裸机注入」方式。

## Traefik
Traefik 需借助 plugin（如 rewrite-body）做响应体替换，配置复杂。
建议改用 Nginx，或直接使用「裸机注入」方式。
MD

  c_ok "✓ 已生成反向代理配置：$OUT_DIR/"
  ls -1 "$OUT_DIR"
}

# 生成油猴脚本（资源从 GitHub 加载，零服务端改动）
gen_userscript() {
  mkdir -p "$OUT_DIR"
  local us="$OUT_DIR/aurora.user.js"

  # 读取 config.json，把 basePath 指向 GitHub raw 的 assets 目录
  local cfg='{}'
  [ -f "$CONFIG_FILE" ] && cfg="$(cat "$CONFIG_FILE")"

  cat > "$us" <<'USJS'
// ==UserScript==
// @name         EmbyAurora
// @namespace    https://github.com/micimo13/emby-aurora
// @version      1.0.0
// @description  极光设计系统 · 首页轮播 · 主题 · 功能增强（Emby 前端美化）
// @author       micimo13
// @match        http://*/web/index.html*
// @match        https://*/web/index.html*
// @grant        none
// @run-at       document-start
// ==/UserScript==

// 使用说明：
//   1. 安装 Tampermonkey 浏览器扩展
//   2. 导入本脚本，把 @match 里的通配改成你的 Emby 域名（例如 https://emby.example.com/web/*）
//   3. 刷新 Emby 页面即可生效（资源从 GitHub 加载，首次访问稍慢）
(function () {
  'use strict';
  window.AURORA_CONFIG = __AURORA_CONFIG__;
  var s = document.createElement('script');
  s.src = '__AURORA_BASE__/bootstrap.js';
  s.onerror = function () {
    console.error('[EmbyAurora] 资源加载失败，请检查网络能否访问 GitHub raw。');
  };
  (document.head || document.documentElement).appendChild(s);
})();
USJS

  # 注入 basePath 与 config
  local base="https://raw.githubusercontent.com/micimo13/emby-aurora/main/assets"
  local with_base
  with_base=$(printf '%s' "$cfg" | sed -E 's#("basePath"[[:space:]]*:[[:space:]]*)"[^"]*"#\1"'"$base"'"#')
  # 若配置里没有 basePath，则补一个
  if ! printf '%s' "$with_base" | grep -q '"basePath"'; then
    with_base=$(printf '%s' "$with_base" | sed -E 's#^\{#{"basePath":"'"$base"'",#')
  fi
  sed -i "s#__AURORA_CONFIG__#$(printf '%s' "$with_base" | sed 's/[&/\]/\\&/g')#" "$us"
  sed -i "s#__AURORA_BASE__#$base#g" "$us"

  c_ok "✓ 已生成油猴脚本：$us"
  c_info "用 Tampermonkey 导入后，把 @match 改成你的 Emby 域名即可"
}

# 生成全部「不改文件」的部署产物（proxy + userscript）
gen_alt_deploy() {
  gen_proxy
  gen_userscript
}
