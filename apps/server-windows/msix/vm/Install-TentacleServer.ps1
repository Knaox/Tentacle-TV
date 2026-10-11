<#
  Installe (ou retire) le paquet d'ESSAI de Tentacle Server dans une VM.
  A lancer DANS LA VM, en PowerShell administrateur, jamais sur le poste de
  developpement : le certificat autosigne entre dans les "Personnes autorisees"
  de l'ordinateur.

    .\Install-TentacleServer.ps1              # installe
    .\Install-TentacleServer.ps1 -Uninstall   # retire le paquet ET le certificat

  Le dossier doit contenir le *-vm.msix et tentacle-server-dev.cer produits par
  "pnpm --filter @tentacle-tv/server-windows sign:dev".
  Les donnees (%ProgramData%\Tentacle Server) ne sont JAMAIS touchees ici.
  Fichier en ASCII seul : Windows PowerShell 5.1 lit un .ps1 sans BOM en ANSI.
#>
param(
  [string]$Folder = $PSScriptRoot,
  [switch]$Uninstall
)
$ErrorActionPreference = 'Stop'
$name = 'TentacleServer.Dev'
$cerPath = Join-Path $Folder 'tentacle-server-dev.cer'
$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 $cerPath

if ($Uninstall) {
  Get-AppxPackage -Name $name | Remove-AppxPackage
  Get-ChildItem Cert:\LocalMachine\TrustedPeople | Where-Object Thumbprint -eq $cert.Thumbprint | Remove-Item
  Write-Host "Paquet et certificat retires. Les donnees restent dans $env:ProgramData\Tentacle Server."
  return
}

$msix = Get-ChildItem $Folder -Filter '*-vm.msix' | Select-Object -First 1
if ($null -eq $msix) { throw "Aucun *-vm.msix dans $Folder" }
Import-Certificate -FilePath $cerPath -CertStoreLocation Cert:\LocalMachine\TrustedPeople | Out-Null
Add-AppxPackage -Path $msix.FullName
Get-AppxPackage -Name $name | Select-Object Name, Version, InstallLocation | Format-List
Write-Host 'Lancer Tentacle Server depuis le menu Demarrer, puis suivre README.md (liste des essais).'
