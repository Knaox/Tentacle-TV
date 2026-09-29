# Changelog — TV (Android TV + Apple TV)

Blocs `## [X.Y.Z]` avec sous-sections `### FR` / `### EN`. Lu par
`.github/workflows/tv.yml` : Play Console (max 500 caractères), App Store
Connect tvOS (max 4000), Release GitHub (illimité). Renommer `[Unreleased]`
en `[X.Y.Z]` au moment d'envoyer (la version vient de `versions.json` → `tv`).

## [1.4.0]
<!-- Bloc nu : Google Play, 500 caractères. Le bloc atv- porte la version complète. -->
### FR
- **Un appui long sur une carte** ouvre ses actions : Ma liste, favori, vu et votre note en étoiles
- **La saga d'un film** sur sa fiche
- **Saisons plus rapides**, la saison en cours d'emblée
- **Bandes-annonces locales et bonus** enfin visibles, et la fiche dit où trouver le guide si le serveur n'est pas réglé
- **La VO** parmi vos langues audio préférées
- **La fiche se lit** sur les images claires
- **Premier lancement** dans la langue de l'appareil

### EN
- **A long press on a card** opens its actions: My list, favorite, watched and your star rating
- **A movie's saga** on its page
- **Faster seasons**, the current season right away
- **Local trailers and extras** finally visible, and the title page says where to find the guide if the server is not set up
- **Original language** among your preferred audio languages
- **The title page reads** on light images
- **First launch** in the device's language

## [atv-1.4.0]
<!-- Bloc Apple TV (App Store Connect, 4000 caractères) : la version complète. -->
### FR
- **Un appui long sur une carte** ouvre ses actions, sur toutes les rangées, la recherche et les recommandations : Ma liste, favori, vu, et votre note en étoiles entières. Un titre jugé quitte « Pour vous » quand la feuille se referme
- **La saga d'un film** sur sa fiche : tous les volets dans l'ordre, ceux que vous avez vus et celui qui vient ensuite
- **Saisons et épisodes plus rapides** : la saison en cours s'ouvre d'emblée, marquée, et la saison voisine se prépare dès qu'elle reçoit le focus
- **Bandes-annonces locales, de saison et bonus** enfin visibles sur la fiche
- **Bandes-annonces YouTube réparées** avec le serveur Tentacle 1.22.0 ; quand le serveur n'est pas réglé pour les bandes-annonces, la fiche dit où trouver le guide
- **La VO** parmi vos langues audio préférées
- **Des cartes plus nettes** : l'anneau de focus épouse l'image, un seul marqueur « vu », et les cartes de recommandation portent les mêmes repères que les autres
- **La fiche se lit** sur les images claires
- Dans la recherche, OK sur un épisode lance la lecture, comme sur l'accueil
- Au premier lancement, l'app et sa mention légale parlent la langue de l'appareil

### EN
- **A long press on a card** opens its actions, on every row, search and recommendations: My list, favorite, watched, and your rating in whole stars. A judged title leaves "For you" when the sheet closes
- **A movie's saga** on its page: every installment in order, the ones you have watched and the one that comes next
- **Faster seasons and episodes**: the current season opens right away, marked, and the next season gets ready as soon as it is focused
- **Local trailers, season trailers and extras** finally visible on the title page
- **YouTube trailers fixed** with Tentacle server 1.22.0; when the server is not set up for trailers, the title page says where to find the guide
- **Original language** among your preferred audio languages
- **Sharper cards**: the focus ring hugs the image, a single "watched" marker, and recommendation cards carry the same markers as the others
- **The title page reads** on light images
- In search, OK on an episode starts playback, as on the home screen
- On first launch, the app and its legal notice speak the device's language

## [1.3.1]
### FR
- **Des affiches qui en disent plus** : la note du public et la vôtre, et un repère pour Ma liste, vos favoris et ce que vous avez déjà vu

### EN
- **Posters that say more**: the audience rating and yours, and a marker for My list, your favorites and what you have already watched

## [1.3.0]
### FR
- **Recherche repensée** : fautes corrigées, suite du titre suggérée, acteurs, genres et studios
- **Pour vous** : des recommandations tirées de votre bibliothèque
- **Pilotable à distance** depuis Jellyfin et Tentacle : pause, arrêt, messages
- **Plus fluide** : bibliothèques plus rapides, défilement rapide en maintenant une touche
- **L'accueil suit votre compte** : rangées, favoris, filtre de plateformes
- **Apple TV** : pistes sans rechargement, Atmos, Dolby Vision profil 7 ; **Android TV** : cadence du film en option
### EN
- **Search rethought**: typos fixed, title completion, actors, genres and studios
- **For You**: recommendations drawn from your library
- **Remote control** from Jellyfin and Tentacle: pause, stop, messages
- **Smoother**: faster libraries, fast scrolling by holding a direction
- **The home follows your account**: rows, favorites, platform filter
- **Apple TV**: tracks switch without reloading, Atmos, Dolby Vision profile 7; **Android TV**: film frame rate as an option

