/**
 * La colle KWin vivante du processus — UNE, posée à la première lecture et
 * gardée jusqu'au départ.
 *
 * La colle (`kwinGlue.ts`) n'a rien à savoir du fichier en cours : elle adopte
 * toute fenêtre `mpv` de notre pid et la lâche quand elle se ferme. Une pose
 * sert donc à tous les épisodes d'un lancement, et la décrocher à chaque
 * lecture — ce qu'on faisait jusqu'au 17.09.2026 — coûtait quatre appels
 * D-Bus par épisode et laissait des gestionnaires morts dans le compositeur.
 *
 * Le retrait au DÉPART reste celui de `glueCleanup.ts` (`removeGlueAtStartup`,
 * synchrone) ; ici on ne décroche que pour reposer, quand la contre-lecture
 * (`waylandGlueSurface.ts`) a mesuré une fenêtre qui ne suit pas.
 */

import { KwinGlue } from "./kwinGlue";
/** La colle vivante du processus, et la pose en cours s'il y en a une. */
let live: KwinGlue | null = null;
let posing: Promise<{ live: boolean; fresh: boolean }> | null = null;

export function liveGlue(): KwinGlue | null {
  return live;
}

/**
 * Pose la colle s'il n'en vit aucune. `live` dit s'il en vit une à la sortie,
 * `fresh` si c'est cet appel qui l'a posée. Deux appels croisés partagent la
 * même pose : KWin refuserait un second greffon du même nom.
 */
export function ensureLiveGlue(): Promise<{ live: boolean; fresh: boolean }> {
  if (live !== null) return Promise.resolve({ live: true, fresh: false });
  posing ??= (async () => {
    const glue = new KwinGlue();
    const posed = await glue.apply();
    if (posed) live = glue;
    posing = null;
    return { live: posed, fresh: posed };
  })();
  return posing;
}

/**
 * Décroche la colle vivante et en pose une neuve — le seul cas où l'on repose :
 * la contre-lecture a mesuré une fenêtre mpv qui ne suit pas.
 */
export async function reposeLiveGlue(): Promise<boolean> {
  const previous = live;
  live = null;
  if (previous !== null) await previous.remove();
  const fresh = new KwinGlue();
  if (!(await fresh.apply())) return false;
  live = fresh;
  return true;
}

/**
 * Oublie la colle vivante SANS la décrocher : le départ synchrone s'en charge
 * (`glueCleanup.ts`, `removeGlueAtStartup`), et les tests repartent à zéro.
 */
export function forgetLiveGlue(): void {
  live = null;
  posing = null;
}
