#!/bin/bash
# Glass Quizzes - Project Snapshot Script
# Creates archive of critical project files (not code, just configs/docs)
# Usage: ./scripts/snapshot.sh

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SNAPSHOT_FILE="$BACKUP_DIR/snapshot_${TIMESTAMP}.tar.gz"
MAX_SNAPSHOTS=10

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "📸 Creating project snapshot..."

# Files to include in snapshot
FILES_TO_SNAPSHOT=(
    "CLAUDE.md"
    ".env.example"
    "docker-compose.yml"
    "package.json"
    "package-lock.json"
    "tsconfig.json"
    "vite.config.ts"
    "tailwind.config.ts"
    "supabase/config.toml"
    "supabase/migrations"
)

# Create temp directory for snapshot
TEMP_DIR=$(mktemp -d)
SNAPSHOT_NAME="glass-quizzes-snapshot-${TIMESTAMP}"
mkdir -p "$TEMP_DIR/$SNAPSHOT_NAME"

# Copy files
for item in "${FILES_TO_SNAPSHOT[@]}"; do
    if [ -e "$item" ]; then
        # Preserve directory structure
        dir=$(dirname "$item")
        mkdir -p "$TEMP_DIR/$SNAPSHOT_NAME/$dir"
        cp -r "$item" "$TEMP_DIR/$SNAPSHOT_NAME/$dir/" 2>/dev/null || true
    fi
done

# Add git info
git log -1 --format="Commit: %H%nDate: %ci%nMessage: %s" > "$TEMP_DIR/$SNAPSHOT_NAME/GIT_INFO.txt" 2>/dev/null || echo "Not a git repo" > "$TEMP_DIR/$SNAPSHOT_NAME/GIT_INFO.txt"
git branch --show-current >> "$TEMP_DIR/$SNAPSHOT_NAME/GIT_INFO.txt" 2>/dev/null || true

# Create archive
tar -czf "$SNAPSHOT_FILE" -C "$TEMP_DIR" "$SNAPSHOT_NAME"

# Cleanup
rm -rf "$TEMP_DIR"

echo "✅ Snapshot created: $SNAPSHOT_FILE"

# Rotate old snapshots
echo "🔄 Rotating old snapshots (keeping last $MAX_SNAPSHOTS)..."
cd "$BACKUP_DIR"
ls -t snapshot_*.tar.gz 2>/dev/null | tail -n +$((MAX_SNAPSHOTS + 1)) | xargs -r rm -f
cd - > /dev/null

echo ""
echo "Snapshot contents:"
tar -tzf "$SNAPSHOT_FILE" | head -20
