/**
 * Le retour après connexion (`?redirect=`), lu par la connexion et transmis
 * par l'inscription : un visiteur venu d'un partage s'inscrit, se connecte,
 * et retombe sur le partage au lieu de l'accueil.
 *
 * Chemin INTERNE seulement — ni URL absolue ni `//hôte` (redirection ouverte).
 */
export function safeRedirect(param: string | null): string | null {
  return param && param.startsWith("/") && !param.startsWith("//") ? param : null;
}

/** `/login`, avec le retour demandé s'il y en a un. */
export function loginPathKeepingRedirect(params: URLSearchParams): string {
  const redirect = safeRedirect(params.get("redirect"));
  return redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login";
}
