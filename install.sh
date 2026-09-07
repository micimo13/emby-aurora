#!/usr/bin/env bash
# =============================================================================
#  EmbyAurora · install.sh — 一键安装脚本（主入口）
# =============================================================================
#  用法：
#    bash install.sh                          # 交互式安装（选部署方式 + 选功能）
#    bash install.sh --container emby         # 指定容器
#    bash install.sh --deploy bare            # 部署方式：docker|bare|proxy|userscript
#    bash install.sh --deploy bare --dir /path/to/dashboard-ui   # 裸机指定目录
#    bash install.sh --yes                    # 免确认（docker + 默认配置）
#    bash install.sh --config my.json         # 指定个性化配置
#    bash install.sh --detect-only            # 只检测环境不安装
#    bash install.sh --restore                # 容器重建后恢复美化
#    bash install.sh --uninstall              # 卸载美化
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------------------------------------------------------------------------
# 在线安装兜底：通过 `bash <(curl ...)` 执行时，BASH_SOURCE 是 /dev/fd/N，
# SCRIPT_DIR 会被解析成 /dev/fd，找不到 lib/common.sh。此时自动下载完整仓库
# 到临时目录后重新执行，保证「一条命令」即可安装。
# ---------------------------------------------------------------------------
if [ ! -f "$SCRIPT_DIR/lib/common.sh" ]; then
  printf '\033[1;36m[信息]\033[0m 检测到在线安装，正在下载完整项目 ...\n'
  TMP="$(mktemp -d)"
  if command -v git >/dev/null 2>&1; then
    git clone --depth 1 https://github.com/micimo13/emby-aurora.git "$TMP" >/dev/null 2>&1
  else
    curl -fsSL https://github.com/micimo13/emby-aurora/archive/refs/heads/main.tar.gz \
      | tar -xz -C "$TMP" --strip-components=1
  fi
  if [ ! -f "$TMP/install.sh" ]; then
    printf '\033[1;31m[错误]\033[0m 下载失败，请检查网络后重试\n'
    exit 1
  fi
  exec bash "$TMP/install.sh" "$@"
  exit 0
fi

source "$SCRIPT_DIR/lib/common.sh"
source "$SCRIPT_DIR/lib/detect.sh"
source "$SCRIPT_DIR/lib/alt-deploy.sh"

# ---- 参数解析 ----
CONTAINER=""
CONFIG_FILE="$SCRIPT_DIR/config/aurora.config.json"
YES=0
MODE="install"        # install | detect | restore | uninstall
DEPLOY="docker"       # docker | bare | proxy | userscript
BARE_DIR=""

while [ $# -gt 0 ]; do
  case "$1" in
    --container)  CONTAINER="$2"; shift 2 ;;
    --config)     CONFIG_FILE="$2"; shift 2 ;;
    --yes|-y)     YES=1; shift ;;
    --deploy)     DEPLOY="$2"; shift 2 ;;
    --dir)        BARE_DIR="$2"; shift 2 ;;
    --detect-only) MODE="detect"; shift ;;
    --restore)    MODE="restore"; shift ;;
    --uninstall)  MODE="uninstall"; shift ;;
    *)            echo "未知参数: $1"; exit 1 ;;
  esac
done

case "$DEPLOY" in
  docker|bare|proxy|userscript) ;;
  *) echo "无效部署方式: $DEPLOY（可选 docker|bare|proxy|userscript）"; exit 1 ;;
esac

# bare 模式 → 后端切换为宿主机文件系统
if [ "$DEPLOY" = "bare" ]; then DEPLOY_MODE="bare"; fi

banner() {
  printf "${C_INFO}"
  cat <<'EOF'

   ╔══════════════════════════════════════════════════════╗
   ║   🎨  EmbyAurora · Emby 前端美化工具箱（极光设计系统）║
   ║   预热加载页 · 主题 · Logo 替换 · 首页轮播 · 功能增强  ║
   ╚══════════════════════════════════════════════════════╝
EOF
  printf "${C_OFF}\n"
}

# 完整部署：资源拷贝 + 配置生成 + 幂等注入 + 持久化钩子 +（可选）第三方集成
# docker / bare 共用此路径——DEPLOY_MODE 决定执行后端。
deploy() {
  c_info "部署前端资源 ..."
  push_dir "$SCRIPT_DIR/assets" "$DASHBOARD_DIR/aurora"

  c_info "写入个性化配置 ..."
  gen_config_js "$CONFIG_FILE" "$DASHBOARD_DIR/aurora/config.js"

  c_info "注入 index.html ..."
  inject_index

  install_ext_hook
}

# 交互式选择部署方式
choose_deploy() {
  echo ""
  c_info "══════════ 选择部署方式（回车 = docker）══════════"
  echo "  1) docker      容器注入（docker cp + 改 index.html，跨设备，默认）"
  echo "  2) bare        裸机/套件注入（直接改宿主机 dashboard-ui，无需 docker）"
  echo "  3) proxy       反向代理注入（不改 Emby 文件，生成 Nginx 配置片段）"
  echo "  4) userscript  油猴脚本（Tampermonkey，资源从 GitHub 加载，零服务端改动）"
  c_ask "选择 [1-4, 默认 1]: "
  local sel=""; read_input sel "1"
  case "$sel" in
    2) DEPLOY="bare"; DEPLOY_MODE="bare" ;;
    3) DEPLOY="proxy" ;;
    4) DEPLOY="userscript" ;;
    *) DEPLOY="docker" ;;
  esac
  echo ""
}

