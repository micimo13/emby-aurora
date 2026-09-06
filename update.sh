#!/usr/bin/env bash
# =============================================================================
#  EmbyAurora · update.sh — 一键升级
#  拉取最新代码 + 重新部署资源/注入。用户配置与网页主题设置自动保留。
#  用法：bash update.sh
# =============================================================================
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

banner() {
  printf "${C_INFO}"
  cat <<'EOF'

   ╔══════════════════════════════════════════════════════╗
   ║   ⬆️  EmbyAurora · 一键升级                           ║
   ╚══════════════════════════════════════════════════════╝
EOF
  printf "${C_OFF}\n"
}

banner

# 1. 更新代码
if [ -d "$SCRIPT_DIR/.git" ]; then
  c_info "拉取最新代码 ..."
  if git -C "$SCRIPT_DIR" pull --ff-only 2>/dev/null; then
    c_ok "✓ 代码已更新到最新"
  else
    c_warn "git pull 失败（可能是网络或本地有改动），继续使用本地代码"
  fi
else
  c_warn "当前不是 git 安装，请用下面命令重新下载最新版再安装："
  c_info "  bash <(curl -fsSL https://raw.githubusercontent.com/micimo13/emby-aurora/main/install.sh)"
fi

# 2. 重新部署（--restore：重新部署资源 + 幂等注入，配置保留）
c_info "重新部署资源与注入 ..."
bash "$SCRIPT_DIR/install.sh" --yes --restore

c_ok "════════════════════════════════════"
c_ok "  ✅ 升级完成！浏览器 Ctrl+F5 强制刷新即可"
c_ok "  你的主题与网页设置已自动保留"
c_ok "════════════════════════════════════"
