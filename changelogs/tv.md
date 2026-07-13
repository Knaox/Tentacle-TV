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

## [1.1.0]
### FR
- Sous-titres : le formatage est enfin respecté — gras, italique et position à l'écran (panneaux en haut) au lieu de tags affichés en code brut
- Sous-titres : nouveau rendu net — texte blanc à contour noir, sans bandeau, taille agrandie pour le salon
- Lecteur Apple TV : les sous-titres texte s'affichent désormais dans tous les modes de lecture (lecture directe et transcodage inclus)
- Lecteur Apple TV : activer ou changer de sous-titres est instantané, sans rechargement ni transcodage inutile
- Bouton « Passer l'intro » : le focus ne reste plus bloqué dessus, la navigation dans les contrôles reste libre
- Lecteur Apple TV : correction du décalage son/image qui pouvait s'installer en cours de lecture
- Lecteur Apple TV : reprise fiable après une pause, même longue (plus de chargement infini)
- Lecteur Apple TV : la lecture reprend correctement après un passage par l'écran d'accueil
- Lecteur Apple TV : récupération automatique en cas d'interruption du flux, retours arrière plus fiables
- Logo adapté à la résolution du téléviseur
### EN
- Subtitles: formatting is finally honored — bold, italics and on-screen position (top signs) instead of raw tags showing as text
- Subtitles: crisp new rendering — white text with a black outline, no background box, larger size for the living room
- Apple TV player: text subtitles now display in every playback mode (including direct play and transcoding)
- Apple TV player: enabling or switching subtitles is instant, with no reload or needless transcoding
- "Skip intro" button: focus no longer gets stuck on it, you can still navigate the player controls freely
- Apple TV player: fixed audio/video drift that could set in during playback
- Apple TV player: reliable resume after a pause, even a long one (no more endless loading)
- Apple TV player: playback resumes correctly after going to the Home screen and back
- Apple TV player: automatic recovery when the stream stalls, more reliable short rewinds
- Logo now scales with the TV resolution

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
