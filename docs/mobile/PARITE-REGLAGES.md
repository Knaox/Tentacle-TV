# Réglages — parité du mobile avec le web et le bureau (21/10, base `dev`)

Audit des réglages du web et du bureau (`apps/web/src/pages/settings/`,
`pages/Preferences.tsx`, `components/settings/`) contre ceux du mobile, dont la
structure est le catalogue partagé `packages/shared/src/settingsCatalog/`
(rubriques `settingsSections.ts`, portée et contrôle `settingsControls.ts`,
liste « Réservé au bureau » `DESKTOP_ONLY_SETTINGS`). Règle suivie : un réglage
n'entre sur le mobile que s'il y a un effet RÉEL ; jamais un interrupteur décoratif.

## Ajouté

| Réglage | Où sur le mobile | Portée | Effet |
|---|---|---|---|
| Comptes liés : session invitée TMDB, file de synchronisation des notes et sa relance | Lecture et apparence › Accueil et recommandations, en bas | compte (`/api/external/accounts`) | les notes posées sur le téléphone partent par elle ; jamais en session de profil (le serveur y refuse `/api/external`) |

## Déjà à parité sur `dev` (rien à faire)

- Lecture (compte) : mode des passages (`intros`), enchaîner (`nextAutoPlay`),
  « Vous regardez encore ? » (autre session), langues par bibliothèque, langue de
  l'interface, **« Tendances actuelles »** (`trendingNow`, capacité `reco.trending`).
- Appareil : thème, Liquid Glass, sous-titres (taille, position), économie de
  données, moteur vidéo et ses options ; ouverture animée et son.
- Personnalisation : source du bandeau, titre fixe, rangées de l'accueil,
  recommandations (personnalisées, Vigie, communautaire, historique, équilibre,
  remise à zéro).
- Compte : photo, mot de passe, Famille, changer de profil, « Qui regarde ? » au
  démarrage, changer de serveur, invitations, sessions, supprimer le compte.
- Hors ligne et notifications : le mobile en a plus que le web (push, Wi-Fi
  seulement, arrière-plan, « prêt », suivi en direct).

## Écartés (et pourquoi)

| Réglage web / bureau | Raison |
|---|---|
| Réglage fin des passages (action par passage, délais, décompte) et de la fin d'un épisode (fiche, compte à rebours, affiche de fin, déclencheur, seuils par bibliothèque) | décision déjà prise dans le catalogue : `DESKTOP_ONLY_SETTINGS`, la ligne « Réglages avancés : sur l'app bureau » les énumère ; ils suivent le compte et s'appliquent au mobile |
| Aperçus de bande-annonce au survol + leur délai | pas de survol sur un écran tactile ; le mobile ne joue aucun aperçu |
| Décodage matériel, bascule HDR de l'écran, session Wayland / X11 | propres au bureau (mpv par koffi, Windows, Linux) |
| Emplacement des fichiers gardés hors ligne | le système fixe le dossier de l'app (bac à sable iOS / Android) |

## À trancher par Damien

- **Taille des cartes** : elle EXISTE sur le mobile (Accueil et recommandations ›
  Rangées de l'accueil, `cardDensity` du compte) et agit sur l'accueil
  (`contexts/CardDensityContext.tsx` : × 0,85 / 1 / 1,2). Ni ajoutée ni retirée ici.

## Historique de la branche

Une première passe, faite par erreur sur `main`, ajoutait « Tendances actuelles »
dans Recommandations et le réglage fin de la lecture : sur `dev`, le premier existe
déjà et le second est volontairement réservé au bureau. Elle est conservée dans
`refs/archive/mobile-parite-reglages-avant-rebase`.
