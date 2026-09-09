#!/bin/bash
# Weekly Open Food Facts delta sync (#150). Runs the sync inside the backend container and
# keeps the last-run marker on the host, so the container itself stays stateless.
#
#   ./sync-off-foods.sh              # apply every delta published since the last run
#   ./sync-off-foods.sh --dry-run    # report the counts, write nothing, leave the marker
#
# Scheduled by install-off-sync-cron.sh for Sundays at 04:00, after the 03:00 backup.
set -euo pipefail

CONTAINER="${CONTAINER:-workout-tracker-backend-prod}"
STATE_FILE="${STATE_FILE:-$HOME/logs/off-sync.state}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# The marker is the end of the newest delta window already applied, in unix seconds. A
# missing or corrupted file is not an error: the sync falls back to the newest lastSyncedAt
# in the library, which is when the bulk import last wrote a row.
read_marker() {
    local file="$1"
    local value
    value=$(head -n 1 "$file" 2>/dev/null | tr -d '[:space:]')
    if [[ "$value" =~ ^[0-9]+$ ]]; then
        echo "$value"
    fi
}

# The marker the sync printed as its last line, or nothing: a dry run prints none, and a run
# that found no index to read prints none either.
extract_marker() {
    sed -n 's/^off-sync-marker \([0-9][0-9]*\)$/\1/p' | tail -n 1
}

main() {
    local args=("$@")
    local since
    since=$(read_marker "$STATE_FILE")

    if [ -n "$since" ]; then
        args+=(--since "$since")
        echo -e "${YELLOW}🌍 Syncing Open Food Facts deltas since $since ($(date -r "$since" 2>/dev/null || date -d "@$since"))...${NC}"
    else
        echo -e "${YELLOW}🌍 Syncing Open Food Facts deltas, no marker in $STATE_FILE yet...${NC}"
    fi

    local output
    output=$(mktemp)
    # shellcheck disable=SC2064 # $output is expanded now on purpose, it never changes
    trap "rm -f '$output'" EXIT

    # ${args[@]+...} because an unflagged first run leaves the array empty, and `set -u`
    # treats an empty array as unbound on older bash.
    if ! docker exec "$CONTAINER" node dist/src/foods/off-sync.js "${args[@]+${args[@]}}" \
        >"$output" 2>&1; then
        cat "$output"
        echo -e "${RED}❌ Sync failed. The marker was left untouched, so the next run retries this window.${NC}"
        exit 1
    fi
    cat "$output"

    local marker
    marker=$(extract_marker <"$output")
    if [ -z "$marker" ]; then
        echo -e "${YELLOW}⚠️  No marker reported; leaving $STATE_FILE as it is.${NC}"
        return 0
    fi

    mkdir -p "$(dirname "$STATE_FILE")"
    echo "$marker" >"$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
    echo -e "${GREEN}✅ Sync complete. Marker advanced to $marker.${NC}"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
