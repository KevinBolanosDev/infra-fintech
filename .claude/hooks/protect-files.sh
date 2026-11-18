#!/usr/bin/env bash
# PreToolUse (Read|Write|Edit|NotebookEdit|Grep|Glob).
# Protege: secretos (.env*, llaves), pnpm-lock.yaml, migraciones ya versionadas y la
# propia configuración del agente (settings, hooks, .mcp.json).
#   exit 2            -> bloquea; stderr se le muestra a Claude.
#   JSON "ask" y 0    -> pide confirmación humana.
# Falla CERRADO: sin jq no puede evaluar nada, así que bloquea.
set -u

if ! command -v jq >/dev/null 2>&1; then
  echo "BLOQUEADO (protect-files.sh): jq no está instalado, no se puede evaluar la acción." >&2
  exit 2
fi

input=$(cat)
tool=$(jq -r '.tool_name // ""' <<<"$input")
path=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // .tool_input.path // ""' <<<"$input")
# Patrones de glob que pide Grep (campo glob) o Glob (campo pattern)
globs=$(jq -r '[.tool_input.glob, (if .tool_name == "Glob" then .tool_input.pattern else null end)]
               | map(select(. != null)) | join(" ")' <<<"$input")
root=${CLAUDE_PROJECT_DIR:-$(pwd)}

block() { echo "BLOQUEADO (protect-files.sh): $1" >&2; exit 2; }
ask() {
  jq -n --arg r "$1" '{hookSpecificOutput: {hookEventName: "PreToolUse",
    permissionDecision: "ask", permissionDecisionReason: $r}}'
  exit 0
}

# ¿El nombre (basename o patrón) apunta a un secreto?
is_secret_name() {
  case "$1" in
    .env.example|.env.sample|.env.template) return 1 ;;
    .env*|*.env|*.pem|*.key|*.p12|*.pfx|id_rsa|id_rsa.*|id_ed25519|id_ed25519.*) return 0 ;;
  esac
  return 1
}

# 1) Secretos: aplica a cualquier herramienta, incluidas Read, Grep y Glob.
if [ -n "$path" ]; then
  is_secret_name "$(basename -- "$path")" && block "'$path' es un archivo de secretos. No se lee ni se escribe; pide al usuario el dato que necesites."
  case "$path" in */secrets/*|*/.secrets/*) block "'$path' está en un directorio de secretos." ;; esac
fi
for g in $globs; do
  is_secret_name "${g##*/}" && block "el patrón '$g' apunta a archivos de secretos."
done

# El resto solo aplica a herramientas que escriben.
case "$tool" in Read|Grep|Glob) exit 0 ;; esac
[ -z "$path" ] && exit 0

# 2) Lockfile: lo gestiona pnpm, nunca a mano.
[ "$(basename -- "$path")" = "pnpm-lock.yaml" ] && block "pnpm-lock.yaml lo genera pnpm; no se edita a mano."

# 3) Migraciones ya versionadas (en el índice o en un commit): inmutables.
case "$path" in
  */migrations/*)
    if git -C "$root" ls-files --error-unmatch -- "$path" >/dev/null 2>&1; then
      block "'$path' es una migración ya versionada. No se edita: crea una migración nueva (cambios destructivos en dos pasos)."
    fi
    ;;
esac

# 4) Configuración del propio agente: requiere confirmación humana.
case "$path" in
  */.claude/settings.json|*/.claude/settings.local.json|*/.claude/hooks/*|*/.mcp.json)
    ask "Cambio en la configuración del agente ($path). Revísalo antes de aprobar: afecta permisos, hooks o servidores MCP."
    ;;
esac

exit 0
