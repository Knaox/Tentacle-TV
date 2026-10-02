/**
 * La requête des « Derniers ajouts » d'une bibliothèque, reconnue dans le
 * proxy — et les deux requêtes qui la remplacent chez Jellyfin.
 *
 * Tous les clients (web, bureau, mobile, téléviseurs, webOS) demandent la
 * rangée de la MÊME façon, depuis l'été 2026 au moins (api-client,
 * `latestItemsQueryOptions`) :
 *
 *   Users/{id}/Items?ParentId=…&Recursive=true[&IncludeItemTypes=Episode]
 *     &SortBy=DateCreated&SortOrder=Descending&Limit=…
 *     &Fields=…&EnableImageTypes=…&ImageTypeLimit=1&EnableUserData=true
 *
 * — des ÉPISODES pour une bibliothèque de séries (une fenêtre de 100, 40 en
 * mode économie, que le client regroupait lui-même par séries CONSÉCUTIVES),
 * tout ce qui arrive pour une bibliothèque mixte (`Limit` : la rangée — 20,
 * 16 pour les clients d'avant le regroupement au serveur).
 * Les films (`IncludeItemTypes=Movie`) ne sont pas concernés : rien à
 * regrouper, la requête part telle quelle.
 *
 * La reconnaissance est STRICTE : le moindre paramètre de plus (une page, un
 * filtre, une recherche, des identifiants) et ce n'est plus la rangée — la
 * requête part telle quelle. Le catalogue d'une bibliothèque, trié lui aussi
 * par date d'ajout, porte toujours `StartIndex` et ses propres types.
 *
 * Ce fichier n'importe rien et se teste seul.
 */

/** « Les 20 dernières cartes » : la rangée rendue n'en compte jamais plus. */
export const LATEST_CARD_CAP = 20;

/**
 * L'inventaire des ajouts se lit par PAGES — champs minimaux, sans images ni
 * données du compte. La rangée se compte en CARTES, pas en épisodes : vingt
 * séries de vingt épisodes font vingt cartes, pas une. Une page suffit
 * presque toujours ; la suivante n'est lue que s'il manque encore des cartes
 * (une avalanche d'épisodes d'une ou deux séries), et jamais plus de quatre :
 * une série de milliers d'épisodes arrivée d'un bloc ne fait pas lire la
 * bibliothèque entière.
 */
export const LATEST_SCAN_PAGE = 500;
export const LATEST_SCAN_PAGES = 4;

/** Les paramètres de PRÉSENTATION du client, rejoués tels quels sur les cartes. */
const PRESENTATION_PARAMS = ["fields", "enableimagetypes", "imagetypelimit", "enableimages", "enableuserdata"];

/** Le jeton en query : retiré de l'URL relayée par le proxy, sans effet ici. */
const AUTH_PARAMS = ["api_key", "apikey"];

const CONTROL_PARAMS = ["parentid", "recursive", "sortby", "sortorder", "limit", "includeitemtypes"];

const ALLOWED = new Set([...CONTROL_PARAMS, ...PRESENTATION_PARAMS, ...AUTH_PARAMS]);

const LATEST_PATH = /^Users\/([^/]+)\/Items$/i;

export interface LatestRequest {
  userId: string;
  parentId: string;
  /** `episodes` : une bibliothèque de séries ; `mixed` : films et séries mélangés. */
  kind: "episodes" | "mixed";
  /** Le nombre de cartes à rendre : la rangée demandée, `LATEST_CARD_CAP` au plus. */
  cards: number;
  /** Les paramètres de présentation du client (champs, images, données du compte). */
  presentation: Array<[string, string]>;
}

/**
 * La requête de la rangée, ou `null` si ce n'en est pas une. `query` est la
 * chaîne d'origine, `?` compris ou non. Les noms de paramètres se lisent sans
 * égard à la casse, comme Jellyfin les lit.
 */
export function matchLatestRequest(path: string, query: string): LatestRequest | null {
  const match = LATEST_PATH.exec(path);
  if (!match || match[1].toLowerCase() === "me") return null;

  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  const values = new Map<string, string>();
  const presentation: Array<[string, string]> = [];
  for (const [key, value] of params) {
    const lower = key.toLowerCase();
    if (!ALLOWED.has(lower) || values.has(lower)) return null;
    values.set(lower, value);
    if (PRESENTATION_PARAMS.includes(lower)) presentation.push([key, value]);
  }

  const parentId = values.get("parentid") ?? "";
  const limit = Number(values.get("limit"));
  if (!parentId || !Number.isInteger(limit) || limit < 1) return null;
  if (values.get("recursive")?.toLowerCase() !== "true") return null;
  if (values.get("sortby")?.toLowerCase() !== "datecreated") return null;
  if (values.get("sortorder")?.toLowerCase() !== "descending") return null;

  const types = (values.get("includeitemtypes") ?? "").toLowerCase();
  const kind = types === "episode" ? "episodes" : types === "" ? "mixed" : null;
  if (!kind) return null;

  return { userId: match[1], parentId, kind, cards: Math.min(limit, LATEST_CARD_CAP), presentation };
}

/**
 * L'inventaire des ajouts récents, chez Jellyfin (forme documentée, `userId`
 * en query) : identifiants, types, rattachements et dates, rien d'autre. Une
 * bibliothèque de séries y ajoute ses SAISONS et ses SÉRIES — c'est ce qui dit
 * qu'une saison, ou la série entière, vient d'arriver. Une bibliothèque mixte
 * s'en tient aux films et aux séries, comme tout le catalogue de Tentacle :
 * sans type, Jellyfin y rendait aussi ses DOSSIERS (le dossier racine
 * « mixed » faisait une carte). Les éléments virtuels (saisons et épisodes
 * annoncés, sans fichier) n'y entrent pas.
 */
export function latestScanPath(request: LatestRequest, startIndex = 0): string {
  const params = new URLSearchParams({
    userId: request.userId,
    ParentId: request.parentId,
    Recursive: "true",
    SortBy: "DateCreated",
    SortOrder: "Descending",
    Limit: String(LATEST_SCAN_PAGE),
    Fields: "DateCreated",
    EnableImages: "false",
    EnableUserData: "false",
    EnableTotalRecordCount: "false",
    ExcludeLocationTypes: "Virtual",
  });
  params.set("IncludeItemTypes", request.kind === "episodes" ? "Episode,Season,Series" : "Movie,Series,Season,Episode");
  if (startIndex > 0) params.set("StartIndex", String(startIndex));
  return `Items?${params.toString()}`;
}

/**
 * Les cartes elles-mêmes, en UNE requête : les séries regroupées et les ajouts
 * gardés tels quels, avec les champs, les images et les données du compte
 * que le client avait demandés.
 */
export function latestDetailsPath(request: LatestRequest, ids: readonly string[]): string {
  const params = new URLSearchParams({ userId: request.userId, Ids: ids.join(","), EnableTotalRecordCount: "false" });
  for (const [key, value] of request.presentation) params.set(key, value);
  return `Items?${params.toString()}`;
}
