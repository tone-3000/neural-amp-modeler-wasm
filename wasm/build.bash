#!/bin/bash
# Build the NAM wasm engine and copy the artifacts into the UI package.
#
# Requires an activated emsdk (source ~/emsdk/emsdk_env.sh).
# Outputs: ui/src/engine/wasm/nam-engine.{js,wasm}
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILD_DIR="${REPO_ROOT}/build"

# Clean build: the directory only ever holds generated files.
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"
printf '*\n' > "${BUILD_DIR}/.gitignore"

emcmake cmake -S "${REPO_ROOT}" -B "${BUILD_DIR}" -DCMAKE_BUILD_TYPE=Release
cmake --build "${BUILD_DIR}" -j "$(getconf _NPROCESSORS_ONLN)"

DEST="${REPO_ROOT}/ui/src/engine/wasm"
mkdir -p "${DEST}"
cp "${BUILD_DIR}/wasm/nam-engine.js" "${BUILD_DIR}/wasm/nam-engine.wasm" "${DEST}/"

echo
echo "Built:"
ls -la "${DEST}/nam-engine.js" "${DEST}/nam-engine.wasm"
