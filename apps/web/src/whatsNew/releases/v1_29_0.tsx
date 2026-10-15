import type { WhatsNewRelease } from "../types";
import {
  AvatarsScene, FamilyPinScene, GuestParentalScene, HeroSourceScene, NotificationsScene, StillWatchingScene, TrailerPreviewScene,
  UserRightsScene, WhoIsWatchingScene,
} from "../scenes/v1_29_0";

/**
 * 1.30.0 — la bande-annonce au survol, « Qui regarde ? » sur l'ordinateur, le
 * code PIN conseillé, le contrôle parental des invités, « Vous regardez
 * encore ? », la galerie des photos de profil, la source du bandeau principal
 * (« Pour vous — Films / Séries », Personnalisation réorganisée), la cloche
 * refaite, et tous les droits d'un compte dans l'administration.
 *
 * Neuf scènes : la mini-carte qui grandit depuis l'affiche (la vidéo, ses
 * plans, le bandeau, le son) ; le choix d'un profil — son code PIN —, et
 * « Changer de profil » dans le menu de l'avatar, qui y ramène ; « Action
 * recommandée », puis le code posé ; le contrôle parental d'une invitée posé
 * depuis la Famille, jamais au-delà des droits de son créateur ; l'encart du lecteur, son décompte, puis
 * la pause ; la photo de l'en-tête du menu, qui ouvre la troupe, et un
 * personnage choisi ; le bandeau principal de Personnalisation, chaque source
 * dite par ce qu'elle montre, « Pour vous — Films » puis « — Séries » cochés
 * (`home.heroRecoKinds` : sans elle, ces sources n'existent pas) ; la cloche, ses notifications par jour et leur état, et le
 * clic qui ouvre la fiche du titre arrivé ; la fiche d'un compte qui s'ouvre
 * sur « Contrôle parental », la note posée et le résumé qui suit (aux seuls
 * administrateurs, `audience`). Les fonctions qui dépendent du
 * serveur 1.30.0 portent leur capacité : face à un serveur qui ne les déclare
 * pas, l'app n'en montre rien — ou, pour la cloche, ni état ni destination
 * exacte —, et l'écran non plus (`capability`) — le code PIN conseillé suit
 * « Qui regarde ? » (`family.desktopProfiles`) : sur l'ordinateur, c'est là
 * qu'il protège un profil. La galerie, elle, ne demande rien au serveur. Le
 * reste du bloc (YouTube ménagé, des aperçus plus légers, « Vider le cache »,
 * plus rien de coupé dans une petite fenêtre) se dit dans le changelog.
 *
 * Les textes vivent dans l'espace i18n `whatsNew` (v1_29_0_<id>_title / _body).
 */
export const RELEASE_1_29_0: WhatsNewRelease = {
  version: "1.30.0",
  features: [
    {
      id: "trailerPreview",
      kind: "new",
      titleKey: "v1_29_0_trailerPreview_title",
      bodyKey: "v1_29_0_trailerPreview_body",
      Scene: TrailerPreviewScene,
      route: "/",
      capability: "trailers.preview",
    },
    {
      id: "profiles",
      kind: "new",
      titleKey: "v1_29_0_profiles_title",
      bodyKey: "v1_29_0_profiles_body",
      Scene: WhoIsWatchingScene,
      route: "/settings/family",
      capability: "family.desktopProfiles",
    },
    {
      id: "familyPin",
      kind: "new",
      titleKey: "v1_29_0_familyPin_title",
      bodyKey: "v1_29_0_familyPin_body",
      Scene: FamilyPinScene,
      route: "/settings/family",
      capability: "family.desktopProfiles",
    },
    {
      id: "guestParental",
      kind: "new",
      titleKey: "v1_29_0_guestParental_title",
      bodyKey: "v1_29_0_guestParental_body",
      Scene: GuestParentalScene,
      route: "/settings/family",
      capability: "family.parentalControls",
    },
    {
      id: "stillWatching",
      kind: "new",
      titleKey: "v1_29_0_stillWatching_title",
      bodyKey: "v1_29_0_stillWatching_body",
      Scene: StillWatchingScene,
      route: "/settings/playback",
      capability: "playback.stillWatching",
    },
    {
      // Pas de lien profond : la galerie s'ouvre depuis l'en-tête du menu de l'avatar, sans page à elle.
      id: "avatars",
      kind: "new",
      titleKey: "v1_29_0_avatars_title",
      bodyKey: "v1_29_0_avatars_body",
      Scene: AvatarsScene,
    },
    {
      // Les sources « Pour vous — Films / Séries » n'existent que face à un serveur
      // qui les déclare : sans elles, la fiche se tairait sur une Personnalisation
      // qui ne les propose pas.
      id: "heroSource",
      kind: "improved",
      titleKey: "v1_29_0_heroSource_title",
      bodyKey: "v1_29_0_heroSource_body",
      Scene: HeroSourceScene,
      route: "/settings/personalization",
      capability: "home.heroRecoKinds",
    },
    {
      // Pas de lien profond : la cloche est dans la barre, sur toutes les pages.
      // La cible et l'état viennent du serveur 1.30.0 : sans eux, la cloche ouvre
      // la route du type, comme avant — l'écran ne vanterait pas ce qu'elle ne fait pas.
      id: "notifications",
      kind: "improved",
      titleKey: "v1_29_0_notifications_title",
      bodyKey: "v1_29_0_notifications_body",
      Scene: NotificationsScene,
      capability: "notifications.targets",
    },
    {
      id: "userRights",
      kind: "new",
      titleKey: "v1_29_0_userRights_title",
      bodyKey: "v1_29_0_userRights_body",
      Scene: UserRightsScene,
      route: "/admin/users",
      audience: "admin",
      capability: "admin.userRights",
    },
  ],
};
