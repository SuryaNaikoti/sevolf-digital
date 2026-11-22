<#
.SYNOPSIS
    SEVOLF Phase 1C Database Migration Execution Script
.DESCRIPTION
    1. Verifies the pre-migration backup (or creates a fresh verified custom-format dump if truncated).
    2. Verifies the SHA-256 checksums of the two approved Phase 1C migrations.
    3. Verifies target database connectivity.
    4. Applies Migration 1 (20260220_phase1c_fulfilment_and_claims.sql) with ON_ERROR_STOP=1.
    5. Applies Migration 2 (20260220_phase1c_procedures.sql) with ON_ERROR_STOP=1.
    6. Dispatches PostgREST schema reload signal.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

# Define paths and tools
$pgBin = Join-Path $env:LOCALAPPDATA 'Programs\PostgreSQL\17\bin'
$psqlPath = Join-Path $pgBin 'psql.exe'
$pgDumpPath = Join-Path $pgBin 'pg_dump.exe'
$pgRestorePath = Join-Path $pgBin 'pg_restore.exe'

if (-not (Test-Path -Path $psqlPath)) {
    throw "psql.exe not found at path: $psqlPath"
}
if (-not (Test-Path -Path $pgDumpPath)) {
    throw "pg_dump.exe not found at path: $pgDumpPath"
}

$env:Path = "$pgBin;$env:Path"
$env:PGSSLMODE = 'require'

$hostName = 'aws-1-ap-southeast-1.pooler.supabase.com'
$port = '5432'
$user = 'postgres.kqoqdxoicqxulefnruvn'
$db = 'postgres'

Write-Host '=========================================================='
Write-Host 'SEVOLF - PHASE 1C DATABASE MIGRATION EXECUTION'
Write-Host "Target Host:    $hostName"
Write-Host "Target User:    $user"
Write-Host '=========================================================='

# Step 1: Pre-Execution Backup Verification (and Auto-Refresh if Truncated)
$backupPath = 'supabase\backups\staging_pg_dump_20261122_132508.dump'
$expectedBackupHash = '35DFE2A3F6589056BE48EA7B654D54A92BF611FC1EDFF6E4EAC772EA3390AA94'

$backupValid = $false
if (Test-Path -Path $backupPath) {
    $item = Get-Item -Path $backupPath
    if ($item.Length -gt 0) {
        $actualBackupHash = (Get-FileHash -Path $backupPath -Algorithm SHA256).Hash
        if ($actualBackupHash -eq $expectedBackupHash) {
            $backupValid = $true
            Write-Host "[OK] Existing backup verified: $backupPath"
            Write-Host "     SHA-256: $actualBackupHash ($($item.Length) bytes)"
        }
    }
}

if (-not $backupValid) {
    Write-Host "`n[NOTICE] Backup file at $backupPath is absent, truncated (0 bytes), or modified."
    Write-Host "Taking a fresh full custom-format (-Fc) pre-migration backup now..."
    
    $ts = Get-Date -Format 'yyyyMMdd_HHmmss'
    $freshBackupPath = "supabase\backups\staging_pg_dump_$ts.dump"
    
    & $pgDumpPath -h $hostName -p $port -U $user -d $db -Fc --no-owner --no-acl -f $freshBackupPath
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create pre-migration backup with pg_dump! Exit code: $LASTEXITCODE. Halting."
    }
    
    $freshItem = Get-Item -Path $freshBackupPath
    if ($freshItem.Length -le 1024) {
        throw "Fresh backup file size is suspicious ($($freshItem.Length) bytes). Halting."
    }
    
    $freshHash = (Get-FileHash -Path $freshBackupPath -Algorithm SHA256).Hash
    Write-Host "[OK] Fresh pre-migration backup created: $freshBackupPath"
    Write-Host "     Size:    $($freshItem.Length) bytes"
    Write-Host "     SHA-256: $freshHash"
    
    Write-Host 'Verifying backup catalog with pg_restore --list...'
    $list = & $pgRestorePath --list $freshBackupPath
    if ($LASTEXITCODE -ne 0 -or $list.Count -lt 100) {
        throw "Backup verification failed via pg_restore --list! Halting."
    }
    Write-Host "[OK] Backup catalog validated ($($list.Count) items)."
}

