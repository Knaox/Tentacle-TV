import type { Router } from "expo-router";

/**
 * Retour sûr. Tous les écrans hors tabs sont deep-linkables : ouverts en
 * racine de pile (lien, notification, cold start), ils n'ont rien à dépiler
 * et `router.back()` lève « GO_BACK not handled ». Repli : l'accueil.
 */
export function backOrHome(router: Router): void {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)");
}

/**
 * Retour à l'accueil depuis une pile de fiches : on dépile tout ce qui est
 * au-dessus des onglets (l'accueil reste monté, avec son défilement), sinon
 * on le remplace.
 */
export function goHome(router: Router): void {
  if (router.canDismiss()) router.dismissAll();
  else router.replace("/(tabs)");
}
