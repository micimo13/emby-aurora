#!/usr/bin/env bash
# =============================================================================
#  EmbyAurora · uninstall.sh — 卸载脚本
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/install.sh" --uninstall "$@"
