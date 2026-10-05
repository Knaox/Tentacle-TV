import { PlatformBackScope } from "../../platform/backScope";

export { useBackLayer, useBackLayers } from "../../platform/shared/back/useBackLayers";

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
 * Les écrans, le lecteur et les panneaux importent `useBackLayer` /
 * `useBackLayers` d'ici.
 */
export const BackScope = PlatformBackScope;
