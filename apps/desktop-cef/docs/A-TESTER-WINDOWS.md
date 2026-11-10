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
