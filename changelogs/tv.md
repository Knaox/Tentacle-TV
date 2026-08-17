# Changelog — TV (Android TV + Apple TV)

Blocs `## [X.Y.Z]` avec sous-sections `### FR` / `### EN`. Lu par
`.github/workflows/tv.yml` : Play Console (max 500 caractères), App Store
Connect tvOS (max 4000), Release GitHub (illimité). Renommer `[Unreleased]`
en `[X.Y.Z]` au moment d'envoyer (la version vient de `versions.json` → `tv`).

## [Unreleased]
### FR
- …
### EN
- …

## [1.2.0]
### FR
- Le jumelage ne se perd plus jamais tout seul : un redémarrage du serveur, une panne passagère ou une déconnexion du site web ne débranchent plus le téléviseur — seule une révocation volontaire depuis les réglages le fait, et elle agit immédiatement
- Les messages d'erreur de lecture disparaissent d'eux-mêmes après quelques secondes, au lieu de rester à l'écran pour toujours
- La qualité s'adapte à la connexion : l'application mesure le débit réel et réduit d'elle-même la qualité quand le réseau ne suit pas — jamais quand vous avez choisi un palier vous-même, et un badge le signale
- L'écran ne se met plus jamais en veille pendant une lecture (en pause, la veille normale reprend pour protéger la dalle)
### EN
- Pairing never breaks on its own anymore: a server restart, a brief outage or a web sign-out no longer disconnects the TV — only a deliberate revocation from settings does, and it takes effect immediately
- Playback error messages now fade away on their own after a few seconds instead of staying on screen forever
- Quality adapts to your connection: the app measures the real throughput and lowers quality on its own when the network can't keep up — never when you picked a preset yourself, and a badge signals it
- The screen never sleeps during playback anymore (while paused, normal sleep resumes to protect the panel)

## [1.1.0]
### FR
- Avance rapide repensée : un seul bouton — un appui ouvre la navigation dans le film (flèches ou trackpad), OK lit à la position visée, Retour annule
- La piste audio entendue est désormais toujours celle affichée, dès le lancement (fini l'épisode qui démarre dans la mauvaise langue)
- Préférences de langue : « Français (VFF) » et « Français (VFQ) » disponibles, appliquées automatiquement à chaque lecture
- Lecture réparée pour les fichiers avec pochette intégrée (le lecteur optimisé refusait de démarrer et basculait en transcodage)
- Retours arrière plus fiables pendant la lecture (fin des micro-erreurs de segments expirés)
- Sauvegarde de progression : reconnexion automatique si la session expire en cours de lecture, et bandeau d'alerte quand le jumelage doit être reconfirmé
- Reprise silencieuse après une pause très longue ou une mise en veille (plus de message d'erreur)
- Sous-titres : le formatage est enfin respecté — gras, italique et position à l'écran (panneaux en haut) au lieu de tags affichés en code brut
- Sous-titres : nouveau rendu net — texte blanc à contour noir, sans bandeau, taille agrandie pour le salon
- Logo adapté à la résolution du téléviseur
- Lecteur Apple TV : les sous-titres texte s'affichent désormais dans tous les modes de lecture (lecture directe et transcodage inclus)
- Lecteur Apple TV : activer ou changer de sous-titres est instantané, sans rechargement ni transcodage inutile
- Lecteur Apple TV : le focus ne reste plus bloqué sur le bouton « Passer l'intro », la navigation dans les contrôles reste libre
- Lecteur Apple TV : correction du décalage son/image qui pouvait s'installer en cours de lecture
- Lecteur Apple TV : reprise fiable après une pause, même longue (plus de chargement infini)
- Lecteur Apple TV : la lecture reprend correctement après un passage par l'écran d'accueil
- Lecteur Apple TV : récupération automatique en cas d'interruption du flux, retours arrière plus fiables
### EN
- Fast-forward reimagined: a single button — one press opens in-movie navigation (arrows or trackpad), OK plays at the target position, Back cancels
- The audio track you hear is now always the one displayed, right from launch (no more episodes starting in the wrong language)
- Language preferences: "French (VFF)" and "French (VFQ)" available, applied automatically on every playback
- Fixed playback for files with embedded cover art (the optimized player refused to start and fell back to transcoding)
- More reliable rewinds during playback (no more expired-segment micro errors)
- Progress saving: automatic reconnection if the session expires mid-playback, plus an alert banner when pairing needs reconfirming
- Silent resume after a very long pause or sleep (no more error message)
- Subtitles: formatting is finally honored — bold, italics and on-screen position (top signs) instead of raw tags showing as text
- Subtitles: crisp new rendering — white text with a black outline, no background box, larger size for the living room
- Logo now scales with the TV resolution
- Apple TV player: text subtitles now display in every playback mode (including direct play and transcoding)
- Apple TV player: enabling or switching subtitles is instant, with no reload or needless transcoding
- Apple TV player: focus no longer gets stuck on the "Skip intro" button, you can still navigate the player controls freely
- Apple TV player: fixed audio/video drift that could set in during playback
- Apple TV player: reliable resume after a pause, even a long one (no more endless loading)
- Apple TV player: playback resumes correctly after going to the Home screen and back
- Apple TV player: automatic recovery when the stream stalls, more reliable short rewinds

## [1.0.0]
### FR
- Avance/recul rapide au maintien : arrêt net au relâchement, position figée — OK lit à la position visée, Retour annule
- Clic court sur ⏩/⏪ : saut immédiat de ±10 s
- Correction des confirmations « fantômes » au relâchement de la télécommande
- Lecture directe : plus d'erreur « session expirée » après un nouveau jumelage (cache purgé, jeton renouvelé automatiquement)
### EN
- Hold-to-seek: stops instantly on release, position freezes — OK plays at the target position, Back cancels
- Short press on ⏩/⏪: instant ±10s skip
- Fixed "ghost" confirmations when releasing the remote button
- Direct streaming: no more "session expired" error after re-pairing (cache cleared, token refreshed automatically)

---
