/**
 * Les routes « par utilisateur » que les clients Tentacle emploient, traduites
 * vers leur forme DOCUMENTÉE avant de partir chez Jellyfin.
 *
 * `/Users/{userId}/Items/…`, `/Users/{userId}/Views`, `…/FavoriteItems/…` :
 * Jellyfin les a remplacées en 10.9 par `/Items/…?userId=`, `/UserViews`,
 * `/UserFavoriteItems/…`, et ne les sert plus que par des alias cachés du
 * document OpenAPI. Or la 12.0 l'écrit noir sur blanc : une route absente du
 * document peut disparaître à la version majeure suivante, SANS préavis.
 *
 * Traduire ICI plutôt que dans les clients : les applications déjà installées
 * gardent leurs chemins et continueront de marcher le jour où l'alias tombera,
 * et une application à jour reste compatible avec un serveur Tentacle ancien,
 * dont la liste blanche ignore les formes modernes. Tout ce qui, dans le proxy,
 * raisonne sur le chemin (liste blanche, périmètre d'un appareil, cache, tri
 * des bibliothèques, effets de bord) garde le chemin du CLIENT : seule la
 * requête faite à Jellyfin change.
 *
 * Toutes les formes cibles existent depuis 10.9 — vérifié dans les documents
 * OpenAPI de 10.10.7, 10.11.8 et 12.1.0, et leur équivalence éprouvée par la
 * suite de compatibilité (`test/jellyfin-compat`).
 *
 * Ce fichier n'importe rien et se teste seul.
 */

interface Rule {
  from: RegExp;
  /** Le chemin cible ; `$1` est l'utilisateur, `$2` le titre. */
  to: string;
}

// L'ordre compte : `Items/Resume` avant `Items/{itemId}`.
const RULES: Rule[] = [
  { from: /^Users\/([^/]+)\/Items$/i, to: "Items" },
  { from: /^Users\/([^/]+)\/Items\/Resume$/i, to: "UserItems/Resume" },
  { from: /^Users\/([^/]+)\/Items\/Latest$/i, to: "Items/Latest" },
  { from: /^Users\/([^/]+)\/Items\/Root$/i, to: "Items/Root" },
  { from: /^Users\/([^/]+)\/Items\/([^/]+)\/Rating$/i, to: "UserItems/$2/Rating" },
  { from: /^Users\/([^/]+)\/Items\/([^/]+)\/UserData$/i, to: "UserItems/$2/UserData" },
  { from: /^Users\/([^/]+)\/Items\/([^/]+)\/(LocalTrailers|SpecialFeatures|Intros)$/i, to: "Items/$2/$3" },
  { from: /^Users\/([^/]+)\/Items\/([^/]+)$/i, to: "Items/$2" },
  { from: /^Users\/([^/]+)\/Views$/i, to: "UserViews" },
  { from: /^Users\/([^/]+)\/FavoriteItems\/([^/]+)$/i, to: "UserFavoriteItems/$2" },
  { from: /^Users\/([^/]+)\/PlayedItems\/([^/]+)$/i, to: "UserPlayedItems/$2" },
  { from: /^Users\/([^/]+)\/Images\/Primary$/i, to: "UserImage" },
];

export interface TranslatedRoute {
  /** Le chemin moderne, sans barre initiale. */
  path: string;
  /** La query d'origine, `userId` posé d'après le chemin (`?…` ou vide). */
  query: string;
}

/**
 * La forme documentée d'une route héritée, ou `null` si le chemin n'en est pas
 * une (il part alors tel quel). `query` est la chaîne d'origine, `?` compris.
 *
 * L'utilisateur du CHEMIN fait foi : c'est lui que le garde de périmètre a
 * vérifié. Un `userId` déjà présent en query, quelle qu'en soit la casse, est
 * remplacé plutôt que doublé.
 */
export function translateLegacyRoute(path: string, query: string): TranslatedRoute | null {
  for (const rule of RULES) {
    const match = rule.from.exec(path);
    if (!match) continue;
    const userId = match[1];
    if (userId.toLowerCase() === "me") return null;
    const target = rule.to.replace(/\$(\d)/g, (_all, n: string) => match[Number(n)] ?? "");
    const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
    for (const key of [...params.keys()]) if (key.toLowerCase() === "userid") params.delete(key);
    params.set("userId", userId);
    return { path: target, query: `?${params.toString()}` };
  }
  return null;
}
