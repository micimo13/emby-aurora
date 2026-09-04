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
    if [ "$YES" != "1" ]; then confirm "开始安装 EmbyAurora？" || exit 0; fi

    deploy

    c_ok "════════════════════════════════════"
    c_ok "  ✅ EmbyAurora 安装完成！"
    c_ok "  浏览器 Ctrl+F5 / Cmd+Shift+R 强制刷新即可看到效果"
    c_ok "  容器重建后运行: bash install.sh --restore 恢复"
    c_ok "════════════════════════════════════"
    ;;
esac
