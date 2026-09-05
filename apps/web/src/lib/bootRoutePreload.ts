import { Recommendations } from "../lazyPages";

/** Au-delà, on rend avec le spinner habituel : jamais plus d'attente qu'un
 *  chargement de chunk en cache HTTP (quelques ms) mérite. */
const BUDGET_MS = 300;

/**
 * La route de DÉMARRAGE (F5 sur /recommendations, lien ouvert directement) :
 * attendre brièvement son chunk avant le premier rendu, pour que la page se
 * rende d'un coup depuis le cache hydraté, sans passer par le spinner.
 */
export function bootRoutePreload(pathname: string, budgetMs = BUDGET_MS): Promise<void> {
  if (!pathname.startsWith("/recommendations")) return Promise.resolve();
  return Promise.race([
    Recommendations.preload().catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, budgetMs)),
  ]);
}
