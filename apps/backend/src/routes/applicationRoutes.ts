/**
 * Les routes de l'APPLICATION, dans l'ordre exact où le serveur les enregistre,
 * de l'authentification au proxy de Jellyfin. `index.ts` les pose après la
 * garde d'installation — qui les tient fermées (503) tant que l'installation
 * n'est pas finie, `/api/ws` excepté — et avant les clients servis
 * (`static/staticClients.ts`). Sorties d'`index.ts` pour le plafond de 300
 * lignes, sans rien changer : enregistrées sur l'instance RACINE (aucune
 * encapsulation de plus), dans le même ordre, avec les mêmes préfixes. Le proxy
 * générique de Jellyfin reste le DERNIER : ses routes précises (vignettes de
 * défilement) passent avant lui.
 *
 * Les routes ouvertes avant la fin de l'installation (assistant, santé, thème,
 * défi du test d'ouverture) restent dans `index.ts`, avec la garde et sa liste
 * blanche.
 */

import { accountAccessRoutes } from "./accountAccess";
import { accountAbilitiesRoutes } from "./accountAbilities";
import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth";
import { inviteRoutes } from "./invites";
import { configRoutes } from "./config";
import { demoRoutes } from "./demo";
import { preferenceRoutes } from "./preferences";
import { updateRoutes } from "./update";
import { ticketRoutes } from "./tickets";
import { notificationRoutes } from "./notifications";
import { pushRoutes } from "./push";
import { jellyfinProxyRoutes } from "./jellyfinProxy";
import { jellyfinTrickplayRoutes } from "./jellyfinTrickplay";
import { playbackSegmentRoutes } from "./playbackSegments";
import { adminRoutes } from "./admin";
import { adminDownloadRoutes } from "./adminDownloads";
import { adminMetadataRoutes } from "./adminMetadata";
import { adminTrailersRoutes } from "./adminTrailers";
import { adminSegmentRoutes } from "./adminSegments";
import { downloadRoutes } from "./downloads";
import { preparedDownloadRoutes } from "./downloadsPrepared";
import { pluginRoutes } from "./plugins";
import { pairRoutes } from "./pair";
import { familyRoutes } from "./family/familyRoutes";
import { adminFamilyRoutes, familyTvRoutes } from "./family/familyTvRoutes";
import { familyPickerRoutes } from "./family/familyPickerRoutes";
import { shareRoutes } from "./share";
import { tmdbRoutes } from "./tmdb";
import { heroArtworkRoutes } from "./heroArtwork";
import { trailerRoutes } from "./trailers";
import { trailerMediaRoutes } from "./trailerMedia";
import { trailerReadinessRoutes } from "./trailerReadiness";
import { trailerPreviewRoutes } from "./trailerPreview";
import { trailerPreviewWarmRoutes } from "./trailerPreviewWarm";
import { trailerCatalogRoutes } from "./trailerCatalog";
import { startPreviewMemory } from "../services/trailers/preview/previewMemoryStore";
import { startGuardState } from "../services/trailers/guardState";
import { gifRoutes } from "./gifs";
import { wsRoutes } from "./ws";
import { watchTogetherRoutes } from "./watchTogether";
import { watchTogetherInviteRoutes } from "./watchTogetherInvites";
import { watchTogetherUsersRoutes } from "./watchTogetherUsers";
import { playbackRightsRoutes } from "./playbackRights";
import { avatarRoutes } from "./avatars";
import { watchTogetherAffinityRoutes } from "./watchTogetherAffinity";
import { leaderboardRoutes } from "./leaderboard";
import { viewingStatsRoutes } from "./viewingStats";
import { ratingRoutes } from "./ratings";
import { likeRoutes } from "./likes";
import { swipeRoutes } from "./swipe";
import { watchlistRoutes } from "./watchlist";
import { recoRoutes } from "./reco";
import { recoPeopleRoutes } from "./recoPeople";
import { searchRoutes } from "./search";
import { libraryDeletionRoutes } from "./libraryDeletion";
import { libraryVisibilityRoutes } from "./libraryVisibility";
import { sagaRoutes } from "./sagas";
import { recoPageRoutes } from "./recoPage";
import { recoRowRoutes } from "./recoRows";
import { externalAccountRoutes } from "./externalAccounts";
import { musicRoutes } from "../music/routes/musicRoutes";
import { musicSharePublicRoutes } from "../music/playlistShare/shareRoutes";
import { musicOpenPublicRoutes } from "../music/sharedLinks/sharedLinkRoutes";

