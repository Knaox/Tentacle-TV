# À essayer sur une vraie machine Windows

Une ligne par cas : geste, puis ce qui est attendu. Chaque axe tient sa section.

## reseau (pochettes, greffons, CSP, relais, requêtes déléguées, préchargement)

- Compilé par mingw-w64 seulement (`tools/net-windows-syntax.sh`) : rien n'a encore tourné sous Windows — tout ce qui suit est à voir une première fois.
- `pnpm dev:cef`, Octave ouvert → pochettes affichées ; `%APPDATA%\com.tentacle.media\octave-art\` se remplit ; relancé, pochettes servies du disque (`X-Octave-Art: disk`).
- Un nom d'utilisateur Windows avec accents → le dossier de données est le bon (`%APPDATA%` lu en large) et le cache s'écrit.
- Les tests de la partie pure, construits par MSVC : `ctest --test-dir <build>\src\net` → tous verts (dates de fichier par `GetFileAttributesExW`/`SetFileTime`).
- Page d'une extension → chargée sous `tentacle://plugin/<id>`, sans violation de CSP de l'application.
- Sillon, titre « direct » → joue par `http://127.0.0.1:<port>/d/…` (Winsock) ; pare-feu Windows : aucune invite (écoute sur la boucle locale seulement).
- Lecture directe Jellyfin → reports de lecture relayés (`reseau.debug.trace`), position gardée.
- Fiche d'un film → `[reseau] préchargement …` dans la sortie.
# À tester sous Windows — Tentacle CEF
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
Une ligne par cas : geste → attendu. Rien de ceci n'a tourné sur Windows (code écrit, relu,
compilé en syntaxe par mingw-w64 au mieux). Lancer par `pnpm dev:cef`.

## medias — « À l'écoute » (SMTC), touches média, Octave

