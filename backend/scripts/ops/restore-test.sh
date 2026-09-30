#!/usr/bin/env bash
set -euo pipefail
: "${RESTORE_TEST_DATABASE_URL:?RESTORE_TEST_DATABASE_URL is required}"
: "${1:?Pass a .dump file as the first argument}"
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$RESTORE_TEST_DATABASE_URL" "$1"
psql "$RESTORE_TEST_DATABASE_URL" -c 'select count(*) as product_count from "Product";'
printf 'Restore test completed.\n'
