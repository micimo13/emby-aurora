#!/usr/bin/env bash
# =============================================================================
#  EmbyAurora · online-install.sh — 在线一键安装入口
# =============================================================================
#  用法（在 Emby 宿主机上执行）：
#    curl -sL https://raw.githubusercontent.com/<owner>/emby-aurora/main/online-install.sh | bash
#    curl -sL https://raw.githubusercontent.com/<owner>/emby-aurora/main/online-install.sh | bash -s -- --yes
#  说明：本脚本负责下载完整仓库到 /tmp 并执行 install.sh，参数原样透传。
# =============================================================================

REPO_OWNER="${AURORA_OWNER:-micimo13}"
REPO_NAME="emby-aurora"
BRANCH="main"
TMP_ROOT="/tmp/aurora-dl"
TARBALL="$TMP_ROOT/aurora.tar.gz"
WORK_DIR="$TMP_ROOT/emby-aurora-$BRANCH"

rm -rf "$TMP_ROOT"; mkdir -p "$TMP_ROOT"

echo "▶ 下载 EmbyAurora（$REPO_OWNER/$REPO_NAME@$BRANCH）..."

# 优先 GitHub API（国内可访问性更好），失败回退 codeload
if ! curl -fsSL "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/tarball/$BRANCH" -o "$TARBALL"; then
  curl -fsSL "https://codeload.github.com/$REPO_OWNER/$REPO_NAME/tar.gz/refs/heads/$BRANCH" -o "$TARBALL" \
    || { echo "✗ 下载失败，请检查网络或手动 git clone"; exit 1; }
fi

# 解压（GitHub tarball 顶层目录名带随机前缀，需定位）
mkdir -p "$WORK_DIR"
tar xzf "$TARBALL" -C "$TMP_ROOT" 2>/dev/null || tar xzf "$TARBALL" -C "$TMP_ROOT"
EXTRACTED=$(ls -d "$TMP_ROOT"/"$REPO_NAME"-* 2>/dev/null | head -1)
[ -z "$EXTRACTED" ] && { echo "✗ 解压失败"; exit 1; }

cd "$EXTRACTED"
chmod +x install.sh 2>/dev/null || true
bash install.sh "$@"
