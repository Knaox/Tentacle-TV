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
