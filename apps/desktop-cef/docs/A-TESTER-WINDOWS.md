# À tester sous Windows — Tentacle CEF (axe windows, lot cef-parite, 10/11/2026)

**Rien n'a encore tourné sous Windows.** Aucune machine Windows ni MSVC dans le lot. Ce qui a été
vérifié depuis le Mac :

- **compilation à blanc** de toute l'app Windows et de ses tests (`pnpm --filter
  @tentacle-tv/desktop-cef test:windows:syntax` : clang ciblant `x86_64-w64-mingw32`, en-têtes
  mingw-w64 et CEF de Windows) — 88 fichiers, 0 erreur, 0 avertissement ;
- les **règles** portables (session HDR, verdict du Microsoft Store) : `tentacle_display_tests` vert ;
- le **build macOS** de la même branche, vert, l'app inchangée (1280×800 points, échelle 2).

Ce qui suit est donc la première vraie épreuve : une ligne par cas, le geste, l'attendu.

## 1. Prérequis (une fois)

- Windows 10 version 2004 ou plus récent, ou Windows 11 — **x64** (la libmpv d'Electron est x64).
- **Visual Studio Build Tools 2022** (ou Visual Studio 2022/2026), charge « Développement Desktop
  en C++ » avec ses composants recommandés : MSVC v143, SDK Windows 10/11, « Outils CMake C++ pour
  Windows » (qui apportent CMake **et** Ninja). En une ligne :

  ```powershell
  winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive"
  ```

  CMake et Ninja du PATH conviennent aussi (`winget install Kitware.CMake Ninja-build.Ninja`).
- Node 22+ et pnpm (ceux du monorepo), Git. **Aucun bash** : PowerShell ou cmd suffisent.
- Une **connexion fixe** au premier lancement (CEF : 175 Mo) et ~2 Go libres.
- **Electron fermé** (Tentacle TV) : les deux ne partagent jamais le stockage en même temps.

## 2. La commande

À la racine du monorepo, dans un PowerShell ordinaire (pas besoin de l'invite de Visual Studio) :

```powershell
pnpm dev:cef
```

Options : `pnpm dev:cef -- --mute` (son coupé), `pnpm dev:cef -- --skip-web` (garde `apps/web/dist`).
Le lanceur trouve Visual Studio (vswhere), télécharge et **vérifie** les dépendances épinglées
(CEF windows64, SDL3 3.4.16, libsodium 1.0.22, nlohmann/json 3.12.0, en-têtes de mpv), prend la
`libmpv-2.dll` d'Electron (déjà dans le dépôt), construit, puis ouvre l'app sur le **profil
d'Electron** (`%APPDATA%\com.tentacle.media`). L'exécutable :
`%USERPROFILE%\.cache\tentacle-cef\build\tv\app\Tentacle.exe`.

Toutes les dépendances sont épinglées par SHA-256 : CEF windows64 l'a été le 10/11 sur
l'archive téléchargée sur réseau fixe (`371efdf0…`, SHA-1 du CDN concordante). Une archive qui
diffère est refusée, sans rien extraire.

Quitter par **Alt+F4 ou la croix** : Ctrl+C dans le terminal perd ce que la page vient d'écrire.

## 3. Recette

| # | Geste | Attendu |
|---|---|---|
| 1 | `pnpm dev:cef` | build sans erreur ; une fenêtre « Tentacle » de 1280×800 (taille d'Electron, même à 150 %), icône de Tentacle, barre de titre sombre si Windows est en thème sombre |
| 2 | Regarder le terminal | `[compositeur] D3D11 sur « <votre carte graphique> »`, aucune ligne `[win] … : 0x…` |
| 3 | Être connecté dans Electron, puis lancer CEF | la même session (aucune reconnexion), mêmes réglages |
| 4 | Affichage à 125 % ou 150 % | texte net, même taille qu'Electron |
| 5 | Glisser la fenêtre vers un écran d'une autre échelle | la page se remet à l'échelle de cet écran |
| 6 | Redimensionner en tirant un bord, lentement puis vite | la page suit **pendant** le geste (aucun gel), bords noirs au pire, jamais blancs |
| 7 | Agrandir, restaurer, F11 | la page remplit la fenêtre à chaque fois |
| 8 | Taper dans la recherche (AZERTY) : `é è ç à`, `^` puis `e` (ê), AltGr+0 (`@`) | les bons caractères |
| 9 | Dans un champ : Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z | comme dans Electron |
| 10 | Formulaire de connexion : Entrée | le formulaire part |
| 11 | Tab / Maj+Tab, Échap, flèches dans une liste | navigation normale |
| 12 | (si une méthode d'entrée est installée, ex. japonais) composer un mot | composition soulignée DANS le champ, candidats près du curseur, Entrée valide sans envoyer le formulaire |
| 13 | Molette d'un cran sur une page longue | ~100 px, comme Electron ; Maj+molette : horizontal |
| 14 | Pavé tactile : défilement à deux doigts | continu, sans à-coups |
| 15 | Boutons « précédent / suivant » de la souris | historique |
| 16 | Clic droit | aucun menu natif (la page a les siens) |
| 17 | Ouvrir un `<select>` (réglages) | la liste paraît au bon endroit (aussi à 150 %), cliquable |
| 18 | Lire un film SDR | l'image sous l'interface, les contrôles par-dessus, son audible, avance/recul, pause |
| 19 | Redimensionner pendant la lecture | la vidéo suit la fenêtre, sans bande ni recadrage |
| 20 | Plein écran pendant la lecture (bouton du lecteur, puis Échap) | entrée et sortie propres, la vidéo remplit l'écran |
| 21 | Fin d'un épisode → suivant | la lecture enchaîne, l'image reparaît |
| 22 | Écran HDR, HDR de Windows **éteint**, Réglages : « bascule HDR automatique » | l'option est **visible** (`display_hdr_state.supporte`) |
| 23 | Option allumée, film HDR10 | l'écran passe en HDR (1 à 2 s de noir), image juste (ni sombre, ni délavée) ; en sortant du lecteur, l'écran revient en SDR |
| 24 | HDR de Windows **déjà allumé**, film HDR10 | aucune bascule, image HDR juste |
| 25 | Option éteinte, écran SDR, film HDR10 | image SDR correcte (tone-mapping), jamais quasi noire |
| 26 | Décocher l'option pendant un film HDR (option allumée) | l'écran revient en SDR tout de suite |
| 27 | Fermer l'app pendant un film HDR basculé | l'écran revient en SDR |
| 28 | Octave : lancer un album, mini-lecteur | musique audible, contrôles |
| 29 | Fermer (Alt+F4), rouvrir Electron | Electron retrouve la session et ce qui a été fait dans CEF |
| 30 | Lancer `pnpm dev:cef` pendant qu'Electron tourne | refus : « le profil d'Electron est ouvert par un autre processus » |
| 31 | (après le lot de livraison, paquet MSIX du Store installé) une mise à jour publiée | la bannière « Mettre à jour » ; le bouton ouvre la boîte du Store ; sinon la page du Store |

En `pnpm dev:cef` l'app n'est pas un paquet MSIX : `check_msix_update` répond « aucune mise à
jour » et **aucune bannière ne paraît** — c'est voulu (cas 31 : plus tard).

## 4. Si quelque chose casse

Envoyer : la sortie du terminal (build ou app), et le journal de CEF
`%USERPROFILE%\.cache\tentacle-cef\profiles\electron\cef.log`. Pour la vidéo :
`$env:TENTACLE_MPV_LOGFILE="$env:TEMP\mpv.log"; pnpm dev:cef` puis ce fichier.

## 5. Limites connues (écrites, pas encore faites)

- Alt+lettre n'est pas un « system key » pour Chromium (`accesskey` HTML) ; le reste d'Alt marche.
- `--background` (bancs) n'empêche pas l'activation à l'ouverture sous Windows
  (`SDL_WINDOW_ACTIVATE_WHEN_SHOWN=0` dans l'environnement le fait).
- Horloge d'images : le minuteur de CEF à la fréquence de l'écran (pas de vsync DWM dédiée).
- Diagnostic HDR : DXGI ne relit pas l'espace d'une chaîne ; `pont.debug.surface` donne le format
  (RGB10A2 = sortie HDR) mais pas l'espace.
- Cas limite : une fin de fichier exactement pendant la relecture de `display-swapchain` (adresse
  lue dans mpv, puis gardée) — jamais vu, signalé dans `MpvPlayerPort::onPlayerEvent`.

## Cycle de vie et fenêtre (axe systeme)

Écrit ; vérifié en `-fsyntax-only` (mingw-w64 12 en conteneur, et `bench/windows/syntax-check.sh`
de l'axe windows : 0 erreur dans les fichiers du cycle de vie) ; jamais lancé.

- **Croix / Alt+F4** sans transfert → l'app quitte.
- **Croix pendant un téléchargement** (réglage allumé) → la fenêtre part, une bulle « Téléchargements en arrière-plan » (notification de Windows) ; le processus finit puis sort ; `powercfg /requests` montre « Tentacle TV » (EXECUTION) pendant le transfert.
- **Relancer depuis le menu Démarrer pendant cette fin de transferts** → l'instance se relance.
- **Quitter pendant un téléchargement** (fermeture par la barre des tâches) → boîte « Quitter quand même / Annuler » ; Échap = Annuler.
- **Second lancement** → la première fenêtre revient devant (restaurée si réduite), le second sort.
- **Lien `tentacle://octave/…`** (protocole déclaré par le paquet) app ouverte → la page s'ouvre.
- **Réglages › Téléchargements › Changer de dossier** → sélecteur de dossier de Windows ; le choix revient à la page.
- **Lecture d'un film** → `powercfg /requests` : DISPLAY « Tentacle TV » ; rien hors lecture.
- **Mise en veille puis réveil pendant un téléchargement** → il reprend (PowerRegisterSuspendResumeNotification).
- **Mise à jour MSIX qui redémarre** (`relaunch`) → l'app revient seule.
- **Glisser par une région `app-region: drag`** à 100 % et 150 % d'échelle → la fenêtre suit ; la fenêtre ne se réduit pas sous 900×600 (en DIP).

