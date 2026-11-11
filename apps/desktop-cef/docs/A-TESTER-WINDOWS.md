# À tester sous Windows — Tentacle CEF

**Rien n'a encore tourné sous Windows.** Le lot n'a ni machine Windows ni MSVC. Ce qui a été
vérifié depuis le Mac, sur l'arbre intégré (tous les axes du lot cef-parite) :

- **compilation à blanc pilotée par CMake** (`pnpm --filter @tentacle-tv/desktop-cef
  test:windows:syntax`, et `bench/windows/syntax-check.sh --gcc`) : la vraie configuration
  Windows de chaque module (sources choisies par OS, définitions, chemins d'inclusion), rejouée
  en `-fsyntax-only` par clang ciblant `x86_64-w64-mingw32` ET par GCC mingw-w64 en conteneur,
  en-têtes mingw-w64 v14 et CEF windows64 épinglés — 250 commandes, 245 fichiers, 0 erreur
  dans les deux ;
- les **règles** portables de chaque axe (ctest sur le Mac) et le **build macOS**.

Rien n'a été lié par MSVC, ni lancé. Ce qui suit est la première vraie épreuve : une ligne par
cas, le geste, puis l'attendu.

## Prérequis (une fois)

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

## La commande

À la racine du monorepo, dans un PowerShell ordinaire (pas besoin de l'invite de Visual Studio) :

```powershell
pnpm cef
```

`pnpm cef` est l'alias de `pnpm dev:cef` (lot rf2). Options : `pnpm cef -- --mute` (son coupé),
`pnpm cef -- --skip-web` (garde `apps/web/dist`). `$env:TENTACLE_DEV_DRY="1"; pnpm cef` imprime
les builds et la commande de l'app sans rien lancer.

Le lanceur trouve Visual Studio (vswhere), télécharge et **vérifie par SHA-256** les dépendances
épinglées — CEF windows64, SDL3 3.4.16, libsodium 1.0.22, nlohmann/json 3.12.0, en-têtes de mpv,
amalgamation SQLite 3.46.1 (hors ligne) —, prend la `libmpv-2.dll` d'Electron (déjà dans le
dépôt ; elle n'importe que des DLL du système), construit, puis ouvre l'app sur le **profil
d'Electron** (`%APPDATA%\com.tentacle.media`). Une archive qui diffère de son empreinte est
refusée, sans rien extraire. L'exécutable : `%USERPROFILE%\.cache\tentacle-cef\build\tv\app\Tentacle.exe`
(l'assistant de mise à jour `tentacle-update.exe` à côté).

Quitter par **Alt+F4 ou la croix** : Ctrl+C dans le terminal perd ce que la page vient d'écrire.

## Si quelque chose casse

Envoyer : la sortie du terminal (build ou app), et le journal de CEF
`%USERPROFILE%\.cache\tentacle-cef\profiles\electron\cef.log`. Pour la vidéo :
`$env:TENTACLE_MPV_LOGFILE="$env:TEMP\mpv.log"; pnpm dev:cef` puis ce fichier.

## Socle : fenêtre, page, saisie, vidéo, HDR (axe windows)

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

## Image dans l'image (axes pip et windows)

La vidéo est PRÊTÉE : le visuel DirectComposition de la chaîne de mpv quitte l'arbre de la
fenêtre principale pour celui de la fenêtre PiP, sans que mpv change de sortie.

- Pendant un film, « Réduire » → une fenêtre PiP sans barre de titre, coins arrondis (Windows 11), la vidéo la remplit entièrement (aucune marge, comme Electron sous Windows), les contrôles de la page par-dessus ; la fenêtre principale ne montre plus la vidéo, et n'a pas perdu le focus.
- Le passage en PiP → la lecture continue sans coupure, sans rechargement ; écran en HDR : l'image reste HDR.
- Tirer un bord ou un coin de la fenêtre PiP → elle se redimensionne (bande de ~6 px le long des bords), puis reprend le rapport de la vidéo et ses bornes au lâcher ; la vidéo suit, nette.
- Glisser la fenêtre PiP par la page → elle suit le curseur.
- Fenêtre PiP glissée d'un écran à 150 % vers un écran à 100 % → la vidéo reste nette et à la taille de la fenêtre.
- PiP flottant → au-dessus de toutes les fenêtres ; ancré → devant la fenêtre principale, réduit et restauré avec elle, absent de la barre des tâches dans les deux cas.
- Retour au lecteur → la vidéo revient dans la fenêtre principale, plein cadre, sans écran noir qui dure.
- Épisode suivant pendant le PiP → il se joue dans le PiP.
- Quitter l'app pendant le PiP (Alt+F4 sur la fenêtre principale) → le PiP part d'abord, puis l'app, sans erreur au terminal.
- Paramètres › Accessibilité › Effets visuels › « Effets d'animation » éteints → le PiP s'ouvre et revient sans animation.
- Un clic tout près du bord d'un bouton du PiP → si rien ne se passe, c'est la bande de redimensionnement (limite connue, plus bas).

## Cycle de vie et fenêtre (axe systeme)

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

## Navigateur : boîtes, liens, bulles, curseurs (axe navigateur)

- Réglages › Profil › « Changer la photo » › « Importer une photo » → boîte « Ouvrir » de Windows, possédée par la fenêtre (elle est désactivée), types « Image Files » puis « All Files (*.*) » ; choisir une image → elle devient la photo.
- Octave › Importer › fichiers audio → boîte « Ouvrir » en sélection multiple, type « Custom Files » ; Annuler → rien ne change.
- Fenêtre étroite › Profil › « Se déconnecter » → TaskDialog titrée « Tentacle TV », boutons OK / Annuler de Windows (traduits) ; Échap = Annuler. Une MessageBox classique à la place → les Common Controls 6 du manifeste n'ont pas été pris (le signaler).
- Un lien externe → navigateur par défaut ; un téléchargement lancé par la page → boîte « Enregistrer sous » dans Téléchargements, titre = l'URL ; Annuler → aucun fichier.
- Glisser un fichier audio depuis l'Explorateur sur Octave → la boîte d'import s'ouvre avec ce fichier.
- Survoler un bouton-icône sans bouger → bulle native de Windows (le délai du double-clic), sous le curseur ; un clic la retire ; aucune bulle quand la fenêtre n'est pas au premier plan.
- Survoler la poignée du chat de Watch Together (`cursor-grab`) → main ouverte de Chromium ; en la tirant → main fermée ; zoom d'une image (`zoom-in`) → loupe.

## Réseau : pochettes, extensions, relais (axe reseau)

- Octave ouvert → pochettes affichées ; `%APPDATA%\com.tentacle.media\octave-art\` se remplit ; relancé, pochettes servies du disque (`X-Octave-Art: disk`).
- Un nom d'utilisateur Windows avec accents → le dossier de données est le bon (`%APPDATA%` lu en large) et le cache s'écrit.
- Les tests de la partie pure, construits par MSVC : `ctest --test-dir <build>\src\net` → tous verts (dates de fichier par `GetFileAttributesExW`/`SetFileTime`).
- Page d'une extension → chargée sous `tentacle://plugin/<id>`, sans violation de CSP de l'application.
- Sillon, titre « direct » → joue par `http://127.0.0.1:<port>/d/…` (Winsock) ; pare-feu Windows : aucune invite (écoute sur la boucle locale seulement).
- Lecture directe Jellyfin → reports de lecture relayés (`reseau.debug.trace`), position gardée.
- Fiche d'un film → `[reseau] préchargement …` dans la sortie.

## Hors ligne (axe horsligne)

- **Construction MSVC** → `src/offline` compile (coroutines C++20, `/std:c++20`), SQLite embarqué (amalgamation du lanceur).
- **Premier lancement sur un profil d'Electron existant** → « Téléchargements » montre les titres gardés par Electron (`%APPDATA%\com.tentacle.media\tentacle-local.db`).
- **Compte Windows au nom accentué** (`C:\Users\Josée`) → la base s'ouvre, un film se garde et se lit (chemins larges partout : `.part` par `CreateFileW`).
- **Garder un film**, **pause / reprise**, **réseau coupé puis rétabli** (reprise seule en ≤ 5 s), **fermer puis relancer pendant un transfert** (reprise à son octet).
- **Disque plein** (petite clé USB comme racine) → le transfert passe en erreur « disque plein » (`disk-full`), sans relance.
- **Racine sur une autre lettre de lecteur** (`D:\Films`) → acceptée si vide ; un dossier en lecture seule → refus avec la cause (`EACCES` / `EPERM`).
- **Hors ligne** → « Sur cet appareil », lecture d'un film depuis le disque, d'un titre gardé dans Octave.
- **Anti-suspension** pendant un transfert → `powercfg /requests` montre la demande (SYSTEM), plus rien à la fin.

## Médias : « À l'écoute » (SMTC), touches média, sortie audio (axe medias)

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

## Outils : `pnpm cef` et le menu de débogage (lot rf2, 11/11/2026)

Rien de ce qui suit n'a tourné sous Windows : le lanceur a été RELU ligne à ligne
(`scripts/dev.mjs`, `scripts/dev/{common,windows,windows-deps,fetch,cef,profile}.mjs`) et le
menu essayé sous macOS. Trois fragilités lues dans le lanceur ont été corrigées sans pouvoir
être exécutées — c'est la première chose à regarder :

- **`pnpm cef` avec un pnpm installé en `.exe`** (installateur autonome, winget — pas de
  `pnpm.cmd`) → le build web démarre (avant : « pnpm.cmd n'est pas reconnu »). Avec un pnpm de
  npm ou de corepack (`pnpm.cmd`) → pareil.
- **Premier `pnpm cef`** (cache vide) → CMake configure sans erreur d'échappement (`Invalid
  character escape`, `\U`) : tous les chemins passés par `-D` sont en barres obliques.
- **Extraction de CEF** (175 Mo, des milliers de fichiers) avec l'antivirus actif → au pire
  « renommage retenu (EPERM), nouvel essai… » puis « CEF windows64 prêt » ; jamais un arrêt.
- `pnpm cef -- --mute` → l'app s'ouvre, son coupé ; `pnpm cef -- --skip-web` → pas de build web.
- Un nom d'utilisateur Windows AVEC ESPACE (`C:\Users\Jean Dupont`) → le build et le lancement
  passent (chemins du cache et du profil entre guillemets).

Le menu de débogage (bouton **DEBUG** en bas à droite, ou **F9** ; en-tête « CEF · Windows ») —
le tableau des trois coquilles est dans `PARITE-ELECTRON.md`, § 7. À essayer, une ligne par cas :

- Onglet **Actions** → chaque ligne a un état (interrupteur, valeur) ou une raison en jaune ;
  aucune ligne ne reste muette. « Copier » → « diagnostic copié » ; le coller dans un message.
- **U · Pop-up de mise à jour** → « Notification » : la notification de la coquille en bas à
  droite (hors lecteur) ; « Prête » puis son bouton « Redémarrer pour mettre à jour » : le voile
  « Installation de Tentacle 9.9.9 » trois secondes, RIEN ne redémarre ; « Sécurité » : le voile
  bloquant, refermé seul après six secondes ; « Annulée » ; « Fermer ».
- **U · « Store · Disponible »** (Windows seulement) → la pop-up du front, canal Microsoft
  Store ; « Store · Téléchargement » → barre indéterminée ; « Store · Erreur » → message et
  « Réessayer ». Rien n'est installé.
- **H · Transmission HDR autorisée**, écran HDR branché mais bureau en SDR → allumer, lancer un
  film HDR10 : l'écran passe en HDR à l'entrée du lecteur (une à deux secondes de noir) et
  revient en SDR à la sortie ; éteindre → il reste en SDR, l'image est convertie par mpv.
  L'état de la ligne dit « écran HDR » / « écran SDR ».
- **D · Décodage matériel** → éteindre, relancer une lecture : onglet Diagnostic, « Decodage :
  LOGICIEL » ; rallumer → matériel à la lecture suivante.
- **M · Lecteur mpv coupé**, en pleine lecture → le lecteur web prend le relais (bandeau
  « Lecteur de secours ») ; rallumer, relancer → mpv.
- **P, T, G** → grisées, « tenu par la coquille CEF » ; **C** et **L** → grisées (sonde et verre
  macOS seulement).
- **X · Simuler mpv en panne**, en pleine lecture → « Chute en lecture » : la lecture tombe, le
  lecteur web prend le relais à la même position ; « Init refusée » puis une nouvelle lecture →
  le lecteur web d'emblée ; la ligne dit « panne : init » ; « Lever la panne » → mpv rejoue.
- **N** → l'écran des nouveautés ; **R** → « journal vidé — n requêtes effacées ».
- Le panneau se déplace par son en-tête, se redimensionne par son coin bas-droit, garde sa place
  au relancement ; F9 le ferme et le rouvre sans animation.

## Limites connues (écrites, pas encore faites)

- Alt+lettre n'est pas un « system key » pour Chromium (`accesskey` HTML) ; le reste d'Alt marche.
- `--background` (bancs) n'empêche pas l'activation à l'ouverture sous Windows
  (`SDL_WINDOW_ACTIVATE_WHEN_SHOWN=0` dans l'environnement le fait).
- Horloge d'images : le minuteur de CEF à la fréquence de l'écran (pas de vsync DWM dédiée).
- Diagnostic HDR : DXGI ne relit pas l'espace d'une chaîne ; `pont.debug.surface` donne le format
  (RGB10A2 = sortie HDR) mais pas l'espace.
- Cas limite : une fin de fichier exactement pendant la relecture de `display-swapchain` (adresse
  lue dans mpv, puis gardée) — jamais vu, signalé dans `MpvPlayerPort::onPlayerEvent`.
- PiP : les bords saisissables sont DANS la fenêtre (6 DIP, SDL ne pose pas de cadre système à
  une fenêtre sans bordure) — ils prennent les clics de la page à cet endroit. L'ombre de
  Windows 11 autour d'une fenêtre sans bordure n'est pas garantie.
