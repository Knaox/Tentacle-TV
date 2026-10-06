import { resolveRenderTier, type RenderTier, type RenderTierMode, type RenderTierState } from "@tentacle-tv/tv-core";

/**
 * Le POINT D'ENTRÉE NEUTRE du niveau de rendu (`normal` / `lite`, tv-core
 * `device/renderTier`) — Android TV seulement (`index.android.ts` →
 * `platform/androidtv/renderTier`). Ce fichier est celui de l'Apple TV : le
 * niveau y vaut TOUJOURS `normal`, aucun module natif n'est lu, le réglage
 * n'existe pas (trait `renderTierSetting`). Un nom nouveau s'ajoute aux deux.
 *
 * Le niveau est FIXE pour la vie du JS : il se décide avant la première image
 * et ne change que par un rechargement de l'interface — d'où une constante,
 * et des crochets qui la rendent (aucun abonnement, aucun rendu de plus).
 */

export const RENDER_TIER_STATE: Readonly<RenderTierState> = resolveRenderTier({ platform: "tvos", signals: {} });

export const RENDER_TIER: RenderTier = RENDER_TIER_STATE.tier;

/** Le niveau de rendu en vigueur. */
export function useRenderTier(): RenderTier {
  return RENDER_TIER;
}

/** Le niveau, sa raison, le réglage et ce que dirait « Automatique ». */
export function useRenderTierState(): Readonly<RenderTierState> {
  return RENDER_TIER_STATE;
}

/** Change le réglage et recharge l'interface (Android TV) ; rien ici. */
export function changeRenderTierMode(_mode: RenderTierMode, _screenParams?: Record<string, unknown>): void {}

/** Rouvre l'écran quitté par un rechargement (Android TV) ; rien ici. */
export function RenderTierReturn(): null {
  return null;
}
