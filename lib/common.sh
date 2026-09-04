#!/usr/bin/env bash
# =============================================================================
#  EmbyAurora · lib/common.sh
#  公共函数库：日志 / 备份 / 幂等注入 / 资源拷贝 / 持久化
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

# 备份 index.html（带时间戳）
backup_index() {
  docker exec "$CONTAINER" sh -c "
    mkdir -p /config/backups/aurora
    cp '$INDEX_FILE' \"/config/backups/aurora/index.html.bak.\$(date +%Y%m%d-%H%M%S)\"
  " 2>/dev/null && c_ok "✓ index.html 已备份到 /config/backups/aurora/"
}

# 幂等注入：在 </head> 前插入 config.js + bootstrap.js（marker 存在则跳过）
inject_index() {
  if docker exec "$CONTAINER" grep -q "aurora/bootstrap.js" "$INDEX_FILE" 2>/dev/null; then
    c_ok "✓ 已注入（跳过）"
    return 0
  fi
  backup_index
  docker exec "$CONTAINER" sh -c "
    sed -i '/<\/head>/i <script src=\"aurora/config.js\"></script><script src=\"aurora/bootstrap.js\"></script>' '$INDEX_FILE'
  " 2>&1 | sed 's/^/    /'
  # 验证
  if docker exec "$CONTAINER" grep -q "aurora/bootstrap.js" "$INDEX_FILE" 2>/dev/null; then
    c_ok "✓ 注入成功"
  else
    c_err "注入失败，请检查 index.html 结构"
    return 1
  fi
}

# 移除注入（卸载用）
uninject_index() {
  docker exec "$CONTAINER" sh -c "
    sed -i '/aurora\/config.js/d; /aurora\/bootstrap.js/d' '$INDEX_FILE'
  " 2>&1 | sed 's/^/    /'
}

# 拷贝目录到容器
push_dir() {
  local src="$1" dst="$2"
  docker exec "$CONTAINER" sh -c "mkdir -p '$dst'" 2>/dev/null
  docker cp "$src/." "$CONTAINER:$dst/" 2>/dev/null \
    && c_ok "✓ 已部署资源到 $dst" \
    || { c_err "资源拷贝失败"; return 1; }
}

# 生成 config.js（把 JSON 配置包装成 window.AURORA_CONFIG）
gen_config_js() {
  local json_file="$1" out="$2"
  if [ -f "$json_file" ]; then
    # 在宿主机生成 config.js，再拷入容器
    {
      echo 'window.AURORA_CONFIG = '
      cat "$json_file"
      echo ';'
    } > /tmp/aurora-config.js
    docker cp /tmp/aurora-config.js "$CONTAINER:$out" 2>/dev/null \
      && c_ok "✓ 配置已写入 $out" \
      || { c_err "配置写入失败"; return 1; }
    rm -f /tmp/aurora-config.js
  else
    c_warn "未找到配置文件 $json_file，使用内置默认配置"
  fi
}

# 社区版持久化钩子（amilys 等镜像有 /config/config/ext.sh）
install_ext_hook() {
  if [ "$EXT_HOOK" = "1" ]; then
    local hook='/config/config/ext.sh'
    docker exec "$CONTAINER" sh -c "
      if ! grep -q 'aurora' '$hook' 2>/dev/null; then
        echo 'echo \"[aurora] restoring\"' >> '$hook'
      fi
    " 2>/dev/null && c_ok "✓ 已写入启动钩子（容器重建自动恢复）"
  fi
}
