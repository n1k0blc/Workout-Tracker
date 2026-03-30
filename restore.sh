#!/bin/bash

# Restore database from backup
# Usage: ./restore.sh backup_file.sql.gz

set -e

if [ -z "$1" ]; then
    echo "❌ Error: No backup file specified"
    echo "Usage: ./restore.sh backup_file.sql.gz"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${RED}⚠️  WARNING: This will overwrite the current database!${NC}"
echo "Backup file: $BACKUP_FILE"
read -p "Are you sure? (yes/no): " -r
echo

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Restore cancelled."
    exit 0
fi

echo -e "${YELLOW}🔄 Restoring database...${NC}"

# Decompress and restore
gunzip -c "$BACKUP_FILE" | docker exec -i workout-tracker-db-prod psql -U workoutuser -d workout_tracker

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database restored successfully!${NC}"
else
    echo -e "${RED}❌ Restore failed!${NC}"
    exit 1
fi

# Restart backend to apply changes
echo -e "${YELLOW}🔄 Restarting backend...${NC}"
docker compose -f docker-compose.prod.yml restart backend

echo -e "${GREEN}✅ Restore complete!${NC}"
