#!/usr/bin/env bash
# =============================================================================
#  EmbyAurora · lib/common.sh
#  公共函数库：日志 / 备份 / 幂等注入 / 资源拷贝 / 持久化
#
#  部署后端抽象：DEPLOY_MODE = docker | bare
#    · docker：操作容器（docker exec / docker cp）
#    · bare  ：操作宿主机文件系统（cp / sed，适用于裸机 / 套件安装）
# =============================================================================

C_INFO='\033[1;36m'; C_OK='\033[1;32m'; C_WARN='\033[1;33m'
C_ERR='\033[1;31m'; C_ASK='\033[1;35m'; C_OFF='\033[0m'

c_info()  { printf "${C_INFO}[信息]${C_OFF} %s\n" "$*"; }
c_ok()    { printf "${C_OK}[成功]${C_OFF} %s\n" "$*"; }
c_warn()  { printf "${C_WARN}[警告]${C_OFF} %s\n" "$*"; }
c_err()   { printf "${C_ERR}[错误]${C_OFF} %s\n" "$*"; }
c_ask()   { printf "${C_ASK}[询问]${C_OFF} %s" "$*"; }
die()     { c_err "$*"; exit 1; }

# 读取用户输入（终端/管道兼容）
read_input() {
  local var="$1" default="${2:-}" val=""
  if [ -t 0 ]; then read -r val; else { read -r val < /dev/tty; } 2>/dev/null || read -r val; fi
  [ -z "$val" ] && val="$default"
  eval "$var=\"$val\""
}

# 确认（默认 N）
confirm() {
  c_ask "$1 [y/N]: "
  local ans=""; read_input ans
  [ "$ans" = "y" ] || [ "$ans" = "Y" ]
}

# 部署后端（默认 docker，可由 detect 阶段改写为 bare）
DEPLOY_MODE="${DEPLOY_MODE:-docker}"

# 判断文件是否存在于目标端
rem_file_exists() {
  if [ "$DEPLOY_MODE" = "bare" ]; then [ -f "$1" ]
  else docker exec "$CONTAINER" sh -c "[ -f '$1' ]" 2>/dev/null; fi
}

# 判断目标端文件是否包含某字符串（幂等注入用）
rem_grep() {
  if [ "$DEPLOY_MODE" = "bare" ]; then grep -q "$1" "$2" 2>/dev/null
  else docker exec "$CONTAINER" grep -q "$1" "$2" 2>/dev/null; fi
}

# 备份路径（docker 用 /config，bare 用 dashboard-ui 同级）
aurora_backup_dir() {
  if [ "$DEPLOY_MODE" = "bare" ]; then echo "${DASHBOARD_DIR%/}/../aurora-backups"
  else echo "/config/backups/aurora"; fi
}

# 备份 index.html（带时间戳）
backup_index() {
  local bd
  bd="$(aurora_backup_dir)"
  if [ "$DEPLOY_MODE" = "bare" ]; then
    mkdir -p "$bd"
    cp "$INDEX_FILE" "$bd/index.html.bak.$(date +%Y%m%d-%H%M%S)"
  else
    docker exec "$CONTAINER" sh -c "
      mkdir -p '$bd'
      cp '$INDEX_FILE' '$bd/index.html.bak.'\$(date +%Y%m%d-%H%M%S)
    " 2>/dev/null
  fi
  c_ok "✓ index.html 已备份到 $bd"
}

# 幂等注入：在 </head> 前插入 config.js + bootstrap.js（marker 存在则跳过）
inject_index() {
  if rem_grep "aurora/bootstrap.js" "$INDEX_FILE"; then
    c_ok "✓ 已注入（跳过）"
    return 0
  fi
  backup_index
  if [ "$DEPLOY_MODE" = "bare" ]; then
    sed -i 's#</head>#<script src="aurora/config.js"></script><script src="aurora/bootstrap.js"></script></head>#' "$INDEX_FILE"
  else
    docker exec "$CONTAINER" sh -c "sed -i 's#</head>#<script src=\"aurora/config.js\"></script><script src=\"aurora/bootstrap.js\"></script></head>#' '$INDEX_FILE'" 2>&1 | sed 's/^/    /'
  fi
  if rem_grep "aurora/bootstrap.js" "$INDEX_FILE"; then
    c_ok "✓ 注入成功"
  else
    c_err "注入失败，请检查 index.html 结构"
    return 1
  fi
}

