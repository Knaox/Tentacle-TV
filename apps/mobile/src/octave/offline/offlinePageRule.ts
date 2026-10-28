/**
 * Octave (mobile) — ce qu'une page du serveur MONTRE, règle PURE
 * (`offlinePageRule.test.ts`) : jamais une page vide, jamais une erreur pour une
 * donnée qu'on a déjà, jamais une attente sans fin hors ligne.
 *
 * - Une donnée est là (en cache, gardée au dernier passage en ligne) : elle se
 *   montre, même si sa relecture a échoué — c'est son DERNIER affichage en ligne.
 * - Hors ligne sans donnée : la collection gardée sur cet appareil si elle
 *   existe (`kept`), sinon « Pas disponible hors ligne » avec le chemin vers ce
 *   qui l'est. Jamais un « Réessayer » qui ne peut qu'échouer.
 * - En ligne : l'attente, puis l'erreur avec « Réessayer ».
 */

export type PageView = "content" | "loading" | "error" | "kept" | "offlineMissing";

export interface PageViewInput {
  hasData: boolean;
  isPending: boolean;
  isError: boolean;
  offline: boolean;
  /** La collection de cette page est gardée sur l'appareil (playlist, album). */
  keptCollection: boolean;
}

export function pageView(input: PageViewInput): PageView {
  if (input.hasData) return "content";
  if (input.offline) return input.keptCollection ? "kept" : "offlineMissing";
  if (input.isError || !input.isPending) return "error";
  return "loading";
}
