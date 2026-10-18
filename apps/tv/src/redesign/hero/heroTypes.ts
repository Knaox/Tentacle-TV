import type { TrailerPreviewSubject } from "@tentacle-tv/shared";
import type { ArtworkPalette } from "../color/artworkPalette";
import type { IconName } from "../icons/Icon";
import type { MetaItem } from "./MetaLine";

/**
 * Le titre MIS EN AVANT d'une page (le héros de l'Accueil, de « Pour vous ») :
 * la zone d'aperçu dessine son fond et son texte (`zoneModelOfHero`), ses
 * boutons vivent dans la zone (`HeroZoneHead`).
 */

export interface HeroAction {
  label: string;
  icon?: IconName;
  progress?: number;
  focusKey: string;
}

export interface HeroModel {
  id: string;
  kicker?: string;
  /** La suite du surtitre, sur sa propre ligne : pourquoi ce titre est là
   *  (« Parce que vous avez aimé … »). Le logo et le synopsis se resserrent. */
  reason?: string;
  title: string;
  logoUri?: string;
  backdropUri?: string;
  meta: MetaItem[];
  synopsis?: string;
  palette: ArtworkPalette;
  primary: HeroAction;
  secondary?: HeroAction;
  /** Le rond « Ma liste » : plus quand le titre n'y est pas, coche sinon. */
  listToggle?: { label: string; active: boolean; focusKey: string };
  /** Position dans la rotation (points en bas à droite). */
  page?: { index: number; count: number };
  /** Sa bande-annonce, jouée dans la zone d'aperçu quand ses boutons ont le focus. */
  trailer?: TrailerPreviewSubject;
}
