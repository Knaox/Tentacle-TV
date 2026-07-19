# Changelog — Serveur (backend + web, image Docker)

Blocs `## [X.Y.Z]` avec `### FR` / `### EN`. Lu par `.github/workflows/server.yml` :
quand `versions.json` → `server` change dans un push sur `main`, une Release
GitHub `server-vX.Y.Z` est créée avec ces notes. Chaque push publie l'image
`ghcr.io/knaox/tentacle-tv` (`:latest` + `:v<server>`).

## [Unreleased]
### FR
- …
### EN
- …

## [1.7.1]
### FR
- Web : thème clair refondu sur les bannières et les fiches — l'affiche reste vive (plus de voile nacré ni de flou), le texte posé sur l'image est blanc dans les deux thèmes, adossé à un dégradé sombre qui garantit la lisibilité même sur une affiche claire (même recette que le mobile)
- Web : micro-interactions raffinées — boutons à ressort, pastille de navigation qui glisse entre les onglets, entrée en cascade de la bannière, survol des affiches avec élévation douce, remplissage de l'indicateur au rythme du carrousel ; le tout respecte « réduire les animations »
- Web : ombres des cartes et liseré de la barre de navigation passés aux tokens du thème (fini les noirs et blancs figés, illisibles en clair)
- Web : l'espace excessif entre les rangées de l'accueil est resserré
- Plugins : les tokens « texte sur média » (blanc constant + assise sombre) sont désormais fournis à l'iframe des plugins
### EN
- Web: light theme reworked on banners and detail pages — artwork stays vivid (no more pearly veil or blur), on-image text is white in both themes, backed by a dark gradient that keeps it readable even over a bright poster (same recipe as mobile)
- Web: refined micro-interactions — springy buttons, navigation pill sliding between tabs, cascading banner entrance, soft card hover lift, carousel indicator fill synced to rotation; all honoring "reduce motion"
- Web: card shadows and navigation bar border now use theme tokens (no more fixed blacks and whites, unreadable in light mode)
- Web: excessive spacing between home rows tightened
- Plugins: "on-media" text tokens (constant white + dark backing) are now provided to the plugin iframe

## [1.7.0]
### FR
- Web : thème clair, sombre ou automatique — l'interface suit le réglage du système en direct ; choix dans Réglages, section Apparence
- Web : Réglages et Administration repensés en navigation latérale ; mot de passe, appareils jumelés et changement de serveur regroupés dans une section Sécurité
- Web : bannières et fiches en thème clair avec flou progressif — l'affiche garde ses couleurs, le texte reste lisible ; effet Liquid Glass activable
- Web : les plugins suivent le thème de l'application, clair compris
- Thème (admin) : les remplissages, surfaces verre, textes sur média et surfaces destructives deviennent surchargeables — l'éditeur passe de 104 à 121 tokens
- Thème (admin) : un changement de couleurs se propage désormais aux utilisateurs web au retour sur l'onglet, sans rechargement de page
### EN
- Web: light, dark or automatic theme — the interface follows the system setting live; pick yours in Settings, Appearance section
- Web: Settings and Administration redesigned with side navigation; password, paired devices and server switching grouped under a Security section
- Web: banners and detail pages in light theme use a progressive blur — artwork keeps its colors, text stays readable; Liquid Glass effect available
- Web: plugins follow the app theme, light included
- Theme (admin): fills, glass surfaces, on-media text and destructive surfaces become overridable — the editor grows from 104 to 121 tokens
- Theme (admin): color changes now reach web users when they return to the tab, without a page reload

## [1.6.2]
### FR
- Notifications Seer : fini les fausses annonces « est sorti(e) sur Tentacle TV » — le serveur vérifie désormais la présence RÉELLE du film ou des saisons dans la bibliothèque Jellyfin avant chaque envoi ; si le contenu n'y est pas (statut Jellyseerr périmé, ex. après une suppression), l'envoi est différé jusqu'à son arrivée réelle — une demande fraîchement créée ne peut plus déclencher une annonce de disponibilité mensongère
- Notifications Seer : disponibilité par saison — chaque saison est annoncée quand ELLE arrive (« Saison 1 est sortie », puis « Saison 2 est sortie » à son tour) ; l'annonce groupée n'est utilisée que si tout est disponible en même temps
- Les contenus arrivant via une demande Seer ne sont annoncés qu'à leur demandeur : la notification « ajouts bibliothèque » des autres utilisateurs ne se déclenche plus quand la demande de quelqu'un d'autre atterrit dans la bibliothèque — fini le « est sorti » reçu par tout le monde dès le premier épisode téléchargé
- Anti-doublon renforcé entre Seer et les ajouts bibliothèque : le contenu d'une notification Seer est identifié par son TMDB (retrouvé via la demande d'origine) même quand la revendication temporaire a expiré — les notifications de demandes restent, comme avant, strictement personnelles (chacun ne reçoit que SES demandes)
- Installation des plugins réparée sur un serveur Windows : l'extraction employait une option GNU tar (« --force-local ») inconnue du tar de Windows, faisant échouer toute installation depuis le marketplace — l'extraction passe par des chemins relatifs, compatibles avec les deux variantes de tar
- Version serveur minimale requise par les clients portée à 1.6.2
### EN
- Seer notifications: no more false “released on Tentacle TV” announcements — the server now verifies the movie or seasons are ACTUALLY present in the Jellyfin library before every push; if the content isn't there (stale Jellyseerr status, e.g. after a deletion), delivery is deferred until it really lands — a freshly created request can no longer trigger a lying availability announcement
- Seer notifications: per-season availability — each season is announced when IT arrives (“Season 1 released”, then “Season 2 released” in turn); the grouped announcement is only used when everything is available at once
- Content arriving through a Seer request is announced to its requester only: other users' “library additions” notification no longer fires when someone else's request lands in the library — no more “released” received by everyone as soon as the first episode is downloaded
- Stronger Seer ↔ library-addition deduplication: the content of a Seer notification is identified by its TMDB id (recovered from the original request) even when the temporary claim has expired — request notifications remain, as before, strictly personal (everyone only receives THEIR own requests)
- Plugin installation fixed on Windows servers: extraction used a GNU-tar-only option (“--force-local”) unknown to the Windows tar, making every marketplace install fail — extraction now uses relative paths, compatible with both tar flavors
- Minimum server version required by the clients raised to 1.6.2

