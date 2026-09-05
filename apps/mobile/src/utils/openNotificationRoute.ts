import type { Router } from "expo-router";

/** Les destinations qui vivent dans la barre d'onglets (chemin sans query). */
const TAB_PATHS = new Set(["/", "/(tabs)", "/for-you", "/libraries", "/extensions", "/profile"]);

/**
 * Ouvre la destination d'une notification d'où qu'on soit. Un onglet ne se
 * pousse pas : depuis une fiche empilée, `navigate` vers `(tabs)` empilerait
 * un second navigateur d'onglets (le Stack de React Navigation 7 ne redescend
 * plus vers une route existante). On vide d'abord la pile, puis on navigue —
 * les deux actions sont calculées tout de suite et jouées dans l'ordre. Une
 * fiche (support…) s'empile comme avant.
 */
export function openNotificationRoute(router: Router, route: string | null): void {
  const target = route ?? "/(tabs)";
  const path = target.split("?")[0];
  if (!TAB_PATHS.has(path)) {
    router.push(target as never);
    return;
  }
  if (router.canDismiss()) router.dismissAll();
  router.navigate(target as never);
}
