#!/bin/bash
# One-time setup: schedules backup.sh to run daily via cron.
# Run this once on the production host (the Pi), not in CI or on a dev machine.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$REPO_DIR/backup.sh"
LOG_DIR="$HOME/logs"
LOG_FILE="$LOG_DIR/backup.log"
CRON_LINE="0 3 * * * $BACKUP_SCRIPT >> $LOG_FILE 2>&1"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

mkdir -p "$LOG_DIR"

if crontab -l 2>/dev/null | grep -qF "$BACKUP_SCRIPT"; then
    echo -e "${YELLOW}⚠️  A crontab entry for $BACKUP_SCRIPT already exists. Leaving it untouched.${NC}"
    crontab -l | grep -F "$BACKUP_SCRIPT"
    exit 0
fi

(crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -

echo -e "${GREEN}✅ Scheduled backup.sh to run daily at 03:00.${NC}"
echo "Crontab entry: $CRON_LINE"
echo "Backup failures/log output land in: $LOG_FILE"
echo ""
echo "Verify with: crontab -l"
