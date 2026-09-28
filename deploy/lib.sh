# Shared by the server scripts: compose for one stand.
set -euo pipefail
CRM_ROOT=/opt/crm
BACKUP_DIR=$CRM_ROOT/backups
# Scripts are run by hand from any folder; compose needs a readable one.
cd "$CRM_ROOT"
# Backups hold personal data: readable by the deploy user only.
umask 077

stand_dir() { echo "$CRM_ROOT/$1"; }

# dc <env> <compose args...>
dc() {
  local env=$1
  shift
  docker compose -p "crm-$env" -f "$CRM_ROOT/compose.yml" \
    --env-file "$(stand_dir "$env")/.env" "$@"
}

check_env() {
  case "$1" in
    staging | prod) ;;
    *) echo "Unknown stand: $1 (staging or prod)" >&2; exit 2 ;;
  esac
}