## [1.6.1]
### FR
- Notifications : plus jamais de doublon — un contenu annoncé à un utilisateur ne l'est plus une deuxième fois, même après un redémarrage du serveur, un changement de préférences ou entre Seer et les ajouts bibliothèque (registre persistant consulté avant chaque envoi, alias TMDB + titre enregistrés ensemble pour neutraliser la résolution TMDB tardive)
- Notifications : toujours 1 notification par ajout (une série multi-épisodes = une seule notification groupée par saison), sans jamais retarder l'envoi — si les métadonnées ne sont pas prêtes, le nom brut est utilisé comme avant
- La notification de test devient un outil de diagnostic réservé au développement (invisible en production, même pour les administrateurs)
### EN
- Notifications: duplicates are gone for good — content announced to a user is never announced twice, even after a server restart, a preference change, or across Seer and library additions (persistent registry checked before every push, TMDB + title aliases recorded together to neutralize late TMDB resolution)
- Notifications: always 1 notification per addition (a multi-episode series = a single season-grouped notification), without ever delaying delivery — when metadata isn't ready the raw name is used, as before
- The test notification becomes a development-only diagnostic tool (invisible in production, even for administrators)

## [1.6.0]
### FR
- Watch Together : GIFs dans le chat de groupe — tendances et recherche (propulsées par KLIPY), envoi en un clic, animation à l'écran chez tous les membres. Aucune configuration : la clé est intégrée à l'application.
- Watch Together : réactions emoji plus fluides en rafale (limite anti-spam serveur assouplie) et nouveau canal temps réel dédié aux GIFs
- Sécurité : les URLs de GIFs partagées sont validées côté serveur (domaines KLIPY uniquement, HTTPS)
### EN
- Watch Together: GIFs in the group chat — trending and search (powered by KLIPY), one-click send, animated on screen for every member. Zero configuration: the key ships with the application.
- Watch Together: smoother rapid-fire emoji reactions (relaxed server anti-spam limit) and a new dedicated realtime channel for GIFs
- Security: shared GIF URLs are validated server-side (KLIPY domains only, HTTPS)

## [1.5.6]
### FR
- Notifications d'ajout : fini le doublon quand une saison arrive épisode par épisode — une seule notification « Série — Saison N » est envoyée par ajout, même si Jellyfin importe les épisodes en plusieurs vagues.
- Anti-doublon Seer/bibliothèque plus fiable : un contenu demandé via Seer est reconnu par son identifiant TMDB (et non plus par son titre), y compris pour les épisodes (via la série) et les films — plus de notification « ajout bibliothèque » en double quand le titre Jellyfin diffère du titre Seer (langue), ou quand le film vient d'être importé.
### EN
- Library-addition notifications: no more duplicate when a season arrives episode by episode — a single “Series — Season N” notification is sent per addition, even if Jellyfin imports the episodes in several waves.
- More reliable Seer/library deduplication: content requested through Seer is matched by its TMDB id (no longer by title), including for episodes (via the series) and movies — no more duplicate “library added” notification when the Jellyfin title differs from the Seer title (language), or when the movie was just imported.

