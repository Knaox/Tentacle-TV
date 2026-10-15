/**
 * Le filtrage du contenu par compte (docs/DROITS-UTILISATEURS.md § 5) : la
 * politique de contenu lue dans Jellyfin, et les titres extérieurs qu'elle laisse
 * passer. Le pont des extensions (`PluginBackendContext.contentPolicy`) est à
 * part : `extensionBridge.ts` (il applique aussi la règle de la bibliothèque).
 */

export {
  clearContentPolicyCache,
  closedContentPolicy,
  contentPolicyFromJellyfin,
  getContentPolicy,
  invalidateContentPolicy,
  isPolicyRestricted,
  isRestricted,
  limitsLibraries,
  onContentPolicyInvalidated,
  type ContentPolicy,
} from "./contentPolicy";
export { scheduleAllows } from "./externalTitleRule";
export {
  EXTERNAL_FETCH_BUDGET,
  allowsExternalTitle,
  filterExternalTitles,
  type ExternalMediaType,
  type ExternalTitleRef,
} from "./externalTitles";
