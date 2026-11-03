# Helpers sourced by install.sh and test_install.sh.

# node_version_ok "v22.1.0" -> 0 only if >= 20.19.0 (Vite 8: ^20.19.0 || >=22.12.0). Anything unparseable fails.
node_version_ok() {
  local v="${1-}"
  [[ "$v" =~ ^v?([0-9]+)\.([0-9]+)\.([0-9]+)$ ]] || return 1
  local maj=$((10#${BASH_REMATCH[1]})) min=$((10#${BASH_REMATCH[2]}))
  if [ "$maj" -eq 20 ]; then [ "$min" -ge 19 ]; return; fi
  if [ "$maj" -eq 22 ]; then [ "$min" -ge 12 ]; return; fi
  [ "$maj" -gt 22 ]
}

# have_usable_node -> 0 if `node` exists with a good version.
have_usable_node() {
  command -v node >/dev/null 2>&1 || return 1
  node_version_ok "$(node --version 2>/dev/null || true)"
}