- Touche lecture/pause du clavier (un film, puis un morceau d'Octave) → pause et reprise de la source montrée ; Stop → arrêt.
- Suivant / Précédent (clavier, carte) → titre ou épisode suivant ; grisés et sans effet quand la source ne les propose pas (un film seul).
- Touche volume (Windows 10) → incrustation : titre, série « S01E02 » ou artiste, pochette, boutons justes.
- Windows 11, Paramètres rapides → carte : titre, artiste, album, pochette (JPEG et PNG), nom de l'app ; pas de « [smtc] vignette refusée » au journal.
- Barre de temps de la carte → avance seule en lecture, s'arrête en pause (sinon : le cœur devra la reposer toutes les ~5 s).
- Saut depuis la barre (Windows 11 récent, morceau d'Octave) → la lecture va à la position visée ; un film (sans saut système) laisse la barre inerte.
- Flux sans durée → pas de barre fausse.
- Mélangeur de volume (Windows 10 et 11) → une entrée « Tentacle TV » pour la vidéo et pour Octave, aussi sur une sortie choisie autre que celle par défaut.
- Fermer le lecteur, quitter Octave → la carte disparaît, la touche lecture revient à l'application précédente.
- Spotify joue, puis Tentacle → la touche va au dernier lecteur ; Tentacle en pause, Spotify relancé → Spotify reprend les touches ; Tentacle quitté → aucune carte fantôme.
- Aperçu de bande-annonce au survol (son allumé) → aucune seconde session « Chromium » dans la carte.
- Glisser-déposer dans la page après le démarrage → toujours fonctionnel (appartement STA, aucun MTA imposé).
- Lancé hors paquet, puis en MSIX → nom et icône justes sur la carte.
- Octave : réglage « Sortie audio » → liste WASAPI sans doublon, « exclusif » proposé ; mode exclusif allumé → le son passe, la houle s'arrête (pas de mesure en exclusif).
- Octave : transition douce à 6 s entre deux albums différents → fondu audible sans blanc ni saut de volume ; même album dans l'ordre → enchaînement sans blanc, sans fondu.
# À tester sous Windows — Tentacle CEF

## Hors ligne (axe horsligne)

Écrit, relu, compilé à blanc (clang ciblant x86_64-w64-mingw32, en-têtes mingw-w64 v14 et CEF
épinglés : 49 fichiers, 0 erreur) ; jamais compilé par MSVC ni lancé. Au premier `cmake`,
l'amalgamation SQLite 3.46.1 est téléchargée depuis sqlite.org (≈ 2,7 Mo, SHA-256 vérifié) dans
`%USERPROFILE%\.cache\tentacle-cef\deps\sqlite` (ou `$TENTACLE_CEF_CACHE`).

- **Construction MSVC** (`pnpm dev:cef`) → `src/offline` compile (coroutines C++20, `/std:c++20`).
- **Premier lancement sur un profil d'Electron existant** → « Téléchargements » montre les
  titres gardés par Electron (`%APPDATA%\com.tentacle.media\tentacle-local.db`).
- **Compte Windows au nom accentué** (`C:\Users\Josée`) → la base s'ouvre, un film se garde et
  se lit (chemins larges partout : `.part` par `CreateFileW`).
- **Garder un film**, **pause / reprise**, **réseau coupé puis rétabli** (reprise seule en
  ≤ 5 s), **fermer puis relancer pendant un transfert** (reprise à son octet).
- **Disque plein** (petite clé USB comme racine) → le transfert passe en erreur « disque
  plein » (`disk-full`), sans relance.
- **Racine sur une autre lettre de lecteur** (`D:\Films`) → acceptée si vide ; un dossier en
  lecture seule → refus avec la cause (`EACCES` / `EPERM`).
- **Hors ligne** → « Sur cet appareil », lecture d'un film depuis le disque, d'un titre gardé
  dans Octave.
- **Anti-suspension** pendant un transfert → `powercfg /requests` montre la demande (SYSTEM),
  plus rien à la fin.
# À essayer sur une vraie machine Windows (une ligne par cas : geste → attendu)

## navigateur (lot cef-parite)

- Réglages › Profil › « Changer la photo » › « Importer une photo » → boîte « Ouvrir » de Windows, possédée par la fenêtre (elle est désactivée), types « Image Files » puis « All Files (*.*) » ; choisir une image → elle devient la photo.
- Octave › Importer › fichiers audio → boîte « Ouvrir » en sélection multiple, type « Custom Files » ; Annuler → rien ne change.
- Fenêtre étroite › Profil › « Se déconnecter » → TaskDialog titrée « Tentacle TV », boutons OK / Annuler de Windows (traduits) ; Échap = Annuler.
- Si la TaskDialog n'apparaît pas mais une MessageBox classique oui → le manifeste de l'exe n'a pas les Common Controls 6 (axe windows).
- Un lien externe → navigateur par défaut ; un téléchargement lancé par la page → boîte « Enregistrer sous » dans Téléchargements, titre = l'URL ; Annuler → aucun fichier.
- Glisser un fichier audio depuis l'Explorateur sur Octave → la boîte d'import s'ouvre avec ce fichier.
- Survoler un bouton-icône sans bouger → bulle native de Windows (le délai du double-clic), sous le curseur ; un clic la retire ; aucune bulle quand la fenêtre n'est pas au premier plan.
- Survoler la poignée du chat de Watch Together (`cursor-grab`) → main ouverte de Chromium ; en la tirant → main fermée ; zoom d'une image (`zoom-in`) → loupe.
- Compilé par mingw-w64 seulement (`tools/net-windows-syntax.sh`) : rien n'a encore tourné sous Windows — tout ce qui suit est à voir une première fois.
- `pnpm dev:cef`, Octave ouvert → pochettes affichées ; `%APPDATA%\com.tentacle.media\octave-art\` se remplit ; relancé, pochettes servies du disque (`X-Octave-Art: disk`).
- Un nom d'utilisateur Windows avec accents → le dossier de données est le bon (`%APPDATA%` lu en large) et le cache s'écrit.
- Les tests de la partie pure, construits par MSVC : `ctest --test-dir <build>\src\net` → tous verts (dates de fichier par `GetFileAttributesExW`/`SetFileTime`).
- Page d'une extension → chargée sous `tentacle://plugin/<id>`, sans violation de CSP de l'application.
- Sillon, titre « direct » → joue par `http://127.0.0.1:<port>/d/…` (Winsock) ; pare-feu Windows : aucune invite (écoute sur la boucle locale seulement).
- Lecture directe Jellyfin → reports de lecture relayés (`reseau.debug.trace`), position gardée.
- Fiche d'un film → `[reseau] préchargement …` dans la sortie.
