import type { BackScopeProps } from "../../platform/common/back/backScopeProps";
import { PlatformBackScope } from "../../platform/backScope";
import { REDESIGN_ACTIVE } from "../redesignGate";

export { useBackLayer, useBackLayers } from "../../platform/common/back/useBackLayers";

/**
 * Le RETOUR d'un écran : la portée que le navigateur pose autour de chaque
 * écran (`screenLayout`, `navigation/AppNavigator.tsx`).
 *
 * La pile et ses règles sont dans tv-core (`nav/backLayers`, `nav/backResolve`)
 * — ce qu'elle fait, contexte par contexte : `docs/tv-navigation/retour-rail.md`.
 * L'applicateur est celui de la plateforme (`platform/backScope`) :
 * - Apple TV : `platform/tvos/back/` — `MenuPressInterceptor`, décidé d'avance ;
 * - Android TV : `platform/androidtv/back/` — `BackHandler`, décidé au geste.
 *
 * L'ancienne UI (refonte inactive) : la portée ne fait rien, et `useBackLayer`
 * n'inscrit rien.
 *
 * Ce module ne garde que l'aiguillage : les écrans, le lecteur et les
 * panneaux importent `useBackLayer` / `useBackLayers` d'ici.
 */

function PassThrough({ children }: BackScopeProps) {
  return <>{children}</>;
}

export const BackScope = REDESIGN_ACTIVE ? PlatformBackScope : PassThrough;
