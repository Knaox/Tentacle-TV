import { TvosBackScope, type BackScopeProps } from "../../platform/tvos/back/BackScope";
import { REDESIGN_ACTIVE } from "../redesignGate";

export { useBackLayer, useBackLayers } from "../../platform/tvos/back/useBackLayers";

/**
 * Le RETOUR d'un écran : la portée que le navigateur pose autour de chaque
 * écran (`screenLayout`, `navigation/AppNavigator.tsx`).
 *
 * Apple TV : l'applicateur tvOS (`platform/tvos/back/`), sur la pile et les
 * règles de tv-core (`nav/backLayers`, `nav/backResolve`) — ce qu'il fait,
 * contexte par contexte : `docs/tv-navigation/retour-rail.md`.
 *
 * Android TV : la portée ne fait rien — le Retour y arrive au JS par
 * BackHandler, écran par écran — et `useBackLayer` n'inscrit rien.
 *
 * Ce module ne garde que l'aiguillage : les écrans, le lecteur et les
 * panneaux importent `useBackLayer` / `useBackLayers` d'ici ou de
 * `platform/tvos/back/useBackLayers`.
 */

function PassThrough({ children }: BackScopeProps) {
  return <>{children}</>;
}

export const BackScope = REDESIGN_ACTIVE ? TvosBackScope : PassThrough;
