#!/bin/bash
# Glass Quizzes - Milestone Script
# Creates backup, snapshot, and git commit with tag
# Usage: ./scripts/milestone.sh "v0.1" "Milestone description"

set -e

VERSION=${1:-"v$(date +%Y%m%d)"}
MESSAGE=${2:-"Milestone $VERSION"}

echo "🚀 Creating milestone: $VERSION"
echo "   Message: $MESSAGE"
echo ""

# 1. Run backup (if database is running)
echo "1️⃣ Running database backup..."
if docker ps | grep -q glass-quizzes-db; then
    ./scripts/backup-db.sh || echo "⚠️  Backup skipped (no database running)"
else
    echo "⚠️  Skipping backup (database not running)"
fi

# 2. Run snapshot
echo ""
echo "2️⃣ Creating snapshot..."
./scripts/snapshot.sh

# 3. Git operations
echo ""
echo "3️⃣ Git commit and tag..."

# Check for uncommitted changes
if ! git diff --quiet HEAD 2>/dev/null; then
    git add -A
    git commit -m "$MESSAGE"
    echo "✅ Committed changes"
else
    echo "ℹ️  No changes to commit"
fi

# Create tag
git tag -a "$VERSION" -m "$MESSAGE" 2>/dev/null || echo "⚠️  Tag $VERSION already exists"

echo ""
echo "✅ Milestone $VERSION complete!"
echo ""
echo "To push: git push origin main --tags"
