# Changelog — Mobile (iOS + Android)

Blocs `## [X.Y.Z]` avec sous-sections `### FR` / `### EN`. Lu par
`.github/workflows/mobile.yml` : App Store Connect iOS (max 4000 caractères),
Google Play (max 500). UN seul bloc sert iOS ET Android. Renommer `[Unreleased]`
en `[X.Y.Z]` au moment d'envoyer (la version vient de `versions.json` → `mobile`).

## [1.7.0]
### FR
- **L'accueil suit votre compte** : les rangées et leur ordre choisis dans les réglages du web s'appliquent ici tels quels — « Mes favoris » et « Déjà visionné » compris
- **Les recommandations arrivent sur l'accueil** : « Pour vous » et les autres rangées, les mêmes que sur le web ; un titre hors bibliothèque s'ouvre dans le catalogue Vigie
- **Le filtre de plateformes** du compte s'applique ; une puce à côté du titre le montre et le retire d'une croix, partout
- Les administrateurs voient un bandeau tant que la clé TMDB manque sur le serveur
- **Ma liste suit vos visionnages, pas vos clics** : un titre n'en sort plus parce qu'on a ouvert son lecteur, ni parce qu'on l'a marqué vu à la main — seulement une fois réellement regardé jusqu'au bout, un film ou le dernier épisode disponible d'une série, même en cours de diffusion ; une série sortie ainsi y revient d'elle-même dès qu'un nouvel épisode arrive, jamais si vous l'avez retirée vous-même
### EN
- **The home follows your account**: the rows and their order chosen in the web settings apply here as they are — "My favorites" and "Already watched" included
- **Recommendations reach the home**: "For you" and the other rows, the same as on the web; a title outside your library opens in the Vigie catalog
- **The account's platform filter** applies; a chip next to the title shows it and removes it with a cross, everywhere
- Administrators see a banner while the TMDB key is missing on the server
- **My List follows what you watch, not what you click**: a title no longer leaves it because its player was opened, nor because it was marked watched by hand — only once actually watched to the end, a movie or a series' last available episode, even one still airing; a series that left this way comes back on its own as soon as a new episode arrives, never if you removed it yourself

## [1.6.0]
### FR
- L'interface rejoint celle du bureau : boutons en pilule blanche, dégradés violet → rose partout — barres de progression, lecture, sélections
- La bannière d'accueil devient une carte au halo de lumière, son texte entre en cascade
- La navigation s'efface en défilant, revient d'un geste
- Pendant le générique, une carte discrète propose la suite — la vidéo reste visible ; l'affiche de fin n'occupe l'écran qu'à la vraie fin
- La liste des épisodes s'ouvre SUR l'épisode en cours
- En paysage, les commandes s'écartent de la caméra
- « Réessayer » hors ligne montre enfin qu'il essaie
- Un épisode qui refusait de se lire (son Dolby copié) se lit
### EN
- The interface joins the desktop: white pill buttons, violet → pink gradients everywhere — progress bars, playback, selections
- The home banner becomes a card with a glow of light, its text cascades in
- The navigation slips away as you scroll, returns with a gesture
- During credits, a discreet card offers what's next — the video stays visible; the end poster only takes the screen at the very end
- The episode list opens ON the current episode
- In landscape, controls move clear of the camera
- The offline "Retry" finally shows it is trying
- An episode that refused to play (its Dolby audio copied) now plays

