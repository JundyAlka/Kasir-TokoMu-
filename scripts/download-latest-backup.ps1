# ==============================================================================
# Kasir TokoMu - Download Latest Database Backup from VPS to Laptop
# Usage: powershell -File .\scripts\download-latest-backup.ps1
# ==============================================================================

$SSH_KEY = "C:\Users\Acer\.ssh\id_vps_kasir"
$VPS_HOST = "ubuntu@101.32.245.240"
$REMOTE_BACKUP = "/var/backups/kasirtokomu/latest.sql.gz"
$BACKUP_DIR = "d:\project\Kasir TokoMu\backups"

if (!(Test-Path -Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null
}

$TIMESTAMP = Get-Date -Format "yyyy-MM-dd_HHmmss"
$LOCAL_DEST = "$BACKUP_DIR\kasirtokomu_$TIMESTAMP.sql.gz"

Write-Host "[INFO] Mengunduh backup database terbaru dari VPS ($VPS_HOST)..." -ForegroundColor Cyan

scp -i $SSH_KEY "$VPS_HOST`:$REMOTE_BACKUP" "$LOCAL_DEST"

if ($LASTEXITCODE -eq 0 -and (Test-Path $LOCAL_DEST)) {
    $SIZE = (Get-Item $LOCAL_DEST).Length / 1MB
    Write-Host "[SUKSES] Backup berhasil diunduh ke laptop Anda!" -ForegroundColor Green
    Write-Host "  Lokasi File : $LOCAL_DEST" -ForegroundColor Yellow
    Write-Host "  Ukuran File : $([math]::Round($SIZE, 2)) MB" -ForegroundColor Yellow
} else {
    Write-Host "[GAGAL] Tidak dapat mengunduh backup dari VPS." -ForegroundColor Red
}