/** Enregistre, dans l'ordre, toutes les routes de l'application, puis le proxy de Jellyfin. */
export async function registerApplicationRoutes(app: FastifyInstance): Promise<void> {
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(accountAccessRoutes, { prefix: "/api/account" });
  await app.register(accountAbilitiesRoutes, { prefix: "/api/account" });
  await app.register(inviteRoutes, { prefix: "/api/invites" });
  await app.register(preferenceRoutes, { prefix: "/api/preferences" });
  await app.register(updateRoutes, { prefix: "/api/update" });
  await app.register(ticketRoutes, { prefix: "/api/tickets" });
  await app.register(notificationRoutes, { prefix: "/api/notifications" });
  await app.register(pushRoutes, { prefix: "/api/push" });
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.register(adminDownloadRoutes, { prefix: "/api/admin/downloads" });
  // Fichier séparé d'admin.ts : lui frôle déjà le plafond de 300 lignes.
  await app.register(adminMetadataRoutes, { prefix: "/api/admin" });
  await app.register(adminTrailersRoutes, { prefix: "/api/admin" });
  await app.register(adminSegmentRoutes, { prefix: "/api/admin" });
  await app.register(downloadRoutes, { prefix: "/api/downloads" });
  // La préparation tenue par le serveur (`offline.serverPrepare`), à part : `downloads.ts` est le flux direct.
  await app.register(preparedDownloadRoutes, { prefix: "/api/downloads" });
  await app.register(pluginRoutes, { prefix: "/api/plugins" });
  await app.register(pairRoutes, { prefix: "/api/pair" });
  // La Famille (docs/FAMILLE.md) : routes et appelants tirés du contrat.
  await app.register(familyRoutes, { prefix: "/api/family" });
  await app.register(familyTvRoutes, { prefix: "/api/family" });
  await app.register(familyPickerRoutes, { prefix: "/api/family" });
  await app.register(adminFamilyRoutes, { prefix: "/api/admin" });
  await app.register(shareRoutes, { prefix: "/api/share" });
  await app.register(tmdbRoutes, { prefix: "/api/tmdb" });
  await app.register(heroArtworkRoutes, { prefix: "/api/hero" });
  await app.register(trailerRoutes, { prefix: "/api/trailers" });
  // Les flux relayés des bandes-annonces : jeton dans l'URL, AVPlayer n'envoie pas d'en-tête.
  await app.register(trailerMediaRoutes, { prefix: "/api/trailers" });
  // Le diagnostic des bandes-annonces, résumé pour tout compte connecté.
  await app.register(trailerReadinessRoutes, { prefix: "/api/trailers" });
  // L'aperçu au survol d'une carte : une bande-annonce choisie, vérifiée, relayée.
  await app.register(trailerPreviewRoutes, { prefix: "/api/trailers" });
  // Sa préparation : les titres à l'écran se préparent en fond, ceux qui sont prêts reviennent tout de suite.
  await app.register(trailerPreviewWarmRoutes, { prefix: "/api/trailers" });
  // Le catalogue d'un titre : toutes ses bandes-annonces, la saison et la langue du serveur d'abord.
  await app.register(trailerCatalogRoutes, { prefix: "/api/trailers" });
  // Ses décisions et les sources du relais survivent à un redémarrage (aucune extraction à refaire).
  startPreviewMemory();
  // Les pauses et budgets des sources (YouTube, Dailymotion) aussi : un blocage ne se lève pas au redémarrage.
  startGuardState();
  await app.register(gifRoutes, { prefix: "/api/gifs" });
  await app.register(wsRoutes, { prefix: "/api/ws" });
  await app.register(watchTogetherRoutes, { prefix: "/api/watch-together" });
  await app.register(watchTogetherInviteRoutes, { prefix: "/api/watch-together" });
  await app.register(watchTogetherUsersRoutes, { prefix: "/api/watch-together" });
  await app.register(watchTogetherAffinityRoutes, { prefix: "/api/watch-together" });
  await app.register(leaderboardRoutes, { prefix: "/api/leaderboard" });
  await app.register(viewingStatsRoutes, { prefix: "/api/stats" });
  await app.register(ratingRoutes, { prefix: "/api/ratings" });
  await app.register(likeRoutes, { prefix: "/api/likes" });
  await app.register(swipeRoutes, { prefix: "/api/swipe" });
  await app.register(watchlistRoutes, { prefix: "/api/watchlist" });
  await app.register(recoRoutes, { prefix: "/api/reco" });
  await app.register(recoRowRoutes, { prefix: "/api/reco" });
  await app.register(recoPeopleRoutes, { prefix: "/api/reco" });
  await app.register(recoPageRoutes, { prefix: "/api/reco" });
  await app.register(searchRoutes, { prefix: "/api/search" });
  // Supprimer des titres par le jeton du compte : Jellyfin juge chacun (capacité `library.delete`).
  await app.register(libraryDeletionRoutes, { prefix: "/api/library" });
  await app.register(libraryVisibilityRoutes, { prefix: "/api/library" });
  await app.register(sagaRoutes, { prefix: "/api/sagas" });
  await app.register(externalAccountRoutes, { prefix: "/api/external" });
  // Octave : la musique de la bibliothèque Jellyfin (capacité `music.library`).
  await app.register(musicRoutes, { prefix: "/api/music" });
  // Le document et la page d'un lien de playlist partagée : SANS compte, hors de la session de `/api/music`.
  await app.register(musicSharePublicRoutes);
  // La page d'ouverture d'un lien d'Octave (`/octave/open/<page>`) : SANS compte, comme la précédente.
  await app.register(musicOpenPublicRoutes);
  await app.register(configRoutes, { prefix: "/api" });
  await app.register(demoRoutes, { prefix: "/api" });
  // Segments de lecture : le résolveur unique (préfixe hors /api/jellyfin —
  // aucun rapport d'ordre avec le proxy générique).
  await app.register(playbackSegmentRoutes, { prefix: "/api/playback" });
  await app.register(playbackRightsRoutes, { prefix: "/api/playback" });
  await app.register(avatarRoutes, { prefix: "/api/avatars" });

  // ── Jellyfin trickplay tiles (specific route — must register BEFORE the wildcard proxy) ──
  await app.register(jellyfinTrickplayRoutes, { prefix: "/api/jellyfin" });

  // ── Jellyfin proxy (all Jellyfin API calls go through here) ──
  await app.register(jellyfinProxyRoutes, { prefix: "/api/jellyfin" });
}
