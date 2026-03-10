import { getJellyfinUrl, getJellyfinApiKey } from "./configStore";

interface JellyfinUserResponse {
  Id: string;
  Name: string;
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
