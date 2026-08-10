param (
    [string]$SourceDB = "backend\nms.sqlite",
    [string]$BackupDir = "backups",
    [int]$RetentionDays = 7
)

# Create backup directory if it doesn't exist
if (-not (Test-Path -Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
    Write-Host "Created backup directory: $BackupDir" -ForegroundColor Cyan
}

# Generate timestamped filename
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$Destination = Join-Path -Path $BackupDir -ChildPath "nms_backup_$Timestamp.sqlite"

# Copy the database file
try {
    Copy-Item -Path $SourceDB -Destination $Destination -Force
    Write-Host "Backup created successfully: $Destination" -ForegroundColor Green
}
catch {
    Write-Host "Failed to create backup. Error: $_" -ForegroundColor Red
    exit 1
}

# Cleanup old backups based on retention policy
Write-Host "Cleaning up backups older than $RetentionDays days..." -ForegroundColor Cyan
$OldBackups = Get-ChildItem -Path $BackupDir -Filter "nms_backup_*.sqlite" | Where-Object {
    $_.CreationTime -lt (Get-Date).AddDays(-$RetentionDays)
}

foreach ($Backup in $OldBackups) {
    Remove-Item -Path $Backup.FullName -Force
    Write-Host "Deleted old backup: $($Backup.Name)" -ForegroundColor Yellow
}

Write-Host "Backup process completed." -ForegroundColor Green
