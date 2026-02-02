#!/bin/bash
# Glass Quizzes - Database Restore Script
# Usage: ./scripts/restore-db.sh [backup_file.sql.gz]

set -e

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

BACKUP_DIR="./backups"

# Get backup file
if [ -n "$1" ]; then
    BACKUP_FILE="$1"
else
    # Use latest backup
    BACKUP_FILE=$(ls -t "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null | head -1)
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: No backup file found"
    echo "   Usage: ./scripts/restore-db.sh [backup_file.sql.gz]"
    echo ""
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "   No backups in $BACKUP_DIR"
    exit 1
fi

echo "⚠️  WARNING: This will OVERWRITE the current database!"
echo "   Backup file: $BACKUP_FILE"
echo ""
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Restore cancelled"
    exit 0
fi

# Check if docker container is running
if ! docker ps | grep -q glass-quizzes-db; then
    echo "❌ Error: glass-quizzes-db container is not running"
    echo "   Run: docker-compose up -d"
    exit 1
fi

echo "🔄 Restoring database from $BACKUP_FILE..."

# Drop and recreate database
docker exec glass-quizzes-db psql -U postgres -c "DROP DATABASE IF EXISTS glass_quizzes;"
docker exec glass-quizzes-db psql -U postgres -c "CREATE DATABASE glass_quizzes;"

# Restore from backup
gunzip -c "$BACKUP_FILE" | docker exec -i glass-quizzes-db psql -U postgres glass_quizzes

echo "✅ Database restored successfully!"