# Step 2: Migration Files Checksum Verification
$mig1 = 'supabase\migrations\20260220_phase1c_fulfilment_and_claims.sql'
$mig2 = 'supabase\migrations\20260220_phase1c_procedures.sql'

$expectedMig1Hash = 'F6D8A20F372688B8F2A449C28A05D66E8A97932C94B08604DBC942847516BC9E'
$expectedMig2Hash = 'DD4621742B1FC2F45ABD10F7A494F1A4AF10110E0D78E4DBDC266D901C544B84'

if (-not (Test-Path -Path $mig1)) {
    throw "Migration file 1 not found at: $mig1"
}
if (-not (Test-Path -Path $mig2)) {
    throw "Migration file 2 not found at: $mig2"
}

$actualMig1Hash = (Get-FileHash -Path $mig1 -Algorithm SHA256).Hash
$actualMig2Hash = (Get-FileHash -Path $mig2 -Algorithm SHA256).Hash

if ($actualMig1Hash -ne $expectedMig1Hash) {
    throw "Migration 1 checksum mismatch! Expected: $expectedMig1Hash, Actual: $actualMig1Hash"
}
if ($actualMig2Hash -ne $expectedMig2Hash) {
    throw "Migration 2 checksum mismatch! Expected: $expectedMig2Hash, Actual: $actualMig2Hash"
}

Write-Host "`n[OK] Migration 1 SHA-256 verified: $actualMig1Hash"
Write-Host "[OK] Migration 2 SHA-256 verified: $actualMig2Hash"

# Step 3: Verify target project and connection
Write-Host "`nTesting database connectivity and confirming database/user..."
$checkQuery = 'SELECT current_database(), current_user;'
$testConnOutput = & $psqlPath -h $hostName -p $port -U $user -d $db -v ON_ERROR_STOP=1 -t -c $checkQuery
if ($LASTEXITCODE -ne 0) {
    throw "Failed to connect to target database. psql exited with code: $LASTEXITCODE"
}
Write-Host "[OK] Connected successfully. Connection info: $testConnOutput"

# Step 4: Apply Migration 1
Write-Host "`n>>> Applying Migration 1: 20260220_phase1c_fulfilment_and_claims.sql..."
& $psqlPath -h $hostName -p $port -U $user -d $db -v ON_ERROR_STOP=1 -f $mig1
if ($LASTEXITCODE -ne 0) {
    throw "Migration 1 FAILED with exit code: $LASTEXITCODE. Halting execution immediately. Do NOT run Migration 2."
}
Write-Host "[SUCCESS] Migration 1 applied cleanly."

# Step 5: Apply Migration 2
Write-Host "`n>>> Applying Migration 2: 20260220_phase1c_procedures.sql..."
& $psqlPath -h $hostName -p $port -U $user -d $db -v ON_ERROR_STOP=1 -f $mig2
if ($LASTEXITCODE -ne 0) {
    throw "Migration 2 FAILED with exit code: $LASTEXITCODE. Halting execution immediately."
}
Write-Host "[SUCCESS] Migration 2 applied cleanly."

# Step 6: PostgREST Schema Reload
Write-Host "`nReloading PostgREST schema cache..."
$notifyQuery = "NOTIFY pgrst, 'reload schema';"
& $psqlPath -h $hostName -p $port -U $user -d $db -v ON_ERROR_STOP=1 -c $notifyQuery
if ($LASTEXITCODE -ne 0) {
    throw "PostgREST schema reload signal failed with exit code: $LASTEXITCODE"
}
Write-Host "[SUCCESS] PostgREST schema reload signal dispatched."

Write-Host "`n=========================================================="
Write-Host 'MIGRATIONS COMPLETED SUCCESSFULLY'
Write-Host '=========================================================='