## [1.5.2]
### FR
- L'épisode qu'on vient de terminer est enfin coché sur la fiche de la série : rien ne rafraîchissait la liste en sortant du lecteur
- L'épisode suivant est celui d'APRÈS celui que vous venez de regarder : commencer une saison par son épisode 6 proposait le 1, et remettre un épisode en « non lu » le faisait revenir en tête
- Les quatre passages d'un épisode ont leur bouton : générique de début, résumé, générique de fin, aperçu du suivant. Un seul bouton, qui compte et se refuse d'une croix — celle-ci ne paraît que sur l'image nue, l'habillage affiché le bouton reste là
- Des réglages de lecture, enfin : pour chaque passage, proposer un bouton, passer tout seul ou ne rien faire — avec le délai du saut automatique
- Ces réglages suivent votre compte : posés sur le téléphone, ils valent sur la télévision et l'ordinateur
- Un écran de fin à la fin d'un épisode, au lieu d'un retour sec à la fiche
- Le bouton « Passer l'intro » ne disparaît plus avec les commandes au bout de quatre secondes
### EN
- The episode you have just finished is at last ticked on the series page: nothing refreshed the list when leaving the player
- The next episode is the one AFTER what you just watched: starting a season at episode 6 used to offer episode 1, and marking an episode unwatched brought it back to the front
- All four passages within an episode get a button: opening titles, recap, closing credits, preview of the next. One button, which counts down and can be refused with a cross — the cross only appears over the bare picture; with the controls up, the button stays
- Playback settings, at last: for each passage, offer a button, skip on its own or do nothing — with the automatic skip delay
- Those settings follow your account: set on the phone, they apply on the television and the computer
- An end screen when an episode finishes, instead of dropping straight back to the details page
- The "Skip intro" button no longer vanishes with the controls after four seconds

## [1.5.1]
### FR
- Le serveur libère enfin la conversion vidéo dans tous les cas : changement de qualité ou de piste, sortie pendant le chargement, mise en veille prolongée, application fermée d'un coup. Plus de fichiers temporaires laissés derrière
- Les pages de plugins ne se terminent plus derrière la barre d'onglets : elle flotte au-dessus d'elles, et l'application lui indique de combien s'écarter
### EN
- The server now releases the video conversion in every case: quality or track change, leaving while it loads, a long spell in the background, a force-close. No leftover temporary files
- Plugin pages no longer end up behind the tab bar: it floats above them, and the app now tells them how far to stay clear

## [1.5.0]
### FR
- Notifications push : soyez prévenu des nouveaux ajouts à la bibliothèque, et — si le plugin Seer est configuré — quand un contenu que vous avez demandé devient disponible (réglages dans Profil › Préférences › Notifications)
- Liquid Glass natif sur iOS 26 : véritables effets de verre du système sur toute l'interface (barre du haut, onglets, cartes)
- Thème clair premium repensé, avec le mode automatique par défaut (suit votre système)
- Profil et réglages réorganisés en un hub clair avec écrans dédiés
### EN
- Push notifications: get notified about new library additions, and — when the Seer plugin is set up — when content you requested becomes available (settings in Profile › Preferences › Notifications)
- Native Liquid Glass on iOS 26: true system glass effects across the whole interface (top bar, tabs, cards)
- Redesigned premium light theme, with automatic mode as the default (follows your system)
- Profile and settings reorganized into a clear hub with dedicated screens

## [1.4.0]
### FR
- Thème clair, sombre ou automatique (suit le réglage du système), sur iPhone, iPad et tablettes Android
- Effets de verre Liquid Glass sur iOS 26 (activables dans Apparence)
- Réglages réorganisés : compte, apparence, lecture, mot de passe et appareils dans des écrans dédiés
- Correction : la liste des appareils jumelés s'affiche de nouveau correctement
- Alerte quand votre serveur Tentacle TV doit être mis à jour
### EN
- Light, dark or automatic theme (follows the system setting), on iPhone, iPad and Android tablets
- Liquid Glass effects on iOS 26 (toggle in Appearance)
- Reorganized settings: account, appearance, playback, password and devices in dedicated screens
- Fix: the paired devices list shows correctly again
- Heads-up when your Tentacle TV server needs updating

## [1.3.1]
### FR
- Sous-titres : le formatage est respecté — gras, italique et position à l'écran (panneaux en haut) au lieu de tags affichés en code brut
- Sous-titres : ils s'affichent désormais aussi en lecture directe sur iPhone/iPad (ils pouvaient manquer selon le mode de lecture)
### EN
- Subtitles: formatting is honored — bold, italics and on-screen position (top signs) instead of raw tags showing as text
- Subtitles: now also displayed during direct play on iPhone/iPad (they could be missing depending on the playback mode)

---