## reseau (pochettes, greffons, CSP, relais, requêtes déléguées, préchargement)

- Compilé par mingw-w64 seulement (`tools/net-windows-syntax.sh`) : rien n'a encore tourné sous Windows — tout ce qui suit est à voir une première fois.
- `pnpm dev:cef`, Octave ouvert → pochettes affichées ; `%APPDATA%\com.tentacle.media\octave-art\` se remplit ; relancé, pochettes servies du disque (`X-Octave-Art: disk`).
- Un nom d'utilisateur Windows avec accents → le dossier de données est le bon (`%APPDATA%` lu en large) et le cache s'écrit.
- Les tests de la partie pure, construits par MSVC : `ctest --test-dir <build>\src\net` → tous verts (dates de fichier par `GetFileAttributesExW`/`SetFileTime`).
- Page d'une extension → chargée sous `tentacle://plugin/<id>`, sans violation de CSP de l'application.
- Sillon, titre « direct » → joue par `http://127.0.0.1:<port>/d/…` (Winsock) ; pare-feu Windows : aucune invite (écoute sur la boucle locale seulement).
- Lecture directe Jellyfin → reports de lecture relayés (`reseau.debug.trace`), position gardée.
- Fiche d'un film → `[reseau] préchargement …` dans la sortie.
