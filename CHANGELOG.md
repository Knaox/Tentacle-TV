# Changelog

Toutes les évolutions notables de Tentacle TV.
Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/).

## [1.8.5] - 2026-06-07

Desktop 1.8.5 — Web 1.0.0-beta.4

### Corrigé
- Backend : page `yt-embed.html` framable depuis l'origine `tauri://` (DMG macOS). Helmet posait `X-Frame-Options: SAMEORIGIN` qui bloquait l'iframe → erreur 153 persistante. Hook ciblé qui retire XFO et impose `Referrer-Policy: strict-origin-when-cross-origin` uniquement pour ce chemin.
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
