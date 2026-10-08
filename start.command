#!/bin/bash
# Double-click in Finder to launch LOOP. Keep this file beside package.json.
cd -- "$(dirname -- "$0")" || exit 1

printf '\n  LOOP · 包挂定制工作室\n\n'

# Finder does not inherit the Node paths configured in an interactive shell.
for candidate in "$(command -v node)" \
  /opt/homebrew/bin/node /usr/local/bin/node \
  "$HOME/.volta/bin/node" \
  "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" \
  "$HOME"/.nvm/versions/node/*/bin/node; do
  if [ -x "$candidate" ] && "$candidate" -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit(major>22||(major===22&&minor>=13)?0:1)' 2>/dev/null; then
    loop_node="$candidate"
    break
  fi
done

if [ -z "$loop_node" ]; then
  printf '需要 Node.js 22.13 或以上版本，建议安装 Node.js 24。\n请从 https://nodejs.org/ 安装后，再双击本文件。\n\n按回车关闭窗口。'
  read -r
  exit 1
fi

export PATH="$(dirname -- "$loop_node"):/opt/homebrew/bin:/usr/local/bin:$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH"
"$loop_node" scripts/start-local.mjs
loop_status=$?
if [ "$loop_status" -ne 0 ]; then
  printf '\n启动未完成，请查看上面的提示。按回车关闭窗口。'
  read -r
fi
exit "$loop_status"
