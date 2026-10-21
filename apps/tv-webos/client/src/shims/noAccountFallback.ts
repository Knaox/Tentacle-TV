/**
 * Le retour au compte de l'appareil quand la connexion tombe pendant un
 * PROFIL (`apps/web/src/offline/accountFallback.ts`) : la LG n'a ni mode hors
 * ligne ni profils de la Famille — rien ne bascule, aucun message à dire. Le
 * vrai module ferait entrer `profiles/launch/` dans le graphe, un dossier que
 * la feuille du téléviseur ne balaie pas.
 */

// ⚠️ Clé traversée par une chaîne : la même que le module du web.
export const ACCOUNT_FALLBACK_NOTICE_KEY = "tentacle_offline_account_fallback";

export function fallBackToAccount(): boolean {
  return false;
}

export function readAccountFallbackNotice(): string | null {
  return null;
}

export function clearAccountFallbackNotice(): void {}
