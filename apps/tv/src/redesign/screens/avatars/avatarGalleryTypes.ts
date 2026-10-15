import type { ImageSourcePropType } from "react-native";
import type { AvatarCollection, AvatarTemperament } from "@tentacle-tv/shared";
import type { AvatarGalleryPhase } from "@tentacle-tv/tv-core";

/**
 * Le contrat de la galerie des avatars : ce que l'intégration résout avant de
 * monter la vue. Les libellés FIXES — noms et histoires des personnages
 * (espace i18n `avatars`), titres des collections — sont traduits par la vue ;
 * les images et le sujet arrivent résolus.
 */

/** Un personnage de la grille, ses images résolues (embarquées ou servies). */
export interface AvatarGalleryCharacter {
  id: string;
  /** La couleur de son fond imprimé : la tuile la montre avant l'image, et la lumière de l'écran la prend. */
  tone: string;
  temperament: AvatarTemperament;
  /** La vignette de la grille (192 px). */
  thumb: ImageSourcePropType;
  /** Le grand portrait du panneau (512 px) ; la vignette le précède. */
  portrait: ImageSourcePropType;
}

export interface AvatarGallerySectionModel {
  collection: AvatarCollection;
  characters: AvatarGalleryCharacter[];
}

export interface AvatarGalleryModel {
  /** À qui va la photo : null — le sujet de la session (« Votre photo ») ; sinon le prénom de l'invité. */
  guestName: string | null;
  sections: AvatarGallerySectionModel[];
  /** L'écran : on parcourt, on envoie, c'est fait (tv-core `avatarGallery`). */
  phase: AvatarGalleryPhase;
}

export interface AvatarGalleryViewProps {
  model: AvatarGalleryModel;
  /** OK sur un personnage : le choisir. */
  onPick?: (id: string) => void;
  /** « Plus tard ». */
  onLater?: () => void;
}