# 交互式选择要安装的功能（非 --yes 时调用）。
# 把 config.json 复制为临时副本，按用户选择覆盖开关，随后 CONFIG_FILE 指向该副本。
choose_features() {
  local tmp="/tmp/aurora-config-custom.json"
  cp "$CONFIG_FILE" "$tmp"
  CONFIG_FILE="$tmp"
  local ans

  echo ""
  c_info "══════════ 选择要安装的功能（回车 = 默认）══════════"

  c_ask "① 预热加载页（进入首页的全屏品牌动画）？[Y/n]: "; read_input ans "y"
  { [ "$ans" = "n" ] || [ "$ans" = "N" ]; } && set_block_bool loading enabled false "$CONFIG_FILE"

  c_ask "② 首页轮播大屏？[Y/n]: "; read_input ans "y"
  if [ "$ans" = "n" ] || [ "$ans" = "N" ]; then
    set_block_bool carousel enabled false "$CONFIG_FILE"
  else
    echo "   轮播样式："
    echo "   1) immersive 沉浸满屏（大图 + 左下角标题/简介/按钮，默认）"
    echo "   2) glass     玻璃信息条（底部整宽半透明玻璃条）"
    echo "   3) minimal   极简（仅大标题，无简介按钮）"
    c_ask "选择 [1-3, 默认 1]: "; read_input ans "1"
    case "$ans" in
      2) set_block_str carousel style "glass" "$CONFIG_FILE" ;;
      3) set_block_str carousel style "minimal" "$CONFIG_FILE" ;;
      *) set_block_str carousel style "immersive" "$CONFIG_FILE" ;;
    esac
  fi

  echo ""
  c_info "③ 选择主题："
  echo "   1) cinema 影幕 · 黑金（默认，影院质感）"
  echo "   2) snow   雪白 · 极简（明亮）"
  echo "   3) space  深空 · 玻璃（科技蓝紫）"
  echo "   4) poster 画报 · 编辑（杂志排版）"
  c_ask "选择 [1-4, 默认 1]: "; read_input ans "1"
  case "$ans" in
    2) set_block_str theme name "snow" "$CONFIG_FILE" ;;
    3) set_block_str theme name "space" "$CONFIG_FILE" ;;
    4) set_block_str theme name "poster" "$CONFIG_FILE" ;;
    *) set_block_str theme name "cinema" "$CONFIG_FILE" ;;
  esac

  c_ask "④ 替换顶栏 Logo？[Y/n]: "; read_input ans "y"
  if [ "$ans" = "n" ] || [ "$ans" = "N" ]; then
    set_block_bool logo header false "$CONFIG_FILE"
  else
    echo "   Logo 预设（扁平 Logo，部署后可在页面设置中心随时换）："
    echo "   1) aurora   极光渐变（默认）"
    echo "   2) emby     Emby 绿"
    echo "   3) minimal  极简白字"
    echo "   4) cinema   影院金字"
    echo "   5) film     胶片场记板"
    echo "   6) 自定义图片 URL"
    echo "   7) 自定义文字"
    c_ask "选择 [1-7, 默认 1]: "; read_input ltype "1"
    case "$ltype" in
      2) set_block_str logo type "preset" "$CONFIG_FILE"; set_block_str logo preset "emby" "$CONFIG_FILE" ;;
      3) set_block_str logo type "preset" "$CONFIG_FILE"; set_block_str logo preset "minimal" "$CONFIG_FILE" ;;
      4) set_block_str logo type "preset" "$CONFIG_FILE"; set_block_str logo preset "cinema" "$CONFIG_FILE" ;;
      5) set_block_str logo type "preset" "$CONFIG_FILE"; set_block_str logo preset "film" "$CONFIG_FILE" ;;
      6)
        set_block_str logo type "image" "$CONFIG_FILE"
        c_ask "   图片 URL（如 https://example.com/logo.png）: "; read_input lurl ""
        if [ -n "$lurl" ]; then set_block_str logo imageUrl "$lurl" "$CONFIG_FILE"; fi
        ;;
      7)
        set_block_str logo type "text" "$CONFIG_FILE"
        c_ask "   文字内容（如 MY NAS）: "; read_input ltext "AURORA"
        set_block_str logo text "$ltext" "$CONFIG_FILE"
        c_ask "   文字颜色（如 #d4af37，回车=白色）: "; read_input lcolor "#ffffff"
        set_block_str logo color "$lcolor" "$CONFIG_FILE"
        ;;
      *) set_block_str logo type "preset" "$CONFIG_FILE"; set_block_str logo preset "aurora" "$CONFIG_FILE" ;;
    esac
  fi

  c_ask "⑤ 播放倍速记忆（Ctrl/Cmd+↑/↓ 调速）？[Y/n]: "; read_input ans "y"
  { [ "$ans" = "n" ] || [ "$ans" = "N" ]; } && set_block_bool features speed false "$CONFIG_FILE"

  c_ask "⑥ Fluent 布局（侧边栏浮层 + 顶栏沉浸）？[Y/n]: "; read_input ans "y"
  { [ "$ans" = "n" ] || [ "$ans" = "N" ]; } && set_block_bool features fluent false "$CONFIG_FILE"

  c_ask "⑦ 外部播放器按钮（下拉菜单可选 PotPlayer/VLC/IINA/MPV/复制直链）？[y/N]: "; read_input ans "n"
  if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
    set_block_bool features extplayer true "$CONFIG_FILE"
    echo "   默认播放器（部署后点按钮仍可在页面内实时切换）："
    echo "   1) PotPlayer（默认）  2) VLC  3) IINA  4) MPV  5) 复制直链"
    c_ask "选择 [1-5, 默认 1]: "; read_input ext "1"
    case "$ext" in
      2) set_block_str features externalScheme "vlc" "$CONFIG_FILE" ;;
      3) set_block_str features externalScheme "iina" "$CONFIG_FILE" ;;
      4) set_block_str features externalScheme "mpv" "$CONFIG_FILE" ;;
      5) set_block_str features externalScheme "copy" "$CONFIG_FILE" ;;
      *) set_block_str features externalScheme "potplayer" "$CONFIG_FILE" ;;
    esac
  fi

  c_ask "⑧ 豆瓣 / Bangumi 评分徽章？[y/N]: "; read_input ans "n"
  { [ "$ans" = "y" ] || [ "$ans" = "Y" ]; } && set_block_bool features douban true "$CONFIG_FILE"

  c_ask "⑨ 弹幕（需自建弹幕源）？[y/N]: "; read_input ans "n"
  { [ "$ans" = "y" ] || [ "$ans" = "Y" ]; } && set_block_bool features danmaku true "$CONFIG_FILE"

  c_ask "⑩ 详情页增强（评分徽章 / 剧照墙 / 演职员 / 相关推荐）？[Y/n]: "; read_input ans "y"
  { [ "$ans" = "n" ] || [ "$ans" = "N" ]; } && set_block_bool features details false "$CONFIG_FILE"

  echo ""
  c_info "已按选择生成配置，开始部署 ..."
}

