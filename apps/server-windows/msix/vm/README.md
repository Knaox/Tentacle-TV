# Essai du paquet MSIX en VM

Le paquet ne s'installe JAMAIS sur le poste de développement : ni le paquet,
ni son certificat. Tout se passe dans une VM Windows jetable (Windows 11 24H2
de préférence, une seconde en Windows 10 22H2 si possible), avec un instantané
pris avant l'installation.

## 1. Sur le poste de développement

```bash
pnpm --filter @tentacle-tv/server-windows assemble -- --out <dossier>\pkg --version 1.0.0.0
pnpm --filter @tentacle-tv/server-windows pack:msix -- --dir <dossier>\pkg --msix <dossier>\TentacleServer-1.0.0.0.msix
pnpm --filter @tentacle-tv/server-windows sign:dev -- --msix <dossier>\TentacleServer-1.0.0.0.msix --out <dossier>\vm
```

Sans `--tv-client`, le client LG se construit depuis les sources ; s'il ne
compile pas, passer `--tv-client` vers un `apps/tv-webos/client/dist` déjà
construit. `sign:dev` fabrique un certificat autosigné (openssl) au sujet
`CN=Tentacle Server Dev`, sans rien poser dans un magasin de ce PC.

Copier dans la VM : le `*-vm.msix`, `tentacle-server-dev.cer` et
`Install-TentacleServer.ps1`, dans un même dossier.

## 2. Dans la VM

PowerShell **administrateur**, dans ce dossier :

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Install-TentacleServer.ps1
```

Pour tout retirer : `.\Install-TentacleServer.ps1 -Uninstall` (les données de
`%ProgramData%\Tentacle Server` restent, c'est voulu).

## 3. Ce qu'il faut éprouver

Chaque ligne dit ce qui est attendu. Noter ce qui diffère, avec le journal
(`%ProgramData%\Tentacle Server\logs\server-AAAA-MM-JJ.log`).

| # | Geste | Attendu |
|---|---|---|
| 1 | Lancer « Tentacle Server » depuis le menu Démarrer | Aucune fenêtre noire. Icône dans la zone de notification. L'assistant s'ouvre UNE fois dans le navigateur, sur l'adresse locale du PC (pas `localhost`). Journal : `hôte 1.0.0 — Node v24.21.0`. |
| 2 | `%ProgramData%\Tentacle Server` | Créé, écrit (pas de virtualisation sous `AppData\Local\Packages\…\VFS`). `tentacle.db` présent. |
| 3 | Depuis un téléphone du même réseau (profil réseau « Privé ») | `http://<ip-du-pc>:3000` répond, SANS invite du pare-feu. Avec un compte Windows STANDARD aussi (règle posée sans élévation). En profil « Public » : injoignable, et l'icône le signale. |
| 4 | Changer de port (menu de l'icône) | Le nouveau port est joignable sans invite du pare-feu (la règle n'a pas de port). |
| 5 | `tentacle web status` dans cmd, puis dans PowerShell | La sortie paraît avec ses accents. Noter si le shell attend la fin (invite APRÈS la sortie) ou non. `tentacle setup token > code.txt` écrit le code dans le fichier. |
| 6 | Paramètres > Applications > Démarrage | « Tentacle Server » listé, activé. Fermer la session, la rouvrir : le serveur repart. Le couper là : la case du menu le reflète, et la recocher renvoie vers les Paramètres. |
| 7 | Redémarrer Windows | Le serveur repart à l'ouverture de session (pas avant : limite connue). |
| 8 | Quitter (menu) | `tentacle.db-wal` absent ensuite (arrêt propre). |
| 9 | Installer une extension depuis l'administration | Le serveur redémarre seul (code 75), l'icône reste. |
| 10 | Bandes-annonces (Apple TV) ou `tentacle` → journal `[yt-dlp] épinglé → 2026.08.19` | Le Python embarqué fait tourner yt-dlp. |
| 11 | Désinstaller depuis Paramètres, réinstaller | Les données restent ; l'installation reprend le serveur tel quel, assistant fermé. |
| 12 | Mise à jour : installer la 1.0.0.0, puis un paquet 1.0.1.0 signé de même | Par `Add-AppxPackage` pendant que l'app tourne : refus attendu (`0x80073D02`) sous Windows 10 ; différé sous 24H2 (`UpdateWhileInUse=defer`) et appliqué à la relance. Le vrai chemin (StoreContext, sauvegarde `backups\tentacle-<version>.db`, relance par `RegisterApplicationRestart`) ne s'éprouve que par un **vol de paquet** du Store (fil E). |
| 13 | Gestionnaire des tâches, au repos 10 min, Jellyfin relié | Noter la mémoire privée de « Tentacle Server » (hôte + serveur). Mesure hors paquet sur le poste : 29 Mo + 108 Mo. |
| 14 | Windows Server 2025 : `winget install --source msstore <ID>` | À noter seulement (Store absent de Server). |

## 4. Kit de certification

Dans la VM (il installe le paquet pour l'examiner) :

```powershell
& "${env:ProgramFiles(x86)}\Windows Kits\10\App Certification Kit\appcert.exe" test -appxpackagepath <chemin>\TentacleServer-1.0.0.0-vm.msix -reportoutputpath <chemin>\wack.xml
```
