#!/bin/bash
set -e

BACKUP_DIR="$HOME/backups/workout-tracker"
DATE=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=30

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🗄️  Starting database backup...${NC}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup database
echo "Creating backup: db_backup_$DATE.sql.gz"
docker exec workout-tracker-db-prod pg_dump -U workoutuser workout_tracker | gzip > "$BACKUP_DIR/db_backup_$DATE.sql.gz"

# Check if backup was successful
if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/db_backup_$DATE.sql.gz" | cut -f1)
    echo -e "${GREEN}✅ Backup created successfully: $BACKUP_SIZE${NC}"
    echo "📁 Location: $BACKUP_DIR/db_backup_$DATE.sql.gz"
else
    echo "❌ Backup failed!"
    exit 1
fi

# Clean up old backups
echo -e "${YELLOW}🧹 Cleaning up old backups (older than $KEEP_DAYS days)...${NC}"
DELETED=$(find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$KEEP_DAYS -delete -print | wc -l)
echo "Deleted $DELETED old backup(s)"

# List recent backups
echo ""
echo "📋 Recent backups:"
ls -lh "$BACKUP_DIR" | tail -5

echo -e "${GREEN}✅ Backup complete!${NC}"
