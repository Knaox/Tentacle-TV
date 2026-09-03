/** Whitelist par défaut : les caches de la page d'accueil.
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
  "libraries",
] as const;
