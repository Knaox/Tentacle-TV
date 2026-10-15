/**
 * Le pont rendu aux extensions — `PluginBackendContext.contentPolicy`, venu en
 * 1.30.0 (docs/DROITS-UTILISATEURS.md § 5) : une extension le teste avant de
 * l'appeler, et une exception vaut refus.
 *
 * # La règle : celle des recommandations
 *
 * Un titre TMDB qu'une extension montre (Vigie : découverte, recherche, saga,
 * demandes) se juge comme un titre extérieur de « Pour vous »
 * (`reco/recoRights.ts`) :
 *  - dans la bibliothèque mais CACHÉ au compte (note, étiquette, non classé,
 *    bibliothèque refusée) : jamais — c'est le même film, que Jellyfin lui
 *    interdit (mesuré au banc du contrôle parental : Coraline classé « 10 »
 *    dans la bibliothèque revenait à un compte « 6 ans » comme titre à demander,
 *    la bibliothèque refusée aussi) ;
 *  - dans la bibliothèque et VU par le compte : oui, Jellyfin a jugé ;
 *  - hors bibliothèque : la classification TMDB (`filterExternalTitles`).
 *
 * `isRestricted` dit si le filtre PEUT retirer quelque chose : une politique
 * restreinte, OU des bibliothèques bornées — un compte privé d'une bibliothèque
 * ne doit pas s'en voir proposer les titres par une extension. Un compte libre
 * garde le chemin court : aucune question de plus.
 *
 * Ce module vit hors de `index.ts` : il dépend de la recherche et des
 * recommandations, qui dépendent elles-mêmes de la politique de contenu.
 */

import { filterByRights, titleAllowedFor } from "../reco/recoRights";
import { getContentPolicy, limitsLibraries } from "./contentPolicy";
import type { ExternalTitleRef } from "./externalTitles";

export interface ContentPolicyBridge {
  isRestricted(userId: string): Promise<boolean>;
  filterExternalTitles(userId: string, titles: ExternalTitleRef[]): Promise<ExternalTitleRef[]>;
  allowsExternalTitle(userId: string, title: ExternalTitleRef): Promise<boolean>;
}

/** Le filtre peut-il retirer quelque chose à ce compte ? Illisible : oui. */
async function mayFilter(userId: string): Promise<boolean> {
  const policy = await getContentPolicy(userId);
  return policy.restricted || limitsLibraries(policy);
}

/** Des copies `{ mediaType, tmdbId }` vérifiées : une entrée mal formée est écartée, jamais laissée passer. */
function clean(titles: unknown): ExternalTitleRef[] {
  return (Array.isArray(titles) ? titles : []).flatMap((title) => {
    const { mediaType, tmdbId } = (title ?? {}) as Partial<ExternalTitleRef>;
    if ((mediaType !== "movie" && mediaType !== "tv") || !Number.isInteger(tmdbId) || (tmdbId as number) <= 0) return [];
    return [{ mediaType, tmdbId: tmdbId as number }];
  });
}

export function contentPolicyBridge(): ContentPolicyBridge {
  return {
    isRestricted: (userId) => mayFilter(String(userId)),
    filterExternalTitles: async (userId, titles) => {
      const refs = clean(titles);
      if (!(await mayFilter(String(userId)))) return refs;
      return (await filterByRights(String(userId), refs)).map(({ mediaType, tmdbId }) => ({ mediaType, tmdbId }));
    },
    allowsExternalTitle: async (userId, title) => {
      const [only] = clean([title]);
      if (!only) return false;
      return !(await mayFilter(String(userId))) || titleAllowedFor(String(userId), only);
    },
  };
}
