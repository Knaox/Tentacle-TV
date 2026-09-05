/** Whitelist par défaut : les caches de la page d'accueil — ses hubs, et la
 *  mise en page qui les ordonne (`home-layout`, `reco-settings` : quelques
 *  centaines d'octets, sans lesquels l'accueil se réordonne sous les yeux
 *  après le premier rendu). `favorites` couvre la rangée « Mes favoris ».
 *  NB : pas de `"library-items"` — les vraies clés des bibliothèques sont
 *  `["library", id, "items", …]`, donc ce préfixe ne matchait rien. Le
 *  « corriger » en `"library"` persisterait tout le catalogue parcouru,
 *  ce qui n'est pas le rôle de ce cache (les hubs de la home). */
export const HOME_PERSIST_WHITELIST = [
  "resume-items",
  "latest-items",
  "next-up",
  "watched-items",
  "featured",
  "watchlist",
  "favorites",
  "libraries",
  "home-layout",
  "reco-settings",
] as const;
