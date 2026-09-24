import { getJellyfinUrl, getJellyfinApiKey } from "./configStore";

// La bibliothèque vue par le serveur (clé admin) : ce que la détection des
// ajouts, la reconnaissance des contenus et les recommandations lisent — les
// IDs, le décompte, les métadonnées d'identification. Sorti de jellyfin.ts,
// qui garde l'authentification et les fiches.

/** Item de bibliothèque + métadonnées utiles au titrage des notifs d'ajout. */
export interface LibItem {
  Id: string;
  Name: string;
  Type: string; // Movie | Series | Season | Episode
  SeriesName?: string;
  SeriesId?: string; // GUID Jellyfin de la série parente (renvoyé par défaut sur les Episode)
  DateCreated?: string;
  ParentIndexNumber?: number; // n° de saison (pour un épisode)
  IndexNumber?: number; // n° d'épisode (Episode) ou n° de saison (Season)
  ProductionYear?: number; // distingue deux films homonymes quand TMDB manque
  tmdbId?: number; // depuis ProviderIds.Tmdb — pour l'anti-doublon (claims plugins)
  seriesTmdbId?: number; // tmdbId TMDB de la SÉRIE parente (résolu à part, cf. libraryAddedSeries)
}

function mapLibItems(data: unknown): LibItem[] {
  const items = ((data as { Items?: unknown[] })?.Items ?? []) as Array<
    LibItem & { ProviderIds?: { Tmdb?: string } }
  >;
  return items.map((i) => ({
    Id: i.Id,
    Name: i.Name,
    Type: i.Type,
    SeriesName: i.SeriesName,
    SeriesId: i.SeriesId,
    DateCreated: i.DateCreated,
    ParentIndexNumber: i.ParentIndexNumber,
    IndexNumber: i.IndexNumber,
    ProductionYear: i.ProductionYear,
    tmdbId: i.ProviderIds?.Tmdb ? Number(i.ProviderIds.Tmdb) || undefined : undefined,
  }));
}

/**
 * Métadonnées d'items par IDs (clé admin) — pour titrer les notifs quand les IDs
 * viennent de l'event WebSocket ItemsAdded (fiable même si la date ne l'est pas).
 */
export async function getItemsByIds(ids: string[]): Promise<LibItem[]> {
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!jellyfinUrl || !apiKey || ids.length === 0) return [];

  const userId = await getAdminUserId();
  const userParam = userId ? `&userId=${userId}` : "";
  const res = await fetch(
    `${jellyfinUrl}/Items?Ids=${ids.join(",")}&Fields=SeriesName,ProviderIds${userParam}`,
    { headers: { "X-Emby-Token": apiKey }, signal: AbortSignal.timeout(10_000) },
  );
  if (!res.ok) {
    console.warn(`[LibNotif] getItemsByIds HTTP ${res.status}`);
    return [];
  }
  return mapLibItems(await res.json());
}

/**
 * Total d'items (films + séries + épisodes) via /Items/Counts. Détecteur d'ajout
 * FIABLE : le count augmente quel que soit le DateCreated (contrairement au tri
 * par date, faussé si Jellyfin utilise la date du fichier). Renvoie null si échec.
 */
