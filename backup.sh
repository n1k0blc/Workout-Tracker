#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/workout-tracker}"
KEEP_DAYS="${KEEP_DAYS:-30}"
MIN_KEEP="${MIN_KEEP:-7}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Deletes backups older than $2 days, but always leaves the $3 most recent
# ones in place regardless of age, so a run after a long gap can't wipe the
# whole archive down to just the dump it created moments ago.
rotate_backups() {
    local dir="$1"
    local keep_days="$2"
    local min_keep="$3"
    local deleted=0
    local index=0
    local file

    while IFS= read -r file; do
        index=$((index + 1))
        if [ "$index" -le "$min_keep" ]; then
            continue
        fi
        if [ -n "$(find "$file" -mtime +"$keep_days" 2>/dev/null)" ]; then
            rm -f "$file"
            deleted=$((deleted + 1))
        fi
    done < <(ls -1t "$dir"/*.sql.gz 2>/dev/null)

    echo "$deleted"
}

main() {
    echo -e "${YELLOW}🗄️  Starting database backup...${NC}"

    mkdir -p "$BACKUP_DIR"

    local date
    date=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/db_backup_$date.sql.gz"

    echo "Creating backup: db_backup_$date.sql.gz"

    if ! docker exec workout-tracker-db-prod pg_dump -U workoutuser workout_tracker | gzip > "$backup_file"; then
        echo -e "${RED}❌ Backup failed!${NC}"
        rm -f "$backup_file"
        exit 1
    fi

    if [ ! -s "$backup_file" ] || ! gzip -t "$backup_file" 2>/dev/null; then
        echo -e "${RED}❌ Backup is empty or corrupt!${NC}"
        rm -f "$backup_file"
        exit 1
    fi

    local backup_size
    backup_size=$(du -h "$backup_file" | cut -f1)
    echo -e "${GREEN}✅ Backup created successfully: $backup_size${NC}"
    echo "📁 Location: $backup_file"

    echo -e "${YELLOW}🧹 Cleaning up old backups (older than $KEEP_DAYS days, keeping at least $MIN_KEEP most recent)...${NC}"
    local deleted
    deleted=$(rotate_backups "$BACKUP_DIR" "$KEEP_DAYS" "$MIN_KEEP")
    echo "Deleted $deleted old backup(s)"

    echo ""
    echo "📋 Recent backups:"
    ls -lh "$BACKUP_DIR" | tail -5

    echo -e "${GREEN}✅ Backup complete!${NC}"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