# 移除注入（卸载用）
uninject_index() {
  if [ "$DEPLOY_MODE" = "bare" ]; then
    sed -i '/aurora\/config.js/d; /aurora\/bootstrap.js/d' "$INDEX_FILE"
  else
    docker exec "$CONTAINER" sh -c "sed -i '/aurora\/config.js/d; /aurora\/bootstrap.js/d' '$INDEX_FILE'" 2>&1 | sed 's/^/    /'
  fi
}

# 拷贝目录到目标端（拷贝后统一加读权限，避免 Emby 进程无权限读取导致 500）
push_dir() {
  local src="$1" dst="$2"
  if [ "$DEPLOY_MODE" = "bare" ]; then
    mkdir -p "$dst"
    cp -r "$src/." "$dst/" 2>/dev/null && chmod -R a+rX "$dst" \
      && c_ok "✓ 已部署资源到 $dst" || { c_err "资源拷贝失败"; return 1; }
  else
    docker exec "$CONTAINER" sh -c "mkdir -p '$dst'" 2>/dev/null
    docker cp "$src/." "$CONTAINER:$dst/" 2>/dev/null \
      && docker exec "$CONTAINER" sh -c "chmod -R a+rX '$dst'" 2>/dev/null \
      && c_ok "✓ 已部署资源到 $dst" \
      || { c_err "资源拷贝失败"; return 1; }
  fi
}

# 生成 config.js（把 JSON 配置包装成 window.AURORA_CONFIG）
gen_config_js() {
  local json_file="$1" out="$2"
  if [ ! -f "$json_file" ]; then
    c_warn "未找到配置文件 $json_file，使用内置默认配置"
    return 0
  fi
  if [ "$DEPLOY_MODE" = "bare" ]; then
    mkdir -p "$(dirname "$out")"
    { echo 'window.AURORA_CONFIG = '; cat "$json_file"; echo ';'; } > "$out"
  else
    {
      echo 'window.AURORA_CONFIG = '
      cat "$json_file"
      echo ';'
    } > /tmp/aurora-config.js
    docker cp /tmp/aurora-config.js "$CONTAINER:$out" 2>/dev/null || { c_err "配置写入失败"; rm -f /tmp/aurora-config.js; return 1; }
    rm -f /tmp/aurora-config.js
  fi
  c_ok "✓ 配置已写入 $out"
}

# 设置 JSON 配置中「某块」内某个 key 的布尔值（作用于 config.json 副本，sed 精确替换）
# set_block_bool <块名> <key> <true|false> <file>
set_block_bool() {
  local block="$1" key="$2" value="$3" file="$4"
  sed -i -E "/\"$block\"/,/}/ s/\"$key\"[[:space:]]*:[[:space:]]*(true|false)/\"$key\": $value/" "$file"
}

# 设置 JSON 配置中「某块」内某个 key 的字符串值
# set_block_str <块名> <key> <value> <file>
# 用 | 作 sed 分隔符并转义 & \ |，使 value 可安全包含 URL（/ ? & 等）
set_block_str() {
  local block="$1" key="$2" value="$3" file="$4"
  local esc
  esc=$(printf '%s' "$value" | sed 's/[\\&|]/\\&/g')
  sed -i -E "/\"$block\"/,/}/ s|\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"|\"$key\": \"$esc\"|" "$file"
}

# 社区版持久化钩子（仅 docker 的 amilys 等镜像有 /config/config/ext.sh）
install_ext_hook() {
  [ "$DEPLOY_MODE" = "bare" ] && return 0
  if [ "$EXT_HOOK" = "1" ]; then
    local hook='/config/config/ext.sh'
    docker exec "$CONTAINER" sh -c "
      if ! grep -q 'aurora' '$hook' 2>/dev/null; then
        echo 'echo \"[aurora] restoring\"' >> '$hook'
      fi
    " 2>/dev/null && c_ok "✓ 已写入启动钩子（容器重建自动恢复）"
  fi
}
