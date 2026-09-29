#!/usr/bin/env bash
# prune-images.sh - remove old app images from the server, but never the last
# 3 prod versions: a rollback must not depend on what GHCR still keeps.
# Runs after every deploy. PRUNE_AGE_DAYS=0 removes every unprotected image.
source /opt/crm/lib.sh
REPO=ghcr.io/ggender/personal-crm-vibecheck
AGE_DAYS=${PRUNE_AGE_DAYS:-14}

# Newest first, each SHA once: the current prod version and the two before it.
protected=$(tac "$CRM_ROOT/prod/history" 2>/dev/null | awk '!seen[$2]++ {print $2}' | head -3)
protected="$protected $(cat "$CRM_ROOT/staging/current" 2>/dev/null || true)"
cutoff=$(date -d "-$AGE_DAYS days" +%s)

for tag in $(docker images "$REPO" --format '{{.Tag}}'); do
  case " $protected " in *" $tag "*) continue ;; esac
  created=$(date -d "$(docker image inspect -f '{{.Created}}' "$REPO:$tag")" +%s)
  if [ "$created" -lt "$cutoff" ]; then
    # Fails, and is skipped, for an image a container still uses.
    docker rmi "$REPO:$tag" >/dev/null 2>&1 && echo "== removed image ${tag:0:7}" || true
  fi
done
# Layers left without a tag.
docker image prune -f >/dev/null
