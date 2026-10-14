import type { WhatsNewRelease } from "../types";
import { AvatarsScene, TrailerPreviewScene, WhoIsWatchingScene } from "../scenes/v1_29_0";

/**
 * 1.29.0 — la bande-annonce au survol, « Qui regarde ? » sur l'ordinateur, et
 * la galerie des photos de profil.
 *
 * Trois scènes : la mini-carte qui grandit depuis l'affiche (la vidéo, ses
 * plans, le bandeau, le son) ; le choix d'un profil — son code PIN —, et
 * « Changer de profil » dans le menu de l'avatar, qui y ramène ; la photo de
 * l'en-tête du menu, qui ouvre la troupe, et un personnage choisi. Les deux
 * premières fonctions dépendent du serveur 1.29.0 : face à un serveur qui ne
 * les déclare pas, l'app n'en montre rien, et l'écran non plus (`capability`) ;
 * la galerie, elle, ne demande rien au serveur. Le reste du bloc (YouTube
 * ménagé, des aperçus plus légers, « Vider le cache ») se dit dans le changelog.
 *
 * Les textes vivent dans l'espace i18n `whatsNew` (v1_29_0_<id>_title / _body).
 */
export const RELEASE_1_29_0: WhatsNewRelease = {
  version: "1.29.0",
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
      // Pas de lien profond : la galerie s'ouvre depuis l'en-tête du menu de l'avatar, sans page à elle.
      id: "avatars",
      kind: "new",
      titleKey: "v1_29_0_avatars_title",
      bodyKey: "v1_29_0_avatars_body",
      Scene: AvatarsScene,
    },
  ],
};
