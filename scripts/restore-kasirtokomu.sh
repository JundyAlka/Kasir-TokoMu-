#!/bin/bash
set -e

# ==============================================================================
# Kasir TokoMu - Restore Database Script
# Usage: sudo restore-kasirtokomu.sh [/path/to/backup.sql.gz]
# If no argument is provided, restores from /var/backups/kasirtokomu/latest.sql.gz
# ==============================================================================

BACKUP_FILE="${1:-/var/backups/kasirtokomu/latest.sql.gz}"
DB_NAME="kasirtokomu"
DB_USER="postgres"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "========================================================"
echo "⚠️  WARNING: Restoring will overwrite database: ${DB_NAME}"
echo "Using backup: ${BACKUP_FILE}"
echo "========================================================"

if [ -t 0 ]; then
  read -p "Are you sure you want to proceed? (y/N): " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Restore cancelled."
    exit 0
  fi
fi

echo "[1/3] Terminating active connections to ${DB_NAME}..."
sudo -u "${DB_USER}" psql -d postgres -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();
" >/dev/null 2>&1 || true

echo "[2/3] Re-creating clean database ${DB_NAME}..."
sudo -u "${DB_USER}" dropdb --if-exists "${DB_NAME}"
sudo -u "${DB_USER}" createdb -O kasiruser "${DB_NAME}"

echo "[3/3] Restoring data from ${BACKUP_FILE}..."
gunzip -c "${BACKUP_FILE}" | sudo -u "${DB_USER}" psql -d "${DB_NAME}" -q

echo "Restarting application..."
pm2 restart kasir-app >/dev/null 2>&1 || true

echo "✅ Database restore completed successfully!"
