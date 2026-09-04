#!/usr/bin/env bash
# =============================================================================
#  EmbyAurora · lib/details.sh
#  第三方集成：Emby-Javascript-Details（详情页 / 演员页 / 预告片增强）
#  ---------------------------------------------------------------------------
#  引用式集成：安装时从原作者仓库实时下载脚本，代码保留原出处，不复制进本仓库。
#  原作者：https://github.com/XingyiHua2024/Emby-Javascript-Details
# =============================================================================

DETAILS_REPO="https://raw.githubusercontent.com/XingyiHua2024/Emby-Javascript-Details/main"
DETAILS_CDN="https://cdn.jsdelivr.net/gh/XingyiHua2024/Emby-Javascript-Details@main"
DETAILS_FILES="emby_detail_page.js list_page_trailer.js actor_page.js trailer_more_button.js config.json"
DETAILS_SCRIPTS="emby_detail_page.js list_page_trailer.js actor_page.js trailer_more_button.js"
OPENCC_CDN='<script src="https://cdn.jsdelivr.net/npm/opencc-js@1.0.5/dist/umd/cn2t.js"></script>'

# 下载单个文件（raw 优先，jsdelivr 镜像回退）
fetch_details_file() {
  local f="$1" out="$2"
  if curl -sL --max-time 30 "$DETAILS_REPO/$f" -o "$out" 2>/dev/null && [ -s "$out" ]; then
    return 0
  fi
  curl -sL --max-time 30 "$DETAILS_CDN/$f" -o "$out" 2>/dev/null && [ -s "$out" ]
}

# 集成第三方脚本
install_details() {
  c_info "集成第三方：Emby-Javascript-Details（详情页 / 演员页 / 预告片增强）"
  c_info "原作者：https://github.com/XingyiHua2024/Emby-Javascript-Details"

  local tmp="/tmp/aurora-details"
  rm -rf "$tmp"; mkdir -p "$tmp"
  local f
  for f in $DETAILS_FILES; do
    if fetch_details_file "$f" "$tmp/$f"; then
      echo "    ✓ 下载 $f"
    else
      c_warn "    ✗ $f 下载失败（需能访问 GitHub raw / jsdelivr）"
    fi
  done

  # 拷贝到 dashboard-ui 根目录（index.html 同级，与原作者的 ./config.json 相对路径假设一致）
  docker cp "$tmp/." "$CONTAINER:$DASHBOARD_DIR/" 2>/dev/null

  # 注入 4 个 script + opencc CDN 到 </head> 前（幂等）
  docker exec "$CONTAINER" sh -c "
    for js in $DETAILS_SCRIPTS; do
      grep -q \"\$js\" '$INDEX_FILE' 2>/dev/null || sed -i '/<\/head>/i <script type=\"text/javascript\" src=\"\$js\"></script>' '$INDEX_FILE'
    done
    grep -q 'opencc-js' '$INDEX_FILE' 2>/dev/null || sed -i '/<\/head>/i $OPENCC_CDN' '$INDEX_FILE'
  "

  c_ok "✓ Emby-Javascript-Details 已集成（config.json 位于 dashboard-ui 根目录，可配置 OpenAI/JavDB）"
}

# 卸载第三方脚本
uninstall_details() {
  docker exec "$CONTAINER" sh -c "
    sed -i '/emby_detail_page.js/d; /list_page_trailer.js/d; /actor_page.js/d; /trailer_more_button.js/d; /opencc-js/d' '$INDEX_FILE'
    rm -f '$DASHBOARD_DIR/emby_detail_page.js' '$DASHBOARD_DIR/list_page_trailer.js' '$DASHBOARD_DIR/actor_page.js' '$DASHBOARD_DIR/trailer_more_button.js'
  " 2>/dev/null
  c_ok "✓ 第三方脚本已卸载"
}
