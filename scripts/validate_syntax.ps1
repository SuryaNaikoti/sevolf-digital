$errors = $null
$tokens = $null
$path = (Resolve-Path 'supabase\apply_phase1c_migrations.ps1').Path
$ast = [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors)

if ($errors.Count -gt 0) {
    Write-Host "SYNTAX ERRORS DETECTED ($($errors.Count)):"
    foreach ($err in $errors) {
        Write-Host "Line $($err.Extent.StartLineNumber): $($err.Message)"
    }
    exit 1
} else {
    Write-Host "POWERSHELL_SYNTAX_VALIDATION_PASSED"
    Write-Host "File verified: $path"
    Write-Host "Total tokens parsed: $($tokens.Count)"
    exit 0
}
