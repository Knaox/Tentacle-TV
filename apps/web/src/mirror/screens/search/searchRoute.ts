/**
 * L'adresse de la recherche du miroir — le pendant des paramètres de route de
 * `SearchScreen` de l'app (`?q=`, `?person=&name=&tag=`), plus le genre et le
 * studio parcourus, que l'app garde en mémoire mais que le web met dans
 * l'adresse : le bouton Retour du navigateur (le « retour matériel » d'Android)
 * sort alors d'un parcours sans quitter la recherche.
 *
 *   /search?q=dune                         → résultats
 *   /search?q=dune&person=<id>&name=…&tag= → une filmographie
 *   /search?q=dune&genre=Comédie           → un genre
 *   /search?studio=Pixar                   → un studio
 *
 * `q` et `person`/`name`/`genre`/`studio` sont les MÊMES clés que la page du
 * bureau (`components/search/page/searchParams.ts`) : un lien se partage entre
 * les deux gabarits.
 */

import type { SearchPersonHit } from "@tentacle-tv/shared";

/** Ce que l'on parcourt : une personne (sa filmographie), un genre, un studio. */
export type BrowseTarget =
  | { kind: "person"; id: string; person: SearchPersonHit }
  | { kind: "genre"; name: string }
  | { kind: "studio"; name: string };

export interface MirrorSearchRoute {
  query: string;
  browse: BrowseTarget | null;
}

/** Un paramètre vide vaut absent. */
function param(params: URLSearchParams, key: string): string | null {
  const value = params.get(key);
  return value === null || value === "" ? null : value;
}

export function readSearchRoute(params: URLSearchParams): MirrorSearchRoute {
  const query = params.get("q") ?? "";
  const person = param(params, "person");
  if (person !== null) {
    const name = param(params, "name") ?? "";
    const imageTag = param(params, "tag");
    return {
      query,
      browse: { kind: "person", id: person, person: { id: person, name, imageTag, roles: [], count: 0, score: 0 } },
    };
  }
  const genre = param(params, "genre");
  if (genre !== null) return { query, browse: { kind: "genre", name: genre } };
  const studio = param(params, "studio");
  if (studio !== null) return { query, browse: { kind: "studio", name: studio } };
  return { query, browse: null };
}

/** L'adresse d'une recherche, et du parcours ouvert par-dessus s'il y en a un. */
export function searchRouteHref(query: string, browse: BrowseTarget | null = null): string {
  const params = new URLSearchParams();
  const q = query.trim();
  if (q !== "") params.set("q", q);
  if (browse?.kind === "person") {
    params.set("person", browse.id);
    if (browse.person.name !== "") params.set("name", browse.person.name);
    if (browse.person.imageTag) params.set("tag", browse.person.imageTag);
  } else if (browse !== null) {
    params.set(browse.kind, browse.name);
  }
  const search = params.toString();
  return search === "" ? "/search" : `/search?${search}`;
}

/**
 * Combien d'entrées d'historique la recherche a empilées elle-même (les
 * parcours), lu dans l'état de l'entrée courante. « Annuler » les dépile toutes
 * d'un coup : c'est la modale entière qui se referme, comme dans l'app.
 */
export function searchDepth(state: unknown): number {
  if (typeof state !== "object" || state === null) return 0;
  const depth = (state as { searchDepth?: unknown }).searchDepth;
  return typeof depth === "number" && Number.isInteger(depth) && depth > 0 ? depth : 0;
}