export async function getItemCount(): Promise<number | null> {
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!jellyfinUrl || !apiKey) return null;
  try {
    const res = await fetch(`${jellyfinUrl}/Items/Counts`, {
      headers: { "X-Emby-Token": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const c = (await res.json()) as { MovieCount?: number; SeriesCount?: number; EpisodeCount?: number };
    return (c.MovieCount ?? 0) + (c.SeriesCount ?? 0) + (c.EpisodeCount ?? 0);
  } catch {
    return null;
  }
}

// ID d'un utilisateur admin Jellyfin, mis en cache. REQUIS pour lister TOUS les
// items : `/Items?Recursive=true` SANS `userId` masque une partie de la biblio
// (Jellyfin renvoie moins d'items que `/Items/Counts`), dont les nouveaux ajouts.
let cachedAdminUserId: string | null = null;

export async function getAdminUserId(): Promise<string | null> {
  if (cachedAdminUserId) return cachedAdminUserId;
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!jellyfinUrl || !apiKey) return null;
  try {
    const res = await fetch(`${jellyfinUrl}/Users`, {
      headers: { "X-Emby-Token": apiKey }, signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const users = (await res.json()) as Array<{ Id: string; Policy?: { IsAdministrator?: boolean } }>;
    const admin = users.find((u) => u.Policy?.IsAdministrator) ?? users[0];
    cachedAdminUserId = admin?.Id ?? null;
    return cachedAdminUserId;
  } catch {
    return null;
  }
}

/**
 * TOUS les IDs d'items (Movie/Series/Episode) — paginé, champs minimaux. Sert au
 * NOMMAGE fiable des ajouts par diff (robuste vs date fichier ET WS muet) : le tri
 * par date ne remonte pas un item antidaté, seul l'ensemble des IDs le révèle.
 * `userId` OBLIGATOIRE (sinon Jellyfin masque une partie des items → diff faux).
 * All-or-nothing : renvoie [] au moindre échec de page (une liste partielle
 * corromprait le diff → fausses notifs). Pic mémoire = une page (~100 Ko).
 */
export async function getAllLibraryItemIds(): Promise<string[]> {
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  const userId = await getAdminUserId();
  if (!jellyfinUrl || !apiKey || !userId) return [];

  const PAGE = 1000;
  const ids: string[] = [];
  let start = 0;
  try {
    for (;;) {
      const res = await fetch(
        `${jellyfinUrl}/Items?userId=${userId}&Recursive=true&IncludeItemTypes=Movie,Series,Episode` +
          `&Fields=&EnableImages=false&EnableUserData=false&EnableTotalRecordCount=true` +
          `&StartIndex=${start}&Limit=${PAGE}`,
        { headers: { "X-Emby-Token": apiKey }, signal: AbortSignal.timeout(15_000) },
      );
      if (!res.ok) {
        console.warn(`[LibNotif] getAllLibraryItemIds HTTP ${res.status}`);
        return [];
      }
      const data = (await res.json()) as { Items?: Array<{ Id?: string }>; TotalRecordCount?: number };
      const items = data.Items ?? [];
      for (const it of items) if (it.Id) ids.push(it.Id);
      start += items.length;
      if (items.length < PAGE || items.length === 0 || start >= (data.TotalRecordCount ?? 0)) break;
    }
  } catch {
    return []; // timeout / réseau → all-or-nothing
  }
  return ids;
}

/**
 * Toute la bibliothèque (Movie/Series/Episode) avec de quoi reconnaître chaque
 * contenu : TMDB, série parente, numéros, année — paginé. Sert une fois, à
 * reconnaître les items connus d'avant la reconnaissance des contenus
 * (libraryPresence). All-or-nothing comme getAllLibraryItemIds : null au
 * moindre échec de page, plutôt qu'une reconnaissance partielle.
 */
export async function getAllLibraryItemsForIdentity(): Promise<LibItem[] | null> {
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  const userId = await getAdminUserId();
  if (!jellyfinUrl || !apiKey || !userId) return null;

  const PAGE = 1000;
  const out: LibItem[] = [];
  try {
    for (let start = 0; ; ) {
      const res = await fetch(
        `${jellyfinUrl}/Items?userId=${userId}&Recursive=true&IncludeItemTypes=Movie,Series,Episode` +
          `&Fields=ProviderIds,SeriesName&EnableImages=false&EnableUserData=false&EnableTotalRecordCount=true` +
          `&StartIndex=${start}&Limit=${PAGE}`,
        { headers: { "X-Emby-Token": apiKey }, signal: AbortSignal.timeout(30_000) },
      );
      if (!res.ok) {
        console.warn(`[LibNotif] getAllLibraryItemsForIdentity HTTP ${res.status}`);
        return null;
      }
      const data = (await res.json()) as { Items?: unknown[]; TotalRecordCount?: number };
      const page = mapLibItems(data);
      out.push(...page);
      start += page.length;
      if (page.length < PAGE || page.length === 0 || start >= (data.TotalRecordCount ?? 0)) break;
    }
  } catch {
    return null;
  }
  return out;
}
