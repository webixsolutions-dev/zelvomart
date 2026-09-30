#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/zelvomart-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --file="$FILE"
find "$BACKUP_DIR" -type f -name 'zelvomart-*.dump' -mtime +30 -delete
printf 'Backup written to %s\n' "$FILE"
