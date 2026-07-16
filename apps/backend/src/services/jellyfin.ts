import { getJellyfinUrl, getJellyfinApiKey } from "./configStore";
import { BACKEND_VERSION } from "./version";

interface JellyfinUserResponse {
  Id: string;
  Name: string;
}

export interface JellyfinAuthResult {
  accessToken: string;
  userId: string;
  username: string;
  isAdmin: boolean;
}

/**
 * Authentifie un utilisateur Jellyfin par identifiants et renvoie son
 * AccessToken (jeton de streaming long-lived). Réutilisé pour le compte de
 * provisioning dédié. Même logique que POST /api/auth/login (deviceId ASCII-safe
 * pour les usernames non-ASCII — cf. commit cde9bd5).
 */
export async function authenticateJellyfinUser(
  username: string,
  password: string,
): Promise<JellyfinAuthResult> {
  const jellyfinUrl = getJellyfinUrl();
  if (!jellyfinUrl) {
    throw new Error("Jellyfin n'est pas configuré");
  }

  const deviceId = `tentacle-provisioning-${encodeURIComponent(username)}`;
  const authHeader = `MediaBrowser Client="Tentacle TV", Device="Provisioning", DeviceId="${deviceId}", Version="${BACKEND_VERSION}"`;
  const res = await fetch(`${jellyfinUrl}/Users/AuthenticateByName`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ Username: username, Pw: password }),
  });

  if (!res.ok) {
    throw new Error("Identifiants invalides");
  }

  const data = await res.json();
  return {
    accessToken: data.AccessToken,
    userId: data.User?.Id,
    username: data.User?.Name ?? username,
    isAdmin: !!data.User?.Policy?.IsAdministrator,
  };
}

export async function createJellyfinUser(
  username: string,
  password: string
): Promise<JellyfinUserResponse> {
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();

  if (!jellyfinUrl || !apiKey) {
    throw new Error("Jellyfin n'est pas configuré");
  }

  const createRes = await fetch(`${jellyfinUrl}/Users/New`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Emby-Token": apiKey,
    },
    body: JSON.stringify({ Name: username }),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Échec de création: ${errorText}`);
  }

  const user: JellyfinUserResponse = await createRes.json();

  const passwordRes = await fetch(
    `${jellyfinUrl}/Users/${user.Id}/Password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Emby-Token": apiKey,
      },
      body: JSON.stringify({ NewPw: password, ResetPassword: false }),
    }
  );

  if (!passwordRes.ok) {
    throw new Error("Utilisateur créé mais impossible de définir le mot de passe");
  }

  return user;
}

export async function listJellyfinUsers(): Promise<{ Id: string; Name: string }[]> {
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();

  if (!jellyfinUrl || !apiKey) {
    throw new Error("Jellyfin n'est pas configuré");
  }

  const res = await fetch(`${jellyfinUrl}/Users`, {
    headers: { "X-Emby-Token": apiKey },
  });

  if (!res.ok) {
    throw new Error(`Impossible de récupérer les utilisateurs: ${res.status}`);
  }

  const users: { Id: string; Name: string }[] = await res.json();
  return users.map((u) => ({ Id: u.Id, Name: u.Name }));
}

export async function getJellyfinItemInfo(itemId: string): Promise<{
  Id: string; Name: string; Type: string;
  ProductionYear?: number; ImageTags?: Record<string, string>;
} | null> {
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();

  if (!jellyfinUrl || !apiKey) {
    throw new Error("Jellyfin n'est pas configuré");
  }

  const res = await fetch(`${jellyfinUrl}/Items/${itemId}`, {
    headers: { "X-Emby-Token": apiKey },
  });

  if (!res.ok) return null;

  const data = await res.json();
  return {
    Id: data.Id,
    Name: data.Name,
    Type: data.Type,
    ProductionYear: data.ProductionYear,
    ImageTags: data.ImageTags,
  };
}

export async function getUserItemsBatch(
  userId: string,
  itemIds: string[]
): Promise<{ Items: { Id: string; Name: string; Type: string; ProductionYear?: number; ImageTags?: Record<string, string>; UserData?: { Played: boolean; IsFavorite: boolean } }[] }> {
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();

  if (!jellyfinUrl || !apiKey) {
    throw new Error("Jellyfin n'est pas configuré");
  }

  if (itemIds.length === 0) return { Items: [] };

  const res = await fetch(
    `${jellyfinUrl}/Users/${userId}/Items?Ids=${itemIds.join(",")}&Fields=PrimaryImageAspectRatio&EnableUserData=true`,
    { headers: { "X-Emby-Token": apiKey } }
  );

  if (!res.ok) {
    throw new Error(`Impossible de récupérer les items: ${res.status}`);
  }

  return res.json();
}

export async function getUserWatchlist(userId: string): Promise<{ Items: { Id: string; Name: string; Type: string; ImageTags?: Record<string, string>; ProductionYear?: number }[] }> {
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();

  if (!jellyfinUrl || !apiKey) {
    throw new Error("Jellyfin n'est pas configuré");
  }

  const res = await fetch(
    `${jellyfinUrl}/Users/${userId}/Items?Filters=Likes&Recursive=true` +
      `&IncludeItemTypes=Movie,Series&SortBy=DateCreated&SortOrder=Descending` +
      `&Fields=Overview,Genres,PrimaryImageAspectRatio&EnableImageTypes=Primary,Backdrop,Thumb&ImageTypeLimit=1&EnableUserData=true`,
    { headers: { "X-Emby-Token": apiKey } }
  );

  if (!res.ok) {
    throw new Error(`Impossible de récupérer la watchlist: ${res.status}`);
  }

  return res.json();
}

/** Détail enrichi d'un item (via clé admin) — pour la fiche publique de partage. */
export async function getItemDetail(userId: string, itemId: string): Promise<Record<string, unknown>> {
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();

  if (!jellyfinUrl || !apiKey) {
    throw new Error("Jellyfin n'est pas configuré");
  }

  const res = await fetch(
    `${jellyfinUrl}/Users/${userId}/Items/${itemId}` +
      `?Fields=Overview,Genres,Taglines,People,Studios,ProviderIds,RemoteTrailers,RunTimeTicks,ParentBackdropImageTags,ParentBackdropItemId`,
    { headers: { "X-Emby-Token": apiKey } }
  );

  if (!res.ok) {
    throw new Error(`Item introuvable: ${res.status}`);
  }

  return res.json();
}

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
    tmdbId: i.ProviderIds?.Tmdb ? Number(i.ProviderIds.Tmdb) || undefined : undefined,
  }));
}

/**
 * Derniers items ajoutés (tri DateCreated desc, clé admin). Endpoint /Items
 * éprouvé (cf. jellyfinPoller). Fournit les titres quand la date est récente.
 * Renvoie [] si échec (best-effort).
 */
export async function getRecentlyAddedItems(limit: number): Promise<LibItem[]> {
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!jellyfinUrl || !apiKey) return [];

  const res = await fetch(
    `${jellyfinUrl}/Items?SortBy=DateCreated&SortOrder=Descending&Limit=${limit}` +
      `&Recursive=true&IncludeItemTypes=Movie,Series,Episode&Fields=DateCreated,SeriesName`,
    { headers: { "X-Emby-Token": apiKey }, signal: AbortSignal.timeout(10_000) },
  );
  if (!res.ok) {
    console.warn(`[LibNotif] getRecentlyAddedItems HTTP ${res.status}`);
    return [];
  }
  return mapLibItems(await res.json());
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

async function getAdminUserId(): Promise<string | null> {
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
