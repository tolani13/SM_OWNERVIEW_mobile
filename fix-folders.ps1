# Run from the Studio Maestro_Full root folder
$root = Get-Location
$targets = @("server", "client", "script", "shared", "git")

foreach ($name in $targets) {
    $outer = Join-Path $root $name
    $inner = Join-Path $outer $name

    if (Test-Path $inner -PathType Container) {
        Write-Host "Fixing nested folder: $name\$name"
        Get-ChildItem $inner | Move-Item -Destination $outer -Force
        Remove-Item $inner -Recurse -Force
    } else {
        Write-Host "No nested folder for $name"
    }
}
