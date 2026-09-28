#!/usr/bin/env bash
# backup.sh <staging|prod> [label] - pg_dump of the stand, keeps the last 14.
# Runs before every prod deploy and daily from cron.
# Here backups stay on this server; in real life copy them to another server or S3.
source /opt/crm/lib.sh
ENV=$1
LABEL=${2:-daily}
check_env "$ENV"
mkdir -p "$BACKUP_DIR"
# The very first deploy has no database yet: the migrate step creates it.
if [ -z "$(dc "$ENV" exec -T db psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'crm'")" ]; then
  echo "== no database crm on $ENV yet, nothing to back up"
  exit 0
fi
FILE="$BACKUP_DIR/$ENV-$(date +%Y%m%d-%H%M%S)-$LABEL.sql.gz"
# A half-written dump must not look like a backup.
trap 'rm -f "$FILE"' ERR
dc "$ENV" exec -T db pg_dump -U postgres --clean --if-exists crm | gzip >"$FILE"
trap - ERR
echo "== backup $FILE"
ls -1t "$BACKUP_DIR"/"$ENV"-*.sql.gz | tail -n +15 | xargs -r rm --
