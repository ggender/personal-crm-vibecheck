#!/usr/bin/env bash
# restore.sh <staging|prod> <backup file> - emergency: the database back from a backup.
# Data written after that backup is lost. Afterwards run Deploy prod with the
# SHA that was live when the backup was taken (it is in the file name).
source /opt/crm/lib.sh
ENV=$1
FILE=$2
check_env "$ENV"
[ -f "$FILE" ] || { echo "No such backup: $FILE" >&2; exit 2; }
echo "== stopping app on $ENV"
dc "$ENV" stop app
echo "== restoring $FILE"
dc "$ENV" exec -T db dropdb -U postgres --force --if-exists crm
dc "$ENV" exec -T db createdb -U postgres crm
gunzip -c "$FILE" | dc "$ENV" exec -T db psql -U postgres -q -v ON_ERROR_STOP=1 crm >/dev/null
echo "== restored. Next: Deploy prod with the previous SHA"
