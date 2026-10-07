import type { RenderTier } from "../device/renderTier";
import { RENDER_PROFILES, type RenderPlatform, type RenderProfile } from "./renderProfile";

/**
 * Le profil de rendu LITE d'Android TV — les box et téléviseurs peu
 * puissants (niveau `lite`, `device/renderTier`). Même disposition, même
 * navigation, même identité (encre #080812, accent #8B5CF6, DM Sans) : seuls
 * les EFFETS changent, chacun remplacé par un équivalent sobre, d'après ce
 * qu'il coûtait sur la Shield (images ratées, `docs/android-tv-lite/BASELINE.md`) :
 *
 * | Effet | Normal | Lite |
 * |---|---|---|
 * | Mouvement (26 % → 3 % coupé) | ressorts, fondus longs | fondus brefs, sans ressort (`liteMotion`) |
 * | Focus d'une carte (26 → 9,5 %) | × 1,08, ombre ou lueur, reflet | liseré d'accent |
 * | Fond vivant (26 → 18 %) | trois lumières, qui suivent le focus | une teinte FIXE, la même partout |
 * | Ombres (26 → 18 %) | masque flouté | bord fin |
 * | Verre (26 → 19 %) | voile, reflet, liserés | aplat, bord fin |
 * | Dégradés (26 → 19 %) | tous les arrêts | deux arrêts |
 * | Fondu de page (39 → 31 %) | 320 ms | coupe nette |
 * | Héros (322 vues par tour) | 8 s, texte en fondu | 12 s, l'image seule fond |
 *
 * Les flous (halos d'œuvre) ne coûtent rien (masque natif) : gardés.
 * L'Apple TV n'a pas de Lite : son niveau vaut toujours `normal`.
 */
export const LITE_PROFILE: Readonly<RenderProfile> = {
  ...RENDER_PROFILES.androidtv,
  motionStyle: "brief",
  cardFocus: "outline",
  ambient: "tint",
  // Une teinte qui changeait à chaque carte, à chaque chargement (squelette
  // neutre → œuvre) et à l'arrivée des affiches, en un fondu de 150 ms, se
  // lisait comme un clignotement du fond (retours d'essai, Shield,
  // 2026-10-07) : en Lite, le fond est FIXE — et rien ne se redessine
  // derrière les cartes.
  ambientFollow: "fixed",
  shadows: "border",
  glass: "flat",
  gradients: "twoStop",
  pageTransition: "cut",
  heroDelayFactor: 1.5,
  heroTextSwap: false,
};

/** Le profil d'une plateforme à un niveau de rendu : Lite n'existe que sur Android TV. */
export function renderProfileFor(platform: RenderPlatform, tier: RenderTier): Readonly<RenderProfile> {
  if (platform === "androidtv" && tier === "lite") return LITE_PROFILE;
  return RENDER_PROFILES[platform];
}
