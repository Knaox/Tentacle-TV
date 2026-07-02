# Changelog

Toutes les évolutions notables de Tentacle TV.
Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/).

> **Notes de version stores** : un bloc par **canal** `## [<canal>-<version>]` avec
> `### FR` et `### EN` — canaux : `mac`, `ios`, `atv`, `win`, `play`
> (ex. `## [ios-1.2.4]`, `## [win-1.10.1]`). La CI extrait ces sections
> (`.github/scripts/release-notes.mjs`) pour : « Nouveautés »/« À tester »
> App Store & TestFlight (4000 car.), les notes Microsoft Store (1500 car.),
> les « Nouveautés » Google Play (500 car.) et le corps des releases GitHub.
> Repli : bloc `## [x.y.z]` sans préfixe (historique). Sans `### EN`, la section
> FR sert aux deux langues. Le markdown est converti en texte brut pour les stores.

## [1.2.3]

iOS 1.2.3 — macOS 1.1.0 — Desktop 1.10.0 — Backend 1.2.0

### FR
- **Administration réorganisée** : les Tickets de support et les Services ont désormais leur page dédiée ; les invitations sont repliables et peuvent être supprimées.
- **Jumeler TV** : les appareils jumelés et le code de provisionnement sont regroupés là (visibles par l'administrateur). Le jumelage est verrouillé tant que l'URL publique du serveur n'est pas renseignée, avec un message clair.
- **Compatibilité serveur** : un bandeau avertit l'administrateur lorsque le serveur est plus ancien que l'application.
- Corrections diverses et améliorations de stabilité.

### EN
- **Reorganized administration**: Support tickets and Services now have their own dedicated pages; invites are collapsible and can be deleted.
- **Pair TV**: paired devices and the provisioning code are grouped here (visible to administrators). Pairing is locked until the public server URL is set, with a clear message.
- **Server compatibility**: a banner warns the administrator when the server is older than the app.
- Various fixes and stability improvements.

## [1.0.0]

macOS — première version sur le Mac App Store (relance en 1.0.0 ; le desktop hors store était en 1.9.x).

### FR
- Première version de Tentacle TV pour macOS sur l'App Store.
- Lecteur vidéo haute performance (mpv/FFmpeg) avec décodage matériel.
- Jumelage rapide, lecture directe et reprise de lecture.

### EN
- First release of Tentacle TV for macOS on the App Store.
- High-performance video player (mpv/FFmpeg) with hardware decoding.
- Fast pairing, direct play and resume playback.

## [1.9.4] - 2026-06-11

Desktop 1.9.4 — Web 1.0.0-beta.6

### Corrigé
- **Bandes-annonces des plugins** (Seer) : l'embed YouTube ne peut pas fonctionner dans l'iframe sandboxée d'un plugin (restrictions navigateur) → la lecture passe désormais par la modale bande-annonce du host (web et desktop).

## [1.9.3] - 2026-06-11

Desktop 1.9.3 — Web 1.0.0-beta.6

### Ajouté
- **Bridge plugins** : les plugins (iframe sandboxée) peuvent ouvrir des liens dans le navigateur système et détecter la plateforme hôte (`__tentacle_env`) — utilisé par Seer pour le comportement bandes-annonces identique au core (macOS DMG inclus).
- `/api/tmdb/resolve` renvoie les **RemoteTrailers** Jellyfin de l'item résolu (fusion trailers Jellyfin + TMDB dans le plugin Seer).

### Corrigé
- **Sessions persistantes — plus de déconnexions intempestives** (web, TV, mobile, desktop) :
  - les appareils appairés (TV) ne sont plus déconnectés : leur jeton n'expire plus dans le temps (révocation immédiate toujours possible depuis l'admin) et `/api/auth/refresh` les reconnaît désormais ;
  - un redémarrage/panne de Jellyfin (5xx) n'est plus confondu avec un jeton invalide : la session est conservée ;
  - cookie web prolongé (400 jours glissants, renouvelé toutes les 12 h d'utilisation) et double tentative de refresh avant déconnexion ;
  - TV : si la clé de streaming direct expire, bascule silencieuse en mode proxy au lieu d'un retour à l'écran de connexion.

## [1.9.2] - 2026-06-10

Desktop 1.9.2 — Web 1.0.0-beta.5

### Ajouté
- **« Ma liste » au niveau série** : le « + » (et le cœur Favoris) sur un **épisode** agit désormais sur la **série parente** ; tous les épisodes d'une série affichent l'état « ajouté » dès qu'elle est dans la liste, sans refresh.
- **Reset à l'ajout** : ajouter à Ma liste une série / un film **déjà vu à 100 %** le remet à zéro (re-regarder à neuf) ; s'il est seulement **commencé**, la reprise est conservée.

### Modifié
- Carrousel et page **Ma liste / Favoris** : mise à jour **instantanée** à l'ajout comme au retrait (insertion/retrait optimiste + resynchronisation).
- **Retrait automatique de Ma liste** quand un film / une série est vu à 100 % (à la complétion réelle, plus au simple lancement du lecteur ; pour une série, au visionnage du dernier épisode). **Exception** : une série **en cours de diffusion** (`Continuing`) n'est jamais retirée, même si tous les épisodes diffusés sont vus.

### Corrigé
- Bouton « Ma liste » de la fiche détail qui n'affichait jamais l'état « ajouté » (UserData non chargé sur la requête de détail).

## [1.9.1] - 2026-06-10

Desktop 1.9.1 — Web 1.0.0-beta.5

### Corrigé
- **Lien « Partager ma liste » sur desktop** : le lien généré pointait vers `tauri.localhost` au lieu de l'URL publique du serveur → inutilisable. Il est désormais construit depuis l'URL serveur configurée (`tentacle_server_url`).
- **Déploiement prod** : le core ne gère plus les tables du plugin Seer via `prisma db push` (régénération du client Prisma au démarrage + tables core appliquées de façon additive). Corrige les erreurs 500 sur `/api/share`.

## [1.9.0] - 2026-06-09

Desktop 1.9.0 — Web 1.0.0-beta.5 — Mobile 1.2.0

### Ajouté
- **Partage de liste par lien** : bouton « Partager ma liste » (web/desktop/mobile) générant un lien public `/share/:token`. Lien **Live** (reflète la watchlist actuelle du propriétaire). Page publique en lecture seule si déconnecté ; sélection multiple + « Ajouter à ma liste » + « Tout sélectionner » si connecté. Se connecter depuis le lien renvoie automatiquement vers le lien.
- **Fiche détail publique de partage** (`/share/:token/:itemId`) : bouton « plus d'infos » sur chaque vignette → résumé du média (backdrop, synopsis, casting) + bandes-annonces visibles par tous, **sans saisons ni lecture** du contenu.
- **Méta-tokens qualité/langues** unifiés (`MetaChips`) : tokens texte discrets (VF / VFQ / VOSTFR / EN / JP…) en remplacement des drapeaux pays ; chips qualité monochromes (4K seul accent). Révélés au survol sur toutes les cartes (accueil, bibliothèque, favoris, ma liste).
- **Mobile — parité fiche détail** : extras / bandes-annonces (films, séries, épisodes), liste « Saisons & Épisodes » sur fiches série ET épisode avec épisode courant/à reprendre surligné, navigation vers la série depuis un épisode.
- **Mobile — lecteur** : sélecteur saison/épisode intégré ; support portrait + paysage.

### Modifié
- Fiches détail : qualité affichée à côté du titre (retirée de la bannière) ; extras déplacés au-dessus de « Saisons & Épisodes » ; extras de la série aussi affichés sur la fiche épisode ; épisode courant/à reprendre surligné. Méta des épisodes affichée à côté du titre (plus sur la miniature).
- Bannière d'épisode (accueil) : qualité/langues en texte sobre à côté du titre.
- Bouton « plus d'infos » des cartes 16/9 : grande flèche sans cercle + assombrissement du bas au survol (sans chevaucher le titre).
- Suppression complète de l'ancienne feature « listes partagées » collaboratives (web, mobile, backend, base de données).

### Corrigé
- **Déploiement prod** : `prisma db push` ne supprime plus les tables du plugin Seer (`seer_user_settings` désormais déclarée au schéma).
- Mobile — lecteur : titre masqué/chevauchant la barre d'état en portrait (safe-area) ; un tap sur l'écran masque/affiche l'overlay pendant la lecture.
- Méta des ajouts récents (épisodes uniques) désormais visible au survol.

## [1.8.6] - 2026-06-07

Desktop 1.8.6 — Web 1.0.0-beta.4

### Corrigé
- Bandes-annonces et extras TMDB absents/non localisés sur desktop (Tauri) : la BA s'affichait en anglais VOSTFR et la rangée « Extras » TMDB était vide, alors que le web fonctionnait. Cause : les appels à la route backend `/api/tmdb/trailers` (et `/api/tmdb/check-platform`) résolvaient l'URL backend via la clé `localStorage` `tentacle_backend_url`, jamais écrite côté desktop (qui n'enregistre que `tentacle_server_url`). Le fallback `window.location.origin` valait alors `tauri://`/`tauri.localhost` → le fetch échouait silencieusement, donc aucune vidéo TMDB n'arrivait (plus de tri VF possible, plus d'extras). Sur web, ce même fallback pointait par chance vers le backend same-origin. Résolution alignée sur le `backendUrl` canonique de l'app via un helper unique `lib/backendBase.ts` (`tentacle_server_url` sur desktop, same-origin sur web). Corrige aussi le filtre par plateforme TMDB et le relais `yt-embed.html` (macOS) qui souffraient du même bug.

## [1.8.5] - 2026-06-07

Desktop 1.8.5 — Web 1.0.0-beta.4

### Corrigé
- Backend : page `yt-embed.html` framable depuis l'origine `tauri://` (DMG macOS). Helmet posait `X-Frame-Options: SAMEORIGIN` qui bloquait l'iframe → erreur 153 persistante. Hook ciblé qui retire XFO et impose `Referrer-Policy: strict-origin-when-cross-origin` uniquement pour ce chemin.
- Bandes-annonces YouTube macOS DMG (erreur 153, définitif) : WKWebView strip le Referer pour TOUTES les requêtes des frames descendants quand le frame racine est `tauri://`, peu importe `Referrer-Policy`, `referrerpolicy` iframe ou `&origin=` (limitation Tauri/WebKit, cf. tauri#14422 / #14278). Sur macOS DMG uniquement, les bandes-annonces et trailers d'extras s'ouvrent désormais directement dans le navigateur système (où le top-level est `youtube.com`, donc pas de problème de Referer). Web, Windows desktop et dev macOS conservent l'embed inline.
- Carrousel « Reprendre la lecture » : au retour sur la home après lecture, l'item venait d'être lu n'était pas remonté en tête sans refresh. Les cleanups React s'exécutaient en ordre inverse, déclenchant l'invalidation des queries AVANT le report `/Sessions/Playing/Stopped` → Jellyfin n'avait pas mis à jour `DatePlayed`. L'invalidation est désormais différée à un microtask, ce qui chaîne correctement après le stop.

## [1.8.4] - 2026-06-07

Desktop 1.8.4

### Corrigé
- Liens externes du desktop : le bouton « Ouvrir sur YouTube » (et les liens des pages Crédits / attributions de licence) n'ouvraient pas le navigateur dans le webview Tauri (notamment WKWebView/macOS). Ajout du plugin `opener` ; les liens externes s'ouvrent désormais dans le navigateur système.

## [1.8.2] - 2026-06-07

Desktop 1.8.2

### Corrigé
- Bandes-annonces YouTube sur macOS (erreur 153) : le moteur WKWebView (origine `tauri://`) n'envoie aucun referrer HTTP valide, ce que `referrerPolicy` seul ne corrige pas. L'embed passe désormais, sur macOS desktop, par une page intermédiaire servie en HTTP(S) par le backend (`/yt-embed.html`) qui relaie l'embed avec une origine valide. Web et Windows conservent l'embed direct.

## [1.8.1] - 2026-06-06

Desktop 1.8.1

### Corrigé
- Bandes-annonces YouTube : erreur 153 (« referrer manquant »). L'embed force désormais une `referrerPolicy` explicite, ce qui corrige la prod web (header `Referrer-Policy: no-referrer`) et vise le client macOS (WKWebView, origine `tauri://`). Le desktop Windows (WebView2, origine `http://tauri.localhost`) n'était pas affecté.

## [1.8.0] - 2026-06-06

Desktop 1.8.0 — Web 1.0.0-beta.3

### Ajouté
- Bouton « Plus d'infos » discret au survol des cartes Reprendre la lecture et Prochains épisodes (ouvre la fiche détaillée ; le clic sur la carte lance toujours la lecture).
- Bandes-annonces dans la fiche média : les trailers locaux se lisent dans le lecteur ; les trailers YouTube s'ouvrent dans une fenêtre intégrée avec un repli « Ouvrir sur YouTube ». Liste complète (bandes-annonces et teasers) via Jellyseerr/TMDB, fusionnée avec celles de Jellyfin et priorisée selon la langue de l'interface.
- Section « Extras » regroupée par saison.
- Accès rapide à la série depuis la fiche d'un épisode.
- Sélecteur saison/épisode intégré au lecteur (web et desktop).
- Windows : contrôles média système (SMTC) — touches média (lecture, pause, stop, suivant, précédent) et overlay « En cours de lecture » (titre, série, affiche) ; nommage de la session audio (« Tentacle TV ») dans le mélangeur de volume.

### Modifié
- Les cartes affichent la vraie image de l'épisode (16:9), avec repli sur le backdrop de la série.
- « Derniers ajouts » liste désormais les épisodes individuels : regroupement en collection (badge « +N ») uniquement pour des ajouts consécutifs d'une même série ; la tuile groupée utilise le poster de la série tout en gardant le libellé d'épisode ; les éléments déjà vus restent affichés dans la rangée.

### Corrigé
- Intégration YouTube autorisée par la politique de sécurité (CSP) de l'application.
- « Derniers ajouts — Séries » n'est plus tronqué lors d'un ajout massif d'épisodes.
- Le sélecteur de bande-annonce lance bien la vidéo sur laquelle on clique ; contrôles aux couleurs du thème.

---

Les versions antérieures sont disponibles sur la page des releases :
https://github.com/Knaox/Tentacle-TV/releases