# ---- 各模式 ----
case "$MODE" in
  detect)
    banner
    run_health_check
    exit 0
    ;;

  restore)
    banner
    run_health_check || exit 1
    if [ "$YES" != "1" ]; then confirm "恢复 EmbyAurora 美化（重新部署资源并注入）？" || exit 0; fi
    deploy
    c_ok "✓ 恢复完成（资源与注入已重新部署）"
    exit 0
    ;;

  uninstall)
    banner
    run_health_check || exit 1
    if [ "$YES" != "1" ]; then confirm "确认卸载 EmbyAurora 美化？" || exit 0; fi
    backup_index
    uninject_index
    if [ "$DEPLOY_MODE" = "bare" ]; then
      rm -rf "$DASHBOARD_DIR/aurora"
    else
      docker exec "$CONTAINER" sh -c "rm -rf '$DASHBOARD_DIR/aurora'" 2>/dev/null
    fi
    c_ok "✓ 已卸载（index.html 注入已移除，aurora/ 目录已删除，备份已保留）"
    exit 0
    ;;

  install)
    banner
    if [ "$YES" != "1" ]; then
      choose_deploy
    fi

    # 反向代理 / 油猴：不改 Emby 文件，只生成部署产物
    case "$DEPLOY" in
      proxy)
        gen_proxy
        c_ok "════════════════════════════════════"
        c_ok "  ✅ 反向代理配置已生成到 aurora-deploy/"
        c_ok "  按 nginx-emby-aurora.conf 注释合并进 server {} 块"
        c_ok "════════════════════════════════════"
        exit 0
        ;;
      userscript)
        gen_userscript
        c_ok "════════════════════════════════════"
        c_ok "  ✅ 油猴脚本已生成到 aurora-deploy/aurora.user.js"
        c_ok "  用 Tampermonkey 导入，把 @match 改成你的 Emby 域名"
        c_ok "════════════════════════════════════"
        exit 0
        ;;
    esac

    # docker / bare：健康检查 + 部署
    run_health_check || exit 1
    if [ "$YES" != "1" ]; then
      confirm "开始安装 EmbyAurora？" || exit 0
      choose_features
    fi

    deploy

    c_ok "════════════════════════════════════"
    c_ok "  ✅ EmbyAurora 安装完成！"
    c_ok "  浏览器 Ctrl+F5 / Cmd+Shift+R 强制刷新即可看到效果"
    if [ "$DEPLOY_MODE" = "bare" ]; then
      c_ok "  裸机安装，无需重启容器"
    else
      c_ok "  容器重建后运行: bash install.sh --restore 恢复"
    fi
    c_ok "  改配置重装: bash install.sh --yes 或 --config 自定义"
    c_ok "════════════════════════════════════"
    ;;
esac
