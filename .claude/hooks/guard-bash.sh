#!/usr/bin/env bash
# PreToolUse (Bash). Bloquea atajos peligrosos en comandos de shell.
#   exit 2 -> bloquea (stderr va a Claude) · JSON "ask" y 0 -> pide confirmación humana.
# LÍMITE: es una red de seguridad por patrones, no un sandbox. Un comando ofuscado
# (variables, base64, scripts que hagan red por dentro) puede esquivarla. La barrera
# real son los permisos, CI y la revisión humana.
set -u

if ! command -v jq >/dev/null 2>&1; then
  echo "BLOQUEADO (guard-bash.sh): jq no está instalado, no se puede evaluar el comando." >&2
  exit 2
fi

input=$(cat)
cmd=$(jq -r '.tool_input.command // ""' <<<"$input")
[ -z "$cmd" ] && exit 0

block() { echo "BLOQUEADO (guard-bash.sh): $1" >&2; exit 2; }
ask() {
  jq -n --arg r "$1" '{hookSpecificOutput: {hookEventName: "PreToolUse",
    permissionDecision: "ask", permissionDecisionReason: $r}}'
  exit 0
}
has() { grep -Eqi -e "$1" <<<"$cmd"; }

# 1) Saltarse los hooks de git
has '(^|[[:space:]])--no-verify([[:space:]]|$)' && block "--no-verify salta los hooks de git."

# 2) Historia y borrados irreversibles
has 'git[[:space:]]+push[^;&|]*([[:space:]]--force|[[:space:]]-f([[:space:]]|$)|[[:space:]]\+[^[:space:]]+)' \
  && block "git push forzado no está permitido."
if has '\brm\b[^;&|]*[[:space:]](-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)([[:space:]]|$)' \
   && has '\brm\b[^;&|]*[[:space:]](-[a-zA-Z]*f[a-zA-Z]*|--force)([[:space:]]|$)'; then
  block "rm recursivo y forzado no está permitido."
fi

# 3) Prisma destructivo. El consentimiento nunca lo fabrica el agente.
has 'prisma[[:space:]]+migrate[[:space:]]+(reset|deploy)' \
  && block "prisma migrate reset/deploy está prohibido para el agente (deploy solo en CI/migrator)."
has 'prisma[[:space:]]+db[[:space:]]+push[^;&|]*(--force-reset|--accept-data-loss)' \
  && block "db push destructivo está prohibido."
has 'PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION' \
  && block "el agente no define el consentimiento de Prisma; si el usuario lo concede, lo ejecuta él."

# 4) Lectura/impresión de secretos por shell (los ejemplos .env.example/.sample/.template sí se permiten)
clean=$(sed -E 's/\.env\.(example|sample|template)//g' <<<"$cmd")
if grep -Eq -e '(^|[^A-Za-z0-9_.-])([^[:space:]"'"'"']*/)?\.env([.][A-Za-z0-9_-]+)?([[:space:]"'"'"';|&)]|$)' <<<"$clean"; then
  block "el comando toca un archivo .env*. No se leen secretos."
fi
has '(^|[;&|[:space:]])printenv([[:space:]]|$)' && block "printenv imprime secretos del entorno."
has '(echo|printf|cat)[^;&|]*\$\{?[A-Za-z_]*(TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|_PAT|PRIVATE_KEY)' \
  && block "no se imprimen variables que contienen secretos."

# 5) Red: curl/wget solo contra localhost; nunca canalizar a un shell
if has '(^|[;&|`(]|[[:space:]])(curl|wget)([[:space:]]|$)'; then
  has '\|[[:space:]]*(sudo[[:space:]]+)?(ba|z|da)?sh([[:space:]]|$)' \
    && block "no se canaliza una descarga a un shell."
  hosts=$(grep -oE "https?://[^/[:space:]\"'?#]+" <<<"$cmd" \
          | sed -E 's#https?://##; s#.*@##; s#:[0-9]+$##; s#^\[(.*)\]$#\1#')
  [ -z "$hosts" ] && block "curl/wget sin URL http(s) literal: no se puede verificar el destino."
  while read -r h; do
    case "$h" in
      localhost|127.0.0.1|0.0.0.0|::1|*.localhost) ;;
      *) block "curl/wget a '$h' no está permitido (solo localhost). Para documentación usa Context7." ;;
    esac
  done <<<"$hosts"
fi

# 6) Modificar la configuración del agente por shell: confirmación humana
if has '\.claude/(settings(\.local)?\.json|hooks)|\.mcp\.json' \
   && has '(>|[[:space:]]tee[[:space:]]|sed[[:space:]]+-[a-zA-Z]*i|[[:space:]](mv|cp|rm|chmod|ln|truncate)[[:space:]])'; then
  ask "El comando modifica la configuración del agente (.claude/ o .mcp.json). Revísalo antes de aprobar."
fi

exit 0
