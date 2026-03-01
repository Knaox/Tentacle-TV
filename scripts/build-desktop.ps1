# ═══════════════════════════════════════════════════════
# Tentacle TV — Interactive Desktop Build & Release
# Build localement puis publie sur GitHub Releases
# ═══════════════════════════════════════════════════════
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

# ── Lire la version actuelle depuis tauri.conf.json ──
$TauriConf = Get-Content "apps\desktop\src-tauri\tauri.conf.json" -Raw | ConvertFrom-Json
$CurrentVersion = $TauriConf.version

# Pre-calculer les versions (strip pre-release suffix like -beta, -rc1)
$SemverBase = ($CurrentVersion -split "-")[0]
$Parts = $SemverBase.Split(".")
$Major = [int]$Parts[0]
$Minor = [int]$Parts[1]
$Patch = [int]$Parts[2]

$VerPatch = "$Major.$Minor.$($Patch + 1)"
$VerMinor = "$Major.$($Minor + 1).0"
$VerMajor = "$($Major + 1).0.0"

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host "    Tentacle TV -- Desktop Release" -ForegroundColor Cyan
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Version actuelle : " -NoNewline; Write-Host "v$CurrentVersion" -ForegroundColor Yellow
Write-Host ""

# ── Choix de la version ──
Write-Host "Quelle version veux-tu release ?" -ForegroundColor White
Write-Host "  [1] Garder la version actuelle (v$CurrentVersion)" -ForegroundColor Gray
Write-Host "  [2] Patch  (v$VerPatch)" -ForegroundColor Gray
Write-Host "  [3] Minor  (v$VerMinor)" -ForegroundColor Gray
Write-Host "  [4] Major  (v$VerMajor)" -ForegroundColor Gray
Write-Host "  [5] Saisir manuellement" -ForegroundColor Gray
Write-Host ""

$Choice = Read-Host "Choix [1-5]"

switch ($Choice) {
    "1" { $NewVersion = $CurrentVersion }
    "2" { $NewVersion = $VerPatch }
    "3" { $NewVersion = $VerMinor }
    "4" { $NewVersion = $VerMajor }
    "5" {
        $NewVersion = Read-Host "Entrer la version (ex: 1.0.0)"
        $NewVersion = $NewVersion -replace "^v", ""
    }
    default {
        Write-Host "Choix invalide, on garde v$CurrentVersion" -ForegroundColor Yellow
        $NewVersion = $CurrentVersion
    }
}

Write-Host ""
Write-Host "Version selectionnee : " -NoNewline; Write-Host "v$NewVersion" -ForegroundColor Green
Write-Host ""

