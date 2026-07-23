#!/usr/bin/env bash
#
# build-release.sh — builds the customer-ready Windows package in one step.
#
#   ./build-release.sh
#
# Output: dist/AnnotoConfigurator-v<version>-win-x64.zip
# Send that zip to the customer. They unzip, double-click the exe, done.
#
set -euo pipefail

cd "$(dirname "$0")"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✔\033[0m %s\n' "$*"; }
err()  { printf '  \033[31m✘\033[0m %s\n' "$*" >&2; }

bold "Annoto × Kaltura Configurator — Windows release build"
echo

# ---------------------------------------------------------------- checks
if ! command -v node >/dev/null 2>&1; then
  err "Node.js is not installed. Install it from https://nodejs.org (v18+) and re-run."
  exit 1
fi
ok "Node.js $(node -v)"

if ! command -v bun >/dev/null 2>&1; then
  # Bun installs to ~/.bun by default; check there too before giving up.
  if [ -x "$HOME/.bun/bin/bun" ]; then
    export PATH="$HOME/.bun/bin:$PATH"
  else
    echo
    err "Bun is not installed (it does the exe compilation)."
    read -r -p "  Install Bun now? [Y/n] " answer
    case "${answer:-Y}" in
      [Yy]*|"")
        curl -fsSL https://bun.sh/install | bash
        export PATH="$HOME/.bun/bin:$PATH"
        ;;
      *)
        err "Aborted. Install Bun from https://bun.sh and re-run."
        exit 1
        ;;
    esac
  fi
fi
ok "Bun $(bun --version)"

if [ ! -d node_modules ]; then
  echo "  Installing npm dependencies (first run only)..."
  npm install --no-audit --no-fund >/dev/null
fi
ok "Dependencies present"

# ---------------------------------------------------------------- version
VERSION=$(node -p "require('./package.json').version")
ZIP_NAME="AnnotoConfigurator-v${VERSION}-win-x64.zip"

# ---------------------------------------------------------------- build
echo
bold "Building v${VERSION}..."
node buildtools/embed-html.js
bun build --compile --target=bun-windows-x64 buildtools/entry.cjs --outfile dist/AnnotoConfigurator.exe
ok "dist/AnnotoConfigurator.exe"

# ---------------------------------------------------------------- package
cd dist
rm -f "$ZIP_NAME"
zip -q "$ZIP_NAME" AnnotoConfigurator.exe
cd ..
SIZE=$(du -h "dist/$ZIP_NAME" | cut -f1)
ok "dist/$ZIP_NAME ($SIZE)"

# ---------------------------------------------------------------- done
echo
bold "Done! Send this file to the customer:"
echo
echo "    $(pwd)/dist/$ZIP_NAME"
echo
echo "Customer instructions:"
echo "  1. Unzip the file"
echo "  2. Double-click AnnotoConfigurator.exe"
echo "  3. If Windows shows 'Windows protected your PC': More info → Run anyway"
echo "  4. The browser opens automatically — keep the black window open while working"
echo
