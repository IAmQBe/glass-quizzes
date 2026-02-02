#!/bin/bash
# Glass Quizzes - Database Backup Script
# Usage: ./scripts/backup-db.sh [local|supabase]

set -e

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
MAX_BACKUPS=14  # Keep last 14 backups

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

MODE=${1:-local}

if [ "$MODE" = "supabase" ]; then
    echo "📦 Backing up Supabase database..."
    # For Supabase, you need to use their CLI or connection string
    # supabase db dump > "$BACKUP_DIR/supabase_${TIMESTAMP}.sql"
    echo "⚠️  Supabase backup requires 'supabase' CLI. Use: supabase db dump"
    exit 1
else
    echo "📦 Backing up local Postgres database..."
    
    # Check if docker container is running
    if ! docker ps | grep -q glass-quizzes-db; then
        echo "❌ Error: glass-quizzes-db container is not running"
        echo "   Run: docker-compose up -d"
        exit 1
    fi
    
    BACKUP_FILE="$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
    
    # Dump and compress
    docker exec glass-quizzes-db pg_dump -U postgres glass_quizzes | gzip > "$BACKUP_FILE"
    
    echo "✅ Backup created: $BACKUP_FILE"
fi

# Rotate old backups (keep only last MAX_BACKUPS)
echo "🔄 Rotating old backups (keeping last $MAX_BACKUPS)..."
cd "$BACKUP_DIR"
ls -t db_*.sql.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm -f
cd - > /dev/null

echo "✅ Backup complete!"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -5 || echo "No backups found"
