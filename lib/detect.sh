#!/usr/bin/env bash
# =============================================================================
#  EmbyAurora · lib/detect.sh
#  环境检测：容器 / 镜像类型 / Web 目录 / 版本 / 持久化钩子
#  支持：官方版 emby/embyserver · LinuxServer · amilys 社区版 · 其他
# =============================================================================

detect_container() {
  local list i=1
  list=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -iE "emby" | head -10)
  [ -z "$list" ] && { c_err "未找到运行中的 Emby 容器"; return 1; }

  if [ -z "$CONTAINER" ]; then
    local count
    count=$(echo "$list" | wc -l)
    if [ "$count" = "1" ]; then
      CONTAINER="$list"
    else
      c_info "检测到多个 Emby 容器："
      echo "$list" | nl -w2 -s'] '
      c_ask "选择容器 [1-$count, 默认 1]: "
      local sel=""; read_input sel "1"
      sel=$(echo "$sel" | tr -dc '0-9')
      [ -z "$sel" ] && sel="1"
      [ "$sel" -lt 1 ] && sel="1"
      [ "$sel" -gt "$count" ] && sel="1"
      CONTAINER=$(echo "$list" | sed -n "${sel}p")
    fi
  fi
  docker inspect "$CONTAINER" >/dev/null 2>&1 || { c_err "容器 $CONTAINER 不存在"; return 1; }
  c_ok "✓ 目标容器：$CONTAINER"
}

detect_image() {
  IMAGE_TYPE="unknown"
  IMAGE_FULL=$(docker inspect "$CONTAINER" --format '{{.Config.Image}}' 2>/dev/null)
  case "$IMAGE_FULL" in
    *linuxserver/emby*) IMAGE_TYPE="linuxserver" ;;
    *amilys*|*vanvy*)   IMAGE_TYPE="amilys" ;;
    *emby/embyserver*|*embyserver*) IMAGE_TYPE="official" ;;
    *) IMAGE_TYPE="unknown" ;;
  esac
}

detect_dashboard_dir() {
  local d
  for d in /system/dashboard-ui /app/emby/system/dashboard-ui /usr/lib/emby-server/web /opt/emby-server/system/dashboard-ui; do
    if docker exec "$CONTAINER" sh -c "[ -f '$d/index.html' ]" 2>/dev/null; then
      DASHBOARD_DIR="$d"; INDEX_FILE="$d/index.html"; return 0
    fi
  done
  # 兜底：递归查找
  DASHBOARD_DIR=$(docker exec "$CONTAINER" sh -c "find / -maxdepth 5 -name index.html -path '*dashboard*' 2>/dev/null | head -1 | xargs dirname" 2>/dev/null)
  [ -z "$DASHBOARD_DIR" ] && { c_err "未找到 Emby Web 目录"; return 1; }
  INDEX_FILE="$DASHBOARD_DIR/index.html"
}

detect_version() {
  VER=""
  VER=$(docker exec "$CONTAINER" sh -c "curl -s --max-time 5 'http://127.0.0.1:8096/emby/System/Info/Public' 2>/dev/null | grep -oE '\"Version\":\"[^\"]+\"' | cut -d'\"' -f4" 2>/dev/null)
  [ -z "$VER" ] && VER=$(docker exec "$CONTAINER" sh -c "grep -oE '4\.[0-9]+\.[0-9]+\.[0-9]+' '$DASHBOARD_DIR/app.js' 2>/dev/null | head -1" 2>/dev/null)
}

detect_ext_hook() {
  EXT_HOOK=0
  if docker exec "$CONTAINER" sh -c "[ -f /config/config/ext.sh ]" 2>/dev/null; then
    EXT_HOOK=1
  fi
}

run_health_check() {
  detect_container || return 1
  detect_image
  detect_dashboard_dir || return 1
  detect_version
  detect_ext_hook
  c_ok "✓ 环境就绪：$CONTAINER（$IMAGE_TYPE · Emby ${VER:-未知} · $DASHBOARD_DIR）"
}
