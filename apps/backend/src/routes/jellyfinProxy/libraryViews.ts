/**
 * Les bibliothèques que Tentacle sait montrer : des films, des séries, et les
 * deux mélangés. Rien d'autre.
 *
 * Jellyfin rend TOUTES les vues d'un compte dans `Users/{id}/Views` — musique,
 * livres, photos, vidéos personnelles, clips, collections, listes de lecture,
 * TV en direct, la vue « Dossiers », les chaînes des extensions. Chaque client
 * les affichait telles quelles : une entrée de navigation, une rangée
 * d'accueil, une page. Or le catalogue ne demande jamais que des `Movie`, des
 * `Series` et des `Episode` — la page d'une bibliothèque de musique s'ouvrait
 * vide, sous une icône de note.
 *
 * Le tri se fait ICI, dans le proxy que tous les clients traversent (web,
 * bureau, mobile, TV, webOS) : une seule règle, et aucun client à mettre à
 * jour pour qu'elle s'applique.
 *
 * Ce qui passe :
 * - `movies` et `tvshows`. Une bibliothèque d'animés est une bibliothèque de
 *   séries : elle passe à ce titre, rien ne la distingue ici ;
 * - la bibliothèque SANS type : c'est ainsi que Jellyfin range « Films et
 *   séries mélangés » (son interface envoie `null` pour ce choix, et
 *   `UserViewManager` la regroupe avec les films et les séries). Seulement
 *   pour un vrai dossier de bibliothèque (`CollectionFolder`) : les chaînes
 *   des extensions arrivent elles aussi sans type.
 *
 * Les vues regroupées (option « Regrouper » de Jellyfin) portent `movies` ou
 * `tvshows` sur un `UserView` : elles passent par leur type.
 */

const SUPPORTED_COLLECTION_TYPES: ReadonlySet<string> = new Set(["movies", "tvshows"]);

/** La seule route de la liste blanche qui liste les bibliothèques d'un compte. */
const LIBRARY_VIEWS_PATH = /^Users\/[^/]+\/Views$/i;

export function isLibraryViewsPath(path: string): boolean {
  return LIBRARY_VIEWS_PATH.test(path);
}

/** Ce qu'on lit d'une vue Jellyfin (`BaseItemDto`) — rien n'est garanti. */
interface RawLibraryView {
  Type?: unknown;
  CollectionType?: unknown;
}

export function isSupportedLibrary(view: RawLibraryView): boolean {
  const type = typeof view.CollectionType === "string" ? view.CollectionType.toLowerCase() : "";
  if (SUPPORTED_COLLECTION_TYPES.has(type)) return true;
  return (type === "" || type === "mixed") && view.Type === "CollectionFolder";
}

/**
 * La réponse de `Users/{id}/Views`, réduite aux bibliothèques prises en
 * charge — `TotalRecordCount` suit. Une réponse illisible repart telle quelle :
 * le client n'en tirerait rien non plus. Rien d'écarté : le même tampon, sans
 * copie.
 */
export function keepSupportedLibraries(body: Buffer): Buffer {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString("utf8"));
  } catch {
    return body;
  }
  if (parsed === null || typeof parsed !== "object") return body;
  const views = (parsed as { Items?: unknown }).Items;
  if (!Array.isArray(views)) return body;

  const kept = views.filter(
    (view): view is RawLibraryView => view !== null && typeof view === "object" && isSupportedLibrary(view),
  );
  if (kept.length === views.length) return body;
  return Buffer.from(JSON.stringify({ ...parsed, Items: kept, TotalRecordCount: kept.length }), "utf8");
}
