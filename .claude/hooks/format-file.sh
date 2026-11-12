#!/usr/bin/env bash
# PostToolUse (Write|Edit). Formatea con Prettier y corrige con ESLint el archivo editado.
# Usa SOLO binarios locales de node_modules (nunca npx: descargaría paquetes sin versión fija).
# Si aún no están instalados (fase 0, sin dependencias), no hace nada.
#   exit 2 -> hay problemas de ESLint sin corregir; stderr le llega a Claude para que los arregle.
set -u
command -v jq >/dev/null 2>&1 || exit 0

input=$(cat)
f=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty' <<<"$input")
[ -n "$f" ] && [ -f "$f" ] || exit 0
root=${CLAUDE_PROJECT_DIR:-$(pwd)}

# Nunca tocar: dependencias, salida generada, skills de terceros, migraciones y lockfile.
case "$f" in
  */node_modules/*|*/.claude/*|*/.next/*|*/dist/*|*/generated/*|*/migrations/*|*/pnpm-lock.yaml) exit 0 ;;
esac
case "$f" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.css|*.scss|*.yaml|*.yml) ;;
  *) exit 0 ;;
esac

bin="$root/node_modules/.bin"
[ -x "$bin/prettier" ] && "$bin/prettier" --write --ignore-unknown "$f" >/dev/null 2>&1

case "$f" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
    if [ -x "$bin/eslint" ]; then
      out=$("$bin/eslint" --fix --no-warn-ignored "$f" 2>&1); rc=$?
      # ESLint: 1 = errores de lint sin corregir; 2 = fallo de configuración (no se le pasa a Claude).
      if [ "$rc" -eq 1 ]; then
        printf 'ESLint: problemas sin corregir en %s\n%s\n' "$f" "$out" >&2
        exit 2
      fi
    fi
    ;;
esac
exit 0
