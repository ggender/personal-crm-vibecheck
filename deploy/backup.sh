#!/usr/bin/env bash
# backup.sh <staging|prod> [label] - pg_dump of the stand, keeps the last 14.
# Runs before every prod deploy and daily from cron.
# Here backups stay on this server; in real life copy them to another server or S3.
source /opt/crm/lib.sh
ENV=$1
LABEL=${2:-daily}
check_env "$ENV"
mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/$ENV-$(date +%Y%m%d-%H%M%S)-$LABEL.sql.gz"
dc "$ENV" exec -T db pg_dump -U postgres --clean --if-exists crm | gzip >"$FILE"
echo "== backup $FILE"
ls -1t "$BACKUP_DIR"/"$ENV"-*.sql.gz | tail -n +15 | xargs -r rm --
