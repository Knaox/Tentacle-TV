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