# ── Mettre a jour les versions si changement ──
if ($NewVersion -ne $CurrentVersion) {
    Write-Host "[0/5] Mise a jour des versions..." -ForegroundColor Cyan

    # apps/desktop/package.json
    $DesktopPkgPath = Join-Path $Root "apps\desktop\package.json"
    if (Test-Path $DesktopPkgPath) {
        $Content = Get-Content $DesktopPkgPath -Raw
        $Content = $Content -replace '"version":\s*"[^"]*"', "`"version`": `"$NewVersion`""
        Set-Content $DesktopPkgPath $Content -NoNewline
        Write-Host "  Updated apps\desktop\package.json" -ForegroundColor DarkGray
    }

    # tauri.conf.json
    $TauriConfPath = Join-Path $Root "apps\desktop\src-tauri\tauri.conf.json"
    $Content = Get-Content $TauriConfPath -Raw
    $Content = $Content -replace '"version":\s*"[^"]*"', "`"version`": `"$NewVersion`""
    Set-Content $TauriConfPath $Content -NoNewline
    Write-Host "  Updated tauri.conf.json" -ForegroundColor DarkGray

    # Cargo.toml — uniquement la version du [package], pas des dependances
    $CargoPath = Join-Path $Root "apps\desktop\src-tauri\Cargo.toml"
    $Content = Get-Content $CargoPath -Raw
    $Content = $Content -replace '(?m)(^\s*name\s*=\s*"tentacle-desktop"\s*\r?\n)\s*version\s*=\s*"[^"]*"', "`$1version = `"$NewVersion`""
    Set-Content $CargoPath $Content -NoNewline
    Write-Host "  Updated Cargo.toml" -ForegroundColor DarkGray

    Write-Host "  Toutes les versions desktop mises a jour en v$NewVersion" -ForegroundColor Green
    Write-Host ""
}

# ── Confirmation ──
Write-Host "Actions qui vont etre executees :" -ForegroundColor White
Write-Host "  1. Build du frontend web" -ForegroundColor Gray
Write-Host "  2. Build Tauri desktop (MSI + NSIS)" -ForegroundColor Gray
Write-Host "  3. Commit + tag v$NewVersion" -ForegroundColor Gray
Write-Host "  4. Push sur GitHub (declenche le workflow release)" -ForegroundColor Gray
Write-Host ""

$Confirm = Read-Host "Continuer ? [O/n]"
if ($Confirm -match "^[nN]") {
    Write-Host "Annule." -ForegroundColor Yellow
    exit 0
}

Write-Host ""

# ── Build ──
Write-Host "[1/4] Installation des dependances..." -ForegroundColor Cyan
pnpm install

Write-Host "[2/4] Build du frontend web..." -ForegroundColor Cyan
pnpm --filter @tentacle-tv/web build

Write-Host "[3/4] Build Tauri desktop..." -ForegroundColor Cyan
pnpm --filter @tentacle-tv/desktop build

# ── Copie locale dans Builds/ ──
$BuildsDir = Join-Path $Root "Builds"
if (-not (Test-Path $BuildsDir)) { New-Item -ItemType Directory -Path $BuildsDir | Out-Null }

$TauriOutput = Join-Path $Root "apps\desktop\src-tauri\target\release\bundle"
$Artifacts = @()

if (Test-Path "$TauriOutput\nsis\*.exe") {
    Get-ChildItem "$TauriOutput\nsis\*.exe" | ForEach-Object {
        Copy-Item $_.FullName (Join-Path $BuildsDir $_.Name) -Force
        $Artifacts += $_.FullName
    }
}
if (Test-Path "$TauriOutput\msi\*.msi") {
    Get-ChildItem "$TauriOutput\msi\*.msi" | ForEach-Object {
        Copy-Item $_.FullName (Join-Path $BuildsDir $_.Name) -Force
        $Artifacts += $_.FullName
    }
}

Write-Host "  Copie locale dans $BuildsDir" -ForegroundColor DarkGray

# ── Git commit + tag + push ──
Write-Host "[4/4] Commit, tag et push v$NewVersion..." -ForegroundColor Cyan

git add -A

# Verifier s'il y a des changements a commiter
$StatusOutput = git status --porcelain
if ($StatusOutput) {
    git commit -m "release: desktop v$NewVersion"
    Write-Host "  Commit cree" -ForegroundColor DarkGray
} else {
    Write-Host "  Rien a commiter" -ForegroundColor DarkGray
}

# Supprimer le tag s'il existe deja (ignorer les erreurs)
$ErrorActionPreference = "SilentlyContinue"
git tag -d "v$NewVersion" 2>$null
git push origin --delete "v$NewVersion" 2>$null
$ErrorActionPreference = "Stop"

git tag "v$NewVersion"
Write-Host "  Tag v$NewVersion cree" -ForegroundColor DarkGray

git push origin main
git push origin "v$NewVersion"
Write-Host "  Push sur origin OK" -ForegroundColor Green
Write-Host "  Le workflow GitHub Actions va builder et creer le draft release" -ForegroundColor DarkGray

# ── Resume ──
Write-Host ""
Write-Host "  ========================================" -ForegroundColor Green
Write-Host "    Release v$NewVersion terminee !" -ForegroundColor Green
Write-Host "  ========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Local   : $BuildsDir" -ForegroundColor White
Write-Host "  GitHub  : https://github.com/Knaox/Tentacle-TV/releases" -ForegroundColor White
Write-Host "  Actions : https://github.com/Knaox/Tentacle-TV/actions" -ForegroundColor White
Write-Host ""
