/**
 * Préparer une instance neuve comme un administrateur le ferait : assistant
 * de premier démarrage, clé d'API, bibliothèques (films, séries, mixte),
 * comptes de test. Tout est idempotent : relancé sur une instance déjà
 * préparée (`--reuse`), rien n'est dupliqué.
 *
 * Écrit pour 10.10, 10.11 et 12.x : aucune route propre à une version.
 */

import { JellyfinHttp, waitUntil } from "./jellyfinHttp";

export interface Account {
  name: string;
  password: string;
  id: string;
  token: string;
}

export interface PublicInfo {
  Version: string;
  ServerName: string;
  Id: string;
  StartupWizardCompleted: boolean;
}

export const ADMIN_NAME = "compat-admin";
export const USER_NAME = "compat-user";
export const USER2_NAME = "compat-user2";
/** Instance jetable, jamais exposée (127.0.0.1) : un mot de passe fixe suffit. */
export const COMPAT_PASSWORD = "compat-Jellyfin-2026";

export const LIBRARIES = [
  { name: "Films", collectionType: "movies", path: "/media/movies" },
  { name: "Séries", collectionType: "tvshows", path: "/media/shows" },
  // Sans type : c'est la forme que Jellyfin donne à « films et séries mélangés ».
  { name: "Mixte", collectionType: null, path: "/media/mixed" },
] as const;

export async function waitForServer(http: JellyfinHttp, timeoutMs = 180_000): Promise<PublicInfo> {
  let info: PublicInfo | null = null;
  await waitUntil(async () => {
    info = await http.get<PublicInfo>("/System/Info/Public");
    return Boolean(info?.Version);
  }, timeoutMs, "Jellyfin répond sur /System/Info/Public (migrations au premier démarrage comprises)");
  return info as unknown as PublicInfo;
}

/** L'assistant de premier démarrage, par ses routes publiques (les mêmes depuis 10.8). */
export async function completeWizard(http: JellyfinHttp): Promise<void> {
  const info = await http.get<PublicInfo>("/System/Info/Public");
  if (info.StartupWizardCompleted) return;
  await http.post("/Startup/Configuration", { UICulture: "fr-FR", MetadataCountryCode: "FR", PreferredMetadataLanguage: "fr" });
  // GET d'abord : sur les anciennes versions, il crée l'utilisateur initial.
  await http.get("/Startup/User");
  await http.post("/Startup/User", { Name: ADMIN_NAME, Password: COMPAT_PASSWORD });
  // Dépréciée en 12.0 mais toujours servie ; sans conséquence si elle manque.
  await http.request("/Startup/RemoteAccess", {
    method: "POST", body: { EnableRemoteAccess: true, EnableAutomaticPortMapping: false }, accept: [404, 405],
  });
  await http.post("/Startup/Complete");
  await waitUntil(async () => (await http.get<PublicInfo>("/System/Info/Public")).StartupWizardCompleted, 30_000, "assistant terminé");
}

