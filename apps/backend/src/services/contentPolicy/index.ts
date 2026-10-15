/**
 * Le filtrage du contenu par compte (docs/DROITS-UTILISATEURS.md § 5) : la
 * politique de contenu lue dans Jellyfin, et les titres extérieurs qu'elle laisse
 * passer. Le pont des extensions (`PluginBackendContext.contentPolicy`) en est
 * une vue réduite : `contentPolicyBridge`.
 */

import { isRestricted } from "./contentPolicy";
import { allowsExternalTitle, filterExternalTitles, type ExternalTitleRef } from "./externalTitles";

export {
  clearContentPolicyCache,
  closedContentPolicy,
  contentPolicyFromJellyfin,
  getContentPolicy,
  invalidateContentPolicy,
  isPolicyRestricted,
  isRestricted,
  type ContentPolicy,
} from "./contentPolicy";
export {
  EXTERNAL_FETCH_BUDGET,
  allowsExternalTitle,
  filterExternalTitles,
  type ExternalMediaType,
  type ExternalTitleRef,
} from "./externalTitles";

/** Le pont rendu aux extensions — venu en 1.30.0, une extension le teste avant de l'appeler. */
export interface ContentPolicyBridge {
  isRestricted(userId: string): Promise<boolean>;
  filterExternalTitles(userId: string, titles: ExternalTitleRef[]): Promise<ExternalTitleRef[]>;
  allowsExternalTitle(userId: string, title: ExternalTitleRef): Promise<boolean>;
}

/**
 * La vue des extensions : des copies `{ mediaType, tmdbId }` (jamais un objet de
 * l'extension retouché), et des entrées vérifiées — une entrée mal formée est
 * écartée, jamais laissée passer.
 */
export function contentPolicyBridge(): ContentPolicyBridge {
  const clean = (titles: unknown): ExternalTitleRef[] =>
    (Array.isArray(titles) ? titles : []).flatMap((title) => {
      const { mediaType, tmdbId } = (title ?? {}) as Partial<ExternalTitleRef>;
      if ((mediaType !== "movie" && mediaType !== "tv") || !Number.isInteger(tmdbId) || (tmdbId as number) <= 0) return [];
      return [{ mediaType, tmdbId: tmdbId as number }];
    });
  return {
    isRestricted: (userId) => isRestricted(String(userId)),
    filterExternalTitles: (userId, titles) => filterExternalTitles(String(userId), clean(titles)),
    allowsExternalTitle: async (userId, title) => {
      const [only] = clean([title]);
      return only ? allowsExternalTitle(String(userId), only) : false;
    },
  };
}