## [1.5.5]
### FR
- Anti-doublon : un contenu demandé via le plugin Seer ne déclenche plus qu'UNE notification (celle de Seer, « … est sortie ») au lieu de deux (Seer + « ajout bibliothèque »). Les autres utilisateurs reçoivent toujours leur notification d'ajout.
- Les notifications d'ajout survivent au redémarrage : les contenus ajoutés pendant que le serveur était éteint sont notifiés au redémarrage (instantané persistant, plus « avalés » par la baseline).
- Notifications d'ajout : on attend que Jellyfin ait fini d'indexer un contenu avant de notifier — fini les titres en « nom de fichier » brut et les épisodes non regroupés quand les métadonnées (série, saison, numéro) n'étaient pas encore récupérées.
### EN
- Deduplication: content requested via the Seer plugin now triggers only ONE notification (Seer's “… is now on Tentacle TV”) instead of two (Seer + “library added”). Other users still get their library-addition notification.
- Library-addition notifications survive restarts: content added while the server was down is notified on restart (persistent snapshot, no longer swallowed by the baseline).
- Library-addition notifications: wait until Jellyfin has finished indexing an item before notifying — no more raw "filename" titles or ungrouped episodes when metadata (series, season, number) hadn't been fetched yet.

## [1.5.4]
### FR
- Notifications d'ajouts en bibliothèque : formulation « <contenu> est sorti·e sur Tentacle TV » avec accord grammatical (film/épisode/série/saison). Quand plusieurs épisodes d'une même saison arrivent ensemble, ils sont regroupés en « Série — Saison N (X épisodes) » au lieu d'être listés un par un.
- Le média est désormais nommé de façon fiable même quand Jellyfin date les fichiers par leur date d'origine (l'item n'apparaissait pas comme « récent ») — fini la notification générique « Nouveau sur Tentacle TV » sans titre.
### EN
- Library-addition notifications: new wording “<content> is now on Tentacle TV” with correct French grammatical agreement. When several episodes of the same season arrive together, they are grouped as “Series — Season N (X episodes)” instead of being listed one by one.
- The media is now reliably named even when Jellyfin dates files by their original date (the item didn't show up as “recent”) — no more generic “New on Tentacle TV” notification without a title.

## [1.5.3]
### FR
- Notifications d'ajouts en bibliothèque : la notification affiche désormais le titre exact du contenu (film, série, saison, ou épisode au format SxxExx) au lieu d'un libellé générique.
### EN
- Library-addition notifications: the notification now shows the exact title of the added content (movie, series, season, or episode in SxxExx format) instead of a generic label.

## [1.5.2]
### FR
- Notifications d'ajouts en bibliothèque : détection basée sur le nombre total d'items (fiable même quand Jellyfin date les contenus selon le fichier et non la date d'ajout), avec le titre récupéré quand c'est possible.
### EN
- Library-addition notifications: detection based on the total item count (reliable even when Jellyfin dates content by file date rather than add date), with the title fetched when available.

## [1.5.1]
### FR
- Notifications d'ajouts en bibliothèque : détection fiabilisée par interrogation périodique de Jellyfin (ne dépend plus uniquement de l'événement temps réel, qui pouvait être manqué) — les nouveaux contenus déclenchent désormais la notification de façon robuste.
### EN
- Library-addition notifications: detection made reliable via periodic polling of Jellyfin (no longer relying solely on the real-time event, which could be missed) — new content now triggers the notification reliably.

## [1.5.0]
### FR
- **Notifications push mobile** : l'app peut désormais recevoir des notifications même fermée. Deux réglages (Profil › Préférences › Notifications, opt-in) : nouveaux **ajouts en bibliothèque**, et — si le plugin Seer est actif — **contenu demandé disponible** (uniquement ses propres demandes). Nouveaux endpoints serveur `/api/push` (enregistrement du jeton Expo, préférences, notification de test réservée aux admins). Livraison via Expo Push → APNs (iOS) / FCM (Android).
### EN
- **Mobile push notifications**: the app can now receive notifications even when closed. Two opt-in settings (Profile › Preferences › Notifications): new **library additions**, and — when the Seer plugin is active — **requested content available** (your own requests only). New server `/api/push` endpoints (Expo token registration, preferences, admin-only test notification). Delivery via Expo Push → APNs (iOS) / FCM (Android).

## [1.4.1]
### FR
- Jumelage : un appareil (Android TV / Apple TV) dont le jumelage est révoqué est désormais déconnecté immédiatement et renvoyé à l'écran de jumelage — auparavant il pouvait rester connecté jusqu'à un échec d'authentification ultérieur (voire indéfiniment s'il restait inactif).
### EN
- Pairing: a device (Android TV / Apple TV) whose pairing is revoked is now disconnected immediately and sent back to the pairing screen — previously it could stay connected until a later authentication failure (or indefinitely if left idle).

## [1.4.0]
### FR
- Streaming direct : le serveur re-fournit automatiquement un jeton Jellyfin valide (repris d'un autre appareil du compte) quand celui d'un appareil jumelé est expiré ou absent — au jumelage et via `/api/config/streaming`. Requis par l'app TV pour la récupération automatique après une erreur de lecture.
### EN
- Direct streaming: the server now automatically re-provisions a valid Jellyfin token (borrowed from another device on the account) when a paired device's token is expired or missing — at pairing time and via `/api/config/streaming`. Required by the TV app for automatic recovery after a playback error.

## [1.3.0]
### FR
- Version courante du serveur (historique antérieur : voir CHANGELOG.md racine)
### EN
- Current server version (older history: see root CHANGELOG.md)

---