export async function authenticate(http: JellyfinHttp, name: string, deviceId?: string): Promise<Account> {
  const res = await fetch(`${http.baseUrl}/Users/AuthenticateByName`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `MediaBrowser Client="Tentacle Compat", Device="compat-suite", DeviceId="${deviceId ?? `compat-${name}`}", Version="1.0.0"`,
    },
    body: JSON.stringify({ Username: name, Pw: COMPAT_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Connexion de ${name} refusée (${res.status})`);
  const body = (await res.json()) as { AccessToken: string; User: { Id: string } };
  return { name, password: COMPAT_PASSWORD, id: body.User.Id, token: body.AccessToken };
}

/** Une clé d'API nommée « Tentacle Compat » — celle que le backend recevra. */
export async function ensureApiKey(http: JellyfinHttp, adminToken: string): Promise<string> {
  type Keys = { Items: Array<{ AccessToken: string; AppName: string }> };
  const find = async (): Promise<string | undefined> =>
    (await http.get<Keys>("/Auth/Keys", adminToken)).Items.find((k) => k.AppName === "Tentacle Compat")?.AccessToken;
  const existing = await find();
  if (existing) return existing;
  await http.request(`/Auth/Keys?app=${encodeURIComponent("Tentacle Compat")}`, { method: "POST", token: adminToken });
  const created = await find();
  if (!created) throw new Error("La clé d'API n'apparaît pas après sa création");
  return created;
}

/**
 * Coupe (ou rétablit) l'autorisation héritée (`X-Emby-Token`, `api_key`…).
 * Rend l'état effectif, ou null si la version n'a pas l'option (avant 10.11 :
 * l'héritée y est toujours acceptée).
 */
export async function setLegacyAuthorization(http: JellyfinHttp, adminToken: string, enabled: boolean): Promise<boolean | null> {
  const config = await http.get<Record<string, unknown>>("/System/Configuration", adminToken);
  if (!("EnableLegacyAuthorization" in config)) return null;
  if (config.EnableLegacyAuthorization !== enabled) {
    await http.post("/System/Configuration", { ...config, EnableLegacyAuthorization: enabled }, adminToken);
  }
  const after = await http.get<Record<string, unknown>>("/System/Configuration", adminToken);
  return after.EnableLegacyAuthorization === true;
}

/**
 * Les médias synthétiques durent une minute : sous `MinResumeDurationSeconds`
 * (5 min par défaut), Jellyfin ne garde AUCUNE position de reprise et marque le
 * titre « vu » à l'arrêt. On abaisse le seuil pour éprouver la reprise.
 */
export async function allowShortResume(http: JellyfinHttp, adminToken: string): Promise<void> {
  const config = await http.get<Record<string, unknown>>("/System/Configuration", adminToken);
  if (config.MinResumeDurationSeconds === 1) return;
  await http.post("/System/Configuration", { ...config, MinResumeDurationSeconds: 1 }, adminToken);
}

export interface Library {
  id: string;
  name: string;
  collectionType: string | null;
}

const LIBRARY_OPTIONS = {
  Enabled: true,
  EnableRealtimeMonitor: false,
  EnableChapterImageExtraction: true,
  ExtractChapterImagesDuringLibraryScan: true,
  EnableTrickplayImageExtraction: true,
  ExtractTrickplayImagesDuringLibraryScan: true,
  SaveTrickplayWithMedia: false,
  EnableInternetProviders: true,
  PreferredMetadataLanguage: "fr",
  MetadataCountryCode: "FR",
  AutomaticRefreshIntervalDays: 0,
};

/** Les trois bibliothèques, créées si besoin ; rend leurs identifiants. */
type Folder = { Name: string; ItemId?: string; CollectionType?: string | null };

const virtualFolders = (http: JellyfinHttp, adminToken: string): Promise<Folder[]> =>
  http.get<Folder[]>("/Library/VirtualFolders", adminToken);

/** Crée les bibliothèques qui manquent (sans scan : `scanLibrary` s'en charge). */
export async function ensureLibraries(http: JellyfinHttp, adminToken: string): Promise<void> {
  const existing = await virtualFolders(http, adminToken);
  for (const lib of LIBRARIES) {
    if (existing.some((f) => f.Name === lib.name)) continue;
    const params = new URLSearchParams({ name: lib.name, paths: lib.path, refreshLibrary: "false" });
    if (lib.collectionType) params.set("collectionType", lib.collectionType);
    await http.request(`/Library/VirtualFolders?${params}`, {
      method: "POST", token: adminToken, body: { LibraryOptions: LIBRARY_OPTIONS },
    });
  }
}

/**
 * Les identifiants des bibliothèques, APRÈS le scan : Jellyfin 10.10 ne donne
 * l'`ItemId` d'une bibliothèque qu'une fois son dossier scanné (10.11 et 12.x,
 * dès la création) — relevés plus tôt, ils manquaient, et chaque requête
 * partait avec `ParentId=undefined`.
 */
export async function libraryIds(http: JellyfinHttp, adminToken: string): Promise<Library[]> {
  let folders: Folder[] = [];
  await waitUntil(async () => {
    folders = await virtualFolders(http, adminToken);
    return LIBRARIES.every((lib) => folders.find((f) => f.Name === lib.name)?.ItemId);
  }, 60_000, "identifiants des bibliothèques");
  return LIBRARIES.map((lib) => ({ id: folders.find((f) => f.Name === lib.name)!.ItemId!, name: lib.name, collectionType: lib.collectionType }));
}

/** Un compte non administrateur ; rend son identifiant. */
export async function ensureUser(http: JellyfinHttp, adminToken: string, name: string): Promise<string> {
  type User = { Id: string; Name: string };
  const users = await http.get<User[]>("/Users", adminToken);
  const found = users.find((u) => u.Name === name);
  if (found) return found.Id;
  const created = await http.post<User>("/Users/New", { Name: name, Password: COMPAT_PASSWORD }, adminToken);
  return created.Id;
}
