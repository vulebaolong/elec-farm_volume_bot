#!/usr/bin/env bash
set -euo pipefail

# Dừng lại trước khi thoát (kể cả lỗi)
trap '
  status=$?
  echo
  if [ $status -ne 0 ]; then
    echo "❌ Script FAILED (exit $status)"
  else
    echo "✅ Script FINISHED successfully"
  fi
  read -rp "Press Enter to close this window..."
' EXIT

# ==== Config sửa cho phù hợp ====
# Nạp .env nếu tồn tại (biến trong .env sẽ được export)
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

: "${GH_TOKEN:?ERROR: GH_TOKEN is required}"  # guard: bắt buộc có GH_TOKEN

echo "Using GH_TOKEN length: $(printf %s "$GH_TOKEN" | wc -c)"
# ===============================

echo "Install deps"
npm ci
npm run postinstall --if-present

echo "Build (webpack -> release/app/dist)"
export NODE_ENV=production
npm run build

echo "Build & Publish Windows (unsigned)"
# Nếu cần tránh tự dò cert code signing:
export CSC_IDENTITY_AUTO_DISCOVERY=false
# Lưu ý: electron-builder dùng GH_TOKEN để publish lên GitHub Releases.
npx electron-builder --win nsis --publish always

echo "Done. Check your GitHub Releases for uploaded artifacts."
