#!/bin/sh
# ph-fusion-entrypoint — runtime config for Fusion (Next.js standalone) images.
#
# Next.js inlines NEXT_PUBLIC_* at build time. Fusion images are built with
# NEXT_PUBLIC_<NAME>=__NEXT_PUBLIC_<NAME>__; at container start this script
# copies the app to a writable dir and replaces every placeholder with the
# value of the env var of the same name (unset → empty string), so one image
# serves any environment. Vendor this file into the app image unchanged.
#
#   FUSION_APP_DIR      built app (default /app)
#   FUSION_RUNTIME_DIR  writable copy the app runs from (default /tmp/app)
#   args                command to exec (default: node server.js)
set -eu

src="${FUSION_APP_DIR:-/app}"
dst="${FUSION_RUNTIME_DIR:-/tmp/app}"

rm -rf "$dst"
mkdir -p "$dst"
cp -a "$src/." "$dst/"

# Literal (non-regex) replacement so values may contain any character.
replace='
BEGIN {
  for (k in ENVIRON) if (k ~ /^NEXT_PUBLIC_[A-Z0-9_]+$/) { n++; key[n] = "__" k "__"; val[n] = ENVIRON[k] }
}
{
  line = $0
  for (i = 1; i <= n; i++) {
    out = ""
    while ((p = index(line, key[i])) > 0) {
      out = out substr(line, 1, p - 1) val[i]
      line = substr(line, p + length(key[i]))
    }
    line = out line
  }
  gsub(/__NEXT_PUBLIC_[A-Z0-9_]*__/, "", line)
  print line
}'

grep -rlE '__NEXT_PUBLIC_[A-Z0-9_]*__' "$dst" 2>/dev/null | while IFS= read -r f; do
  case "$f" in
    *.js|*.mjs|*.cjs|*.html|*.json|*.rsc|*.body|*.txt|*.css) ;;
    *) continue ;;
  esac
  awk "$replace" "$f" > "$f.ph-tmp" && mv "$f.ph-tmp" "$f"
done

cd "$dst"
if [ "$#" -gt 0 ]; then exec "$@"; fi
exec node server.js
