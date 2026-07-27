/**
 * Résolution du chemin demandé par un greffon à travers le pont `API_REQUEST`.
 *
 * # Pourquoi ce fichier existe
 *
 * L'hôte exécute la requête du greffon AVEC LES IDENTIFIANTS DE L'UTILISATEUR :
 * `Authorization: Bearer <jeton Tentacle>` et `credentials: "include"`. Le
 * chemin, lui, vient du greffon. Il était concaténé tel quel :
 *
 *     fetch(`${backendUrl}${path}`, { headers: enTetesAuth, credentials: … })
 *
 * Une concaténation n'est pas une résolution d'URL. Quatre formes de `path`
 * détournaient la requête vers un hôte tiers — et donc le jeton avec elle :
 *
 *   base ""                        + "https://pirate/x"  → hôte pirate
 *   base "https://tentacle.exemple" + "@pirate/x"        → hôte pirate
 *                                                          (« tentacle.exemple »
 *                                                          devient un userinfo)
 *   base "https://tentacle.exemple" + ".pirate/x"        → hôte tentacle.exemple.pirate
 *   base ""                        + "//pirate/x"        → hôte pirate
 *
 * Les deux premières sont vérifiées : `new URL()` les accepte sans broncher.
 *
 * Un greffon n'est pas du code arbitraire — il vient d'un registre —, mais c'est
 * précisément la promesse que porte son origine séparée : `csp.ts` note qu'« il
 * n'a de toute façon aucun jeton ». Cette porte la démentait.
 *
 * # Deux barrières, et pourquoi les deux
 *
 * Le chemin doit commencer par `/` — ce qui écarte `@pirate`, `.pirate` et
 * `https://pirate` —, PUIS l'origine résolue doit être celle du backend, ce qui
 * rattrape `//pirate` et tout ce que je n'ai pas prévu. La seconde barrière
 * suffirait ; la première dit à la lecture ce qui est attendu.
 */

/**
 * URL absolue à appeler, ou `null` si le chemin sort du backend.
 *
 * @param base Base du backend. Chaîne VIDE sur le web déployé en même origine —
 *   c'est le cas le plus permissif, et celui qu'il ne faut pas oublier.
 * @param origineCourante `window.location.origin`, passée pour que la fonction
 *   se teste sans navigateur.
 */
export function resolveBridgeUrl(
  base: string,
  path: unknown,
  origineCourante: string,
): string | null {
  if (typeof path !== "string" || !path.startsWith("/")) return null;

  try {
    const cible = new URL(`${base}${path}`, origineCourante);
    const attendue = new URL(base === "" ? origineCourante : base, origineCourante);
    if (cible.origin !== attendue.origin) return null;
    return cible.toString();
  } catch {
    // Base ou chemin inexploitable : on ne devine pas.
    return null;
  }
}
