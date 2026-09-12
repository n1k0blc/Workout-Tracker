#!/bin/bash
# One-time setup: schedules sync-off-foods.sh to run daily via cron (#150).
# Run this once on the production host (the Pi), not in CI or on a dev machine.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNC_SCRIPT="$REPO_DIR/sync-off-foods.sh"
LOG_DIR="$HOME/logs"
LOG_FILE="$LOG_DIR/off-sync.log"
# Daily, because Open Food Facts publishes one delta a day and the windows are contiguous:
# seven daily runs download exactly the same files as one weekly run, so daily costs no extra
# bandwidth and keeps the library hours behind instead of a week. It also doubles the slack
# against the ~13 days of history kept -- a missed run is covered by tomorrow's rather than
# eating into a six-day margin.
#
# 09:00 rather than the small hours: the deltas appear around 06:10 UTC (06:06-06:31 observed),
# and 09:00 Berlin is 07:00 UTC in summer, 08:00 in winter -- safely past publication either
# way, where 04:00 would run before the file it is meant to fetch even exists. Still well after
# the 03:00 backup, so a sync that goes wrong is covered by a dump taken before it ran.
CRON_LINE="0 9 * * * $SYNC_SCRIPT >> $LOG_FILE 2>&1"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

mkdir -p "$LOG_DIR"

if crontab -l 2>/dev/null | grep -qF "$SYNC_SCRIPT"; then
    echo -e "${YELLOW}⚠️  A crontab entry for $SYNC_SCRIPT already exists. Leaving it untouched.${NC}"
    crontab -l | grep -F "$SYNC_SCRIPT"
    exit 0
fi

(crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -

echo -e "${GREEN}✅ Scheduled sync-off-foods.sh to run daily at 09:00.${NC}"
echo "Crontab entry: $CRON_LINE"
echo "Sync output lands in: $LOG_FILE"
echo "Last-run marker: $LOG_DIR/off-sync.state"
echo ""
echo "Verify with: crontab -l"
echo "Try it first with: $SYNC_SCRIPT --dry-run"
