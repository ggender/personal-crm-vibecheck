#!/usr/bin/env bash
# deploy.sh <staging|prod> <sha> - put the image of this commit on a stand.
# Prod: backup first. Both: migrations as a separate step, then the app.
source /opt/crm/lib.sh
ENV=$1
SHA=$2
check_env "$ENV"
DIR=$(stand_dir "$ENV")
export IMAGE_TAG=$SHA
APP_PORT=$(grep '^APP_PORT=' "$DIR/.env" | cut -d= -f2)

docker pull -q "ghcr.io/ggender/personal-crm-vibecheck:$SHA"
dc "$ENV" up -d --wait db mailpit

if [ "$ENV" = prod ]; then
  PREVIOUS=$(cat "$DIR/current" 2>/dev/null || echo none)
  "$CRM_ROOT/backup.sh" prod "before-${SHA:0:7}-was-${PREVIOUS:0:7}"
fi

echo "== migrations"
dc "$ENV" run --rm migrate
if [ "$ENV" = staging ]; then
  # Invented contacts for the demo account; skipped when they are already there.
  dc "$ENV" run --rm seed
fi

echo "== app"
dc "$ENV" up -d app
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$APP_PORT/api/health" >/dev/null 2>&1; then
    echo "$SHA" >"$DIR/current"
    echo "$(date -Iseconds) $SHA" >>"$DIR/history"
    # Unused images older than two weeks; a rollback pulls from GHCR anyway.
    docker image prune -af --filter until=336h >/dev/null
    echo "== $ENV is on ${SHA:0:7}"
    exit 0
  fi
  sleep 2
done
echo "App did not become healthy on $ENV" >&2
dc "$ENV" logs --tail 30 app >&2
exit 1
