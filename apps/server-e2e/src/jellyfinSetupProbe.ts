import { authHeader } from "./jellyfin";
import { fetchWithin } from "./stack";

/**
 * Un Jellyfin « déjà configuré » comme on en trouve chez soi, et son état lu
 * par son API : de quoi prouver ce que l'assistant y a changé — et surtout ce
 * qu'il n'y a PAS changé.
 */
type Loose = Record<string, unknown>;

async function json<T>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetchWithin(url, { ...init, headers: { ...authHeader(token), "content-type": "application/json", ...(init.headers as Record<string, string>) } });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${url} : ${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/**
 * Deux bibliothèques (Films, Séries) sans aperçus ni surveillance, la langue
 * des métadonnées en anglais (réglée AUTREMENT que le navigateur), et un nom.
 */
export async function configureExisting(url: string, token: string): Promise<void> {
  const config = await json<Loose>(`${url}/System/Configuration`, token);
  await json(`${url}/System/Configuration`, token, {
    method: "POST",
    body: JSON.stringify({ ...config, ServerName: "Salon", PreferredMetadataLanguage: "en", MetadataCountryCode: "US" }),
  });
  for (const [name, type, folder] of [["Films", "movies", "/media/films"], ["Séries", "tvshows", "/media/series"]]) {
    const query = new URLSearchParams({ name, collectionType: type, paths: folder, refreshLibrary: "false" });
    await json(`${url}/Library/VirtualFolders?${query}`, token, {
      method: "POST",
      body: JSON.stringify({ LibraryOptions: { EnableTrickplayImageExtraction: false, EnableRealtimeMonitor: false, PathInfos: [{ Path: folder }] } }),
    });
  }
}

export interface JellyfinState {
  libraries: Array<{ name: string; trickplay: boolean; realtime: boolean }>;
  language: string;
  plugins: string[];
}

export async function jellyfinState(url: string, token: string): Promise<JellyfinState> {
  const [folders, config, plugins] = await Promise.all([
    json<Loose[]>(`${url}/Library/VirtualFolders`, token),
    json<Loose>(`${url}/System/Configuration`, token),
    json<Loose[]>(`${url}/Plugins`, token),
  ]);
  return {
    libraries: folders.map((folder) => {
      const options = (folder.LibraryOptions ?? {}) as Loose;
      return { name: String(folder.Name), trickplay: options.EnableTrickplayImageExtraction === true, realtime: options.EnableRealtimeMonitor === true };
    }),
    language: `${String(config.PreferredMetadataLanguage)} · ${String(config.MetadataCountryCode)}`,
    plugins: plugins.map((plugin) => String(plugin.Name)),
  };
}
