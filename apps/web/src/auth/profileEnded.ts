import { readActiveProfile } from "./profileSession";
import { forgetProfileSession, returnToAccount } from "./sessionSwap";

/**
 * La FIN d'une session de profil du bureau, vue du client : le serveur l'a
 * coupée (profil retiré, invité supprimé, PIN changé, familles coupées…) — par
 * `family:profile-ended` sur la socket, ou un 401 `profileEnded` à une porte.
 * Comme la TV, on revient à « Qui regarde ? » : la session personnelle est
 * reprise EN COULISSE, la page se recharge, et le sélecteur l'exige avant
 * toute chose — jamais le compte sans son code PIN, jamais une déconnexion.
 *
 * Pendant une bascule voulue (`beginProfileSwitch`), la fin de l'ancienne
 * session est attendue (le serveur la ferme, « replaced ») : on l'ignore.
 *
 * Hors d'une session de profil, rien n'est fait ici (`false`) : l'appelant
 * garde son comportement d'avant.
 *
 * ⚠️ Clés traversées par une chaîne : jamais renommées.
 */

/** « Qui regarde ? » exigé au prochain rendu (stockage de session : survit au rechargement). */
export const PICKER_REQUEST_KEY = "tentacle_profile_picker_request";
const QUERY_CACHE_KEY = "tentacle_query_cache_v1";

let switching = false;

/** Une bascule de profil commence : les fins de session qui suivent sont les nôtres. */
export function beginProfileSwitch(): void {
  switching = true;
}

/** La bascule n'a pas eu lieu (code refusé, profil indisponible) : les fins de session redeviennent des fins. */
export function cancelProfileSwitch(): void {
  switching = false;
}

export function isProfileSwitching(): boolean {
  return switching;
}

/** Le sélecteur exigé (la raison de la fin), ou null. */
export function readPickerRequest(): string | null {
  try {
    return sessionStorage.getItem(PICKER_REQUEST_KEY);
  } catch {
    return null;
  }
}

export function clearPickerRequest(): void {
  try {
    sessionStorage.removeItem(PICKER_REQUEST_KEY);
  } catch {
    /* stockage de session indisponible */
  }
}

/**
 * La session de profil a pris fin : retour au compte, puis « Qui regarde ? ».
 * Vrai si c'était bien une session de profil (l'appelant n'a plus rien à faire).
 */
export function endProfileSession(reason: string): boolean {
  if (switching) return true;
  if (!readActiveProfile()) return false;
  switching = true;
  try {
    if (returnToAccount(localStorage)) {
      sessionStorage.setItem(PICKER_REQUEST_KEY, reason || "ended");
    } else {
      // Aucune session personnelle à reprendre (réserve perdue) : rien ne doit
      // rester du profil, sinon le rechargement repartirait du jeton mort. On
      // retombe sur l'écran de connexion.
      forgetProfileSession(localStorage);
      localStorage.removeItem("tentacle_token");
      localStorage.removeItem("tentacle_user");
    }
    // Le cache persisté est celui du profil : il ne s'hydrate jamais ailleurs
    // (étiquette de propriétaire), on ne le laisse pas traîner.
    localStorage.removeItem(QUERY_CACHE_KEY);
  } catch {
    /* stockage indisponible : le rechargement retombe sur ce qui reste */
  }
  window.location.assign("/");
  return true;
}