## [1.2.2]
### FR
- L'épisode qu'on vient de terminer est coché sur la fiche de la série, saisons et compteurs compris
- L'épisode suivant est celui d'APRÈS celui que vous venez de regarder : commencer une saison par son épisode 6 proposait le 1, et remettre un épisode en « non lu » le faisait revenir en tête
- Navigation nettement plus fluide : parcourir les rangées, ouvrir le menu et changer de page ne saccadent plus, même sur les boîtiers puissants
- Le halo des bannières est enfin là sur Android TV, comme sur l'Apple TV
- Boutons, cartes et pastilles reprennent les coins arrondis du téléviseur LG
- « Passer l'intro » est activé d'origine, et ne part plus pendant le chargement
- Résumé, aperçu et générique de fin ont eux aussi leur bouton — un seul bouton pour les quatre passages
- Chaque passage se règle : proposer un bouton, passer tout seul, ou ne rien faire
- Les réglages de lecture suivent votre compte : posez-les sur le téléphone, ils valent devant la télévision
- Trois réglages de fin d'épisode, indépendants : la fiche, son décompte, l'enchaînement
- Revenir d'une fiche ne provoque plus d'erreur
### EN
- The episode you have just finished is ticked on the series page, seasons and counters included
- The next episode is the one AFTER what you just watched: starting a season at episode 6 used to offer episode 1, and marking an episode unwatched brought it back to the front
- Navigation is markedly smoother: moving through rows, opening the menu and switching pages no longer stutter, even on powerful boxes
- The banner halo has finally arrived on Android TV, just like on Apple TV
- Buttons, cards and pills take on the LG television's rounded corners
- "Skip the intro" is on out of the box, and no longer fires during loading
- Recaps, previews and closing credits get a button too — one button for all four passages
- Every passage can be set: offer a button, skip on its own, or do nothing
- Playback settings follow your account: set them on the phone, they apply in front of the television
- Three end-of-episode settings, independent: the card, its countdown, the automatic advance
- Coming back from a media page no longer raises an error

## [1.2.0]
### FR
- Le jumelage ne se perd plus jamais tout seul : un redémarrage du serveur, une panne passagère ou une déconnexion du site web ne débranchent plus le téléviseur — seule une révocation volontaire depuis les réglages le fait, et elle agit immédiatement
- Les messages d'erreur de lecture disparaissent d'eux-mêmes après quelques secondes, au lieu de rester à l'écran pour toujours
- La qualité s'adapte à la connexion : l'application mesure le débit réel et réduit d'elle-même la qualité quand le réseau ne suit pas — jamais quand vous avez choisi un palier vous-même, et un badge le signale
- L'écran ne se met plus jamais en veille pendant une lecture (en pause, la veille normale reprend pour protéger la dalle)
- L'interface s'aligne sur la nouvelle référence visuelle du salon : bannières en carte arrondie cernée de leur halo (accueil et bibliothèques), anneau de sélection blanc et instantané, marges de sécurité d'écran systématiques
- Les fiches se complètent : affiche, distribution et équipe, et trois nouvelles actions — Favori, Ma liste, Vu/Non vu
- Nouvelles pages « Ma liste » et « Mes favoris » dans le menu, masquables d'un appui long comme les bibliothèques
- Bibliothèques : de vrais filtres — statut vu, favoris, genres multiples, plage d'années, note minimale, plateformes de streaming — mémorisés au retour d'une fiche, avec compteur de résultats et réinitialisation
- La recherche retient vos six dernières recherches et les propose dès l'ouverture
- Réglages réunis en une seule page (Compte · Lecture · À propos) : 38 langues de préférence au lieu de 20, « réinitialiser » par bibliothèque, et changer de serveur ou se déconnecter s'y font désormais, en deux appuis de confirmation
- Lecteur : habillage affiné — grand bouton central, panneaux flottants qui assombrissent la vidéo, barre de progression au dégradé de l'application, un épisode affiche sa série en titre
- Plusieurs libellés qui restaient en anglais sont enfin traduits
### EN
- Pairing never breaks on its own anymore: a server restart, a brief outage or a web sign-out no longer disconnects the TV — only a deliberate revocation from settings does, and it takes effect immediately
- Playback error messages now fade away on their own after a few seconds instead of staying on screen forever
- Quality adapts to your connection: the app measures the real throughput and lowers quality on its own when the network can't keep up — never when you picked a preset yourself, and a badge signals it
- The screen never sleeps during playback anymore (while paused, normal sleep resumes to protect the panel)
- The interface aligns with the new living-room visual reference: rounded card banners wrapped in their glow (home and libraries), a white instant selection ring, consistent screen-safe margins everywhere
- Detail pages are now complete: poster, cast and crew, and three new actions — Favorite, My List, Watched/Unwatched
- New "My List" and "My Favorites" pages in the menu, hideable with a long press like libraries
- Libraries get real filters — watched status, favorites, multiple genres, year range, minimum rating, streaming platforms — remembered when you come back from a title, with a result count and a reset
- Search remembers your last six searches and offers them as soon as it opens
- Settings now live on a single page (Account · Playback · About): 38 preference languages instead of 20, a per-library reset, and changing server or signing out happens there, with a two-press confirmation
- Player: refined chrome — a large central button, floating panels that dim the video, a progress bar in the app's gradient, and episodes show their series as the title
- Several labels that stayed in English are finally translated

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
