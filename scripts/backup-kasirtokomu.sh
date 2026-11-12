#!/bin/bash
set -e

# ==============================================================================
# Kasir TokoMu - Automated Database Backup Script
# - Uses pg_dump with snapshot isolation (Zero downtime / Non-blocking)
# - Runs with lowest CPU and I/O priority (nice + ionice) to prevent web lags
# - Compresses with gzip (reduces 19 MB to ~2 MB)
# - Retains backups for 90 days (auto-clean old files)
# - Updates 'latest.sql.gz' symlink
# ==============================================================================

BACKUP_DIR="/var/backups/kasirtokomu"
LOG_FILE="/var/log/kasir-backup.log"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/kasirtokomu_${TIMESTAMP}.sql.gz"
LATEST_LINK="${BACKUP_DIR}/latest.sql.gz"
DB_NAME="kasirtokomu"
DB_USER="postgres"
RETENTION_DAYS=90

echo "--------------------------------------------------------"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting automated backup for: ${DB_NAME}"

# Ensure backup dir exists
mkdir -p "${BACKUP_DIR}"

# Run pg_dump with background priority (nice 19 and ionice idle)
# pg_dump does NOT lock tables; web kasir operations continue uninterrupted
nice -n 19 ionice -c 3 sudo -u "${DB_USER}" pg_dump \
  --dbname="${DB_NAME}" \
  --format=plain \
  --no-owner \
  --no-privileges \
  | gzip -9 > "${BACKUP_FILE}"

# Secure file permissions
chmod 600 "${BACKUP_FILE}"

# Update latest symlink
ln -sf "${BACKUP_FILE}" "${LATEST_LINK}"

# Calculate file size
FILE_SIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup successfully created:"
echo "  File: ${BACKUP_FILE} (${FILE_SIZE})"

# Auto-cleanup backups older than retention days
DELETED_COUNT=$(find "${BACKUP_DIR}" -type f -name "kasirtokomu_*.sql.gz" -mtime +${RETENTION_DAYS} 2>/dev/null | wc -l)
if [ "${DELETED_COUNT}" -gt 0 ]; then
  find "${BACKUP_DIR}" -type f -name "kasirtokomu_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaned up ${DELETED_COUNT} backup(s) older than ${RETENTION_DAYS} days."
fi

TOTAL_BACKUPS=$(ls -1 "${BACKUP_DIR}"/kasirtokomu_*.sql.gz 2>/dev/null | wc -l)
TOTAL_STORAGE=$(du -sh "${BACKUP_DIR}" | awk '{print $1}')
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Current total backups: ${TOTAL_BACKUPS} (Total storage: ${TOTAL_STORAGE})"
echo "Backup finished successfully."
echo "--------------------------------------------------------"
