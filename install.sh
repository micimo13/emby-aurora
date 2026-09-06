#!/usr/bin/env bash
# =============================================================================
#  EmbyAurora · install.sh — 一键安装脚本（主入口）
# =============================================================================
#  用法：
#    bash install.sh                        # 交互式安装（自动检测容器）
#    bash install.sh --container emby       # 指定容器
#    bash install.sh --yes                  # 免确认
#    bash install.sh --config my.json       # 指定个性化配置
#    bash install.sh --detect-only          # 只检测环境不安装
#    bash install.sh --restore              # 容器重建后恢复美化
#    bash install.sh --uninstall            # 卸载美化
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
source "$SCRIPT_DIR/lib/detect.sh"
source "$SCRIPT_DIR/lib/details.sh"

# ---- 参数解析 ----
CONTAINER=""
CONFIG_FILE="$SCRIPT_DIR/config/aurora.config.json"
YES=0
DETAILS=0
MODE="install"   # install | detect | restore | uninstall

while [ $# -gt 0 ]; do
  case "$1" in
    --container)  CONTAINER="$2"; shift 2 ;;
    --config)     CONFIG_FILE="$2"; shift 2 ;;
    --yes|-y)     YES=1; shift ;;
    --details)    DETAILS=1; shift ;;
    --detect-only) MODE="detect"; shift ;;
    --restore)    MODE="restore"; shift ;;
    --uninstall)  MODE="uninstall"; shift ;;
    *)            echo "未知参数: $1"; exit 1 ;;
  esac
done

banner() {
  printf "${C_INFO}"
  cat <<'EOF'

   ╔══════════════════════════════════════════╗
   ║   🎨  EmbyAurora · Emby 前端美化工具箱    ║
   ║   预热加载页 · 主题 · Logo 替换 · 轮播    ║
   ╚══════════════════════════════════════════╝
EOF
  printf "${C_OFF}\n"
}

# 完整部署：资源拷贝 + 配置生成 + 幂等注入 + 持久化钩子 +（可选）第三方集成
# 安装与「容器重建后恢复」共用同一路径——重建会清空 writable 层，assets 与
# index.html 注入都会丢失，仅恢复 index.html 备份是不够的，必须完整重装。
deploy() {
  c_info "部署前端资源 ..."
  push_dir "$SCRIPT_DIR/assets" "$DASHBOARD_DIR/aurora"

  c_info "写入个性化配置 ..."
  gen_config_js "$CONFIG_FILE" "$DASHBOARD_DIR/aurora/config.js"

  c_info "注入 index.html ..."
  inject_index

  install_ext_hook

  if [ "$DETAILS" = "1" ]; then
    install_details
  fi
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

  c_ask "② 首页轮播大屏（沉浸式海报轮播）？[Y/n]: "; read_input ans "y"
  { [ "$ans" = "n" ] || [ "$ans" = "N" ]; } && set_block_bool carousel enabled false "$CONFIG_FILE"

  c_ask "③ 主题（aurora=极光蓝紫 / cinema=影院黑金 / default=仅基础美化）[aurora]: "; read_input ans "aurora"
  set_block_str theme name "$ans" "$CONFIG_FILE"

  c_ask "④ 替换顶栏 Logo？[Y/n]: "; read_input ans "y"
  { [ "$ans" = "n" ] || [ "$ans" = "N" ]; } && set_block_bool logo header false "$CONFIG_FILE"

  c_ask "⑤ 播放倍速记忆（Ctrl/Cmd+↑/↓ 调速）？[Y/n]: "; read_input ans "y"
  { [ "$ans" = "n" ] || [ "$ans" = "N" ]; } && set_block_bool features speed false "$CONFIG_FILE"

  c_ask "⑥ Fluent 布局（侧边栏浮层 + 顶栏沉浸）？[Y/n]: "; read_input ans "y"
  { [ "$ans" = "n" ] || [ "$ans" = "N" ]; } && set_block_bool features fluent false "$CONFIG_FILE"

  c_ask "⑦ 外部播放器按钮（PotPlayer/VLC/IINA/MPV/复制直链）？[y/N]: "; read_input ans "n"
  { [ "$ans" = "y" ] || [ "$ans" = "Y" ]; } && set_block_bool features extplayer true "$CONFIG_FILE"

  c_ask "⑧ 豆瓣 / Bangumi 评分徽章？[y/N]: "; read_input ans "n"
  { [ "$ans" = "y" ] || [ "$ans" = "Y" ]; } && set_block_bool features douban true "$CONFIG_FILE"

  c_ask "⑨ 弹幕（需自建弹幕源）？[y/N]: "; read_input ans "n"
  { [ "$ans" = "y" ] || [ "$ans" = "Y" ]; } && set_block_bool features danmaku true "$CONFIG_FILE"

  c_ask "⑩ 第三方详情页增强 Emby-Javascript-Details（剧照/演员作品/预告片/JAV 翻译，安装时联网下载）？[y/N]: "; read_input ans "n"
  { [ "$ans" = "y" ] || [ "$ans" = "Y" ]; } && DETAILS=1

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
    uninstall_details
    docker exec "$CONTAINER" sh -c "rm -rf '$DASHBOARD_DIR/aurora'" 2>/dev/null
    c_ok "✓ 已卸载（index.html 注入已移除，aurora/ 目录已删除，备份保留在 /config/backups/aurora/）"
    exit 0
    ;;

  install)
    banner
    run_health_check || exit 1
    if [ "$YES" != "1" ]; then
      confirm "开始安装 EmbyAurora？" || exit 0
      choose_features
    fi

    deploy

    c_ok "════════════════════════════════════"
    c_ok "  ✅ EmbyAurora 安装完成！"
    c_ok "  浏览器 Ctrl+F5 / Cmd+Shift+R 强制刷新即可看到效果"
    c_ok "  容器重建后运行: bash install.sh --restore 恢复"
    c_ok "  改配置重装: bash install.sh --yes 或 --config 自定义"
    c_ok "════════════════════════════════════"
    ;;
esac
