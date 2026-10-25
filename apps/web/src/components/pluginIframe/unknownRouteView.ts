/**
 * Une adresse qu'aucune route ne connaît peut être celle d'une page
 * d'EXTENSION (`/admin/plugins/sillon`, `/music/requests`) : ses routes ne
 * sont montées qu'une fois `/api/plugins/active` lu, et seulement en session.
 * Avant, un lien direct sans session, ou ouvert avant cette réponse, tombait
 * sur « Page introuvable » (404) — vécu sur l'administration de Sillon, 24/10.
 *
 * Sans session : la connexion, comme toute page protégée. En session, tant que
 * la liste des extensions n'a pas répondu : attendre. Ensuite seulement, 404.
 */
export type UnknownRouteView = "login" | "wait" | "notFound";

export function unknownRouteView(state: { authed: boolean; pluginsLoading: boolean }): UnknownRouteView {
  if (!state.authed) return "login";
  return state.pluginsLoading ? "wait" : "notFound";
}
