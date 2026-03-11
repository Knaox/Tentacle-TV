# Release Notes — Tentacle TV v1.2.0

## Nouveautés

### Reconnexion automatique mobile (Keychain / Keystore)

Quand le serveur Jellyfin redémarre et invalide les tokens, l'app mobile se reconnecte automatiquement sans intervention utilisateur :

- **Stockage sécurisé** — les credentials sont chiffrés via iOS Keychain / Android Keystore (expo-secure-store)
- **Ré-authentification transparente** — tentative auto via `POST /api/auth/login` quand le token expire
- **Nettoyage intelligent** — credentials effacés en cas de changement de mot de passe, conservés en cas d'erreur réseau (réessai possible)
- **Logout propre** — credentials supprimés du Keychain/Keystore lors de la déconnexion

### Support Android (compatible, build à venir)

- L'app mobile Expo est **compatible Android** (React Native 0.76 + Expo 52)
- Build APK/AAB pas encore publié — arrivera dans une prochaine release
- Player vidéo Android fonctionnel avec react-native-video
- Interface responsive adaptée aux écrans Android

### Correction page blanche après premier login (Web & Desktop)

- Le hook `useUserId()` est désormais **réactif** via `useSyncExternalStore` — les composants re-rendent quand l'utilisateur change
- Ajout de `queryClient.invalidateQueries()` après login pour forcer le refetch des données
- Plus de page blanche au premier login — les données se chargent immédiatement

### Navigation "Tout voir" & Partage de Watchlist

- **"Tout voir" cliquable** — le label "Tout voir" sur les carousels "Ma Liste" et bibliothèques est désormais un lien vers la page complète (`/watchlist`, `/library/:id`)
- **Page /watchlist** — vue grille complète de Ma Liste avec filtres Tous/Films/Séries, bouton retour, responsive
- **Page /favorites** — vue grille complète des favoris avec filtres Tous/Films/Séries
- **Partage de watchlist** — les utilisateurs peuvent partager leur liste avec d'autres utilisateurs Jellyfin via un toggle dans une modal dédiée
- **Listes partagées** — section sur `/watchlist` affichant les listes partagées par d'autres utilisateurs (lecture seule, avec aperçu posters)
- **Notifications** — l'utilisateur invité reçoit une notification quand quelqu'un partage sa liste avec lui

### Favoris & Watchlist ("Ma Liste")

- **Watchlist "Ma Liste"** — basée sur `UserData.Likes` (per-user natif Jellyfin), ajout/retrait via bouton bookmark sur la page détail
- **Section Home** — nouveau carousel "Ma Liste" affiché entre "Prochains épisodes" et "Déjà visionné" (masqué si vide)
- **Menu contextuel** — clic droit (desktop) ou long press (mobile) sur les cartes du carousel pour toggle Favori / Ma Liste
- **Optimistic updates** — feedback visuel immédiat sur toggle favori et watchlist, avec rollback en cas d'erreur
- **Bouton bookmark** — nouveau bouton sur la page détail (icône bookmark violet) entre le coeur et le check

### Identification client par plateforme dans Jellyfin

Le Dashboard Jellyfin affiche désormais un nom de client distinct pour chaque plateforme :

| Plateforme | Client affiché | Version |
|---|---|---|
| Web | Tentacle TV - Web | depuis package.json web |
| Desktop | Tentacle TV - Desktop | depuis package.json desktop |
| Mobile | Tentacle TV - Mobile | depuis package.json mobile |
| TV | Tentacle TV - TV | depuis package.json tv |
| Backend | Tentacle TV | depuis package.json backend |

## Corrections

### Docker & Déploiement

- **Préservation tables plugins** — retrait de `--accept-data-loss` sur `prisma db push` dans l'entrypoint Docker et le hook de déploiement. Les tables créées par les plugins (ex: Seer) ne sont plus supprimées lors des mises à jour.
- **Build Docker corrigé** — correction des types implicites `any` dans `sharedWatchlists.ts` qui cassaient `tsc` dans le Dockerfile
- **Ordre Prisma** — `prisma generate` avant `pnpm build` dans le Dockerfile

### CI / Releases

- **Auto-update Tauri fonctionnel** — `releaseDraft: false` dans le workflow pour que `latest.json` soit accessible via `/releases/latest/download/latest.json`
- **Secret signing** — ajout de `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` pour générer les artefacts updater (`.sig`, `.tar.gz`, `latest.json`)
- **Cloudflare worker** — le lien de téléchargement macOS redirige désormais vers le `.dmg` direct au lieu de la page GitHub

## Plateformes

| Plateforme | Statut |
|---|---|
| Web (React 19) | Disponible |
| macOS (Tauri v2, signé & notarisé) | Disponible |
| Windows (Tauri v2, MSI / EXE) | Disponible |
| iOS (Expo 52) | Bientôt |
| Android (Expo 52) | Compatible — build à venir |
| Android TV | Bientôt |
| Docker (self-hosted) | Disponible |
