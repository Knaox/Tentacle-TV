# Changelog — Mobile (iOS + Android)

Blocs `## [X.Y.Z]` avec sous-sections `### FR` / `### EN`. Lu par
`.github/workflows/mobile.yml` : App Store Connect iOS (max 4000 caractères),
Google Play (max 500). UN seul bloc sert iOS ET Android. Renommer `[Unreleased]`
en `[X.Y.Z]` au moment d'envoyer (la version vient de `versions.json` → `mobile`).

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
