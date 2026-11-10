# À essayer sur une vraie machine Windows

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
