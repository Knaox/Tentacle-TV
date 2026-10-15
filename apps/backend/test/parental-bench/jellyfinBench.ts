/**
 * Le Jellyfin JETABLE du banc (10.11, conteneur `jf-parental`, 127.0.0.1:8915) :
 * jamais le Jellyfin réel, que dev et prod partagent. Il reçoit la médiathèque
 * du catalogue (fabriquée par le ffmpeg de l'image Jellyfin, rien sur l'hôte),
 * quatre bibliothèques sans fournisseur Internet (les classifications restent
 * celles des .nfo), et quatre comptes : l'administrateur, `enfant6`, `libre`,
 * `filmsseuls`.
 */

import { createHash } from "node:crypto";
import { containerState, docker, readContainerFile, runInJellyfinImage } from "../jellyfin-compat/docker";
import { JellyfinHttp, waitUntil } from "../jellyfin-compat/jellyfinHttp";
import {
  ADMIN_NAME, BENCH_PASSWORD, BLOCKED_TAG, FILMS_ONLY_NAME, FREE_NAME, LIBRARIES, MOVIES, RESTRICTED_MAX_RATING, RESTRICTED_NAME, SERIES,
  type LibraryKey,
} from "./catalog";

export const JF_IMAGE = "jellyfin/jellyfin:10.11";
export const JF_NAME = "jf-parental";
export const JF_PORT = Number(process.env.PARENTAL_JF_PORT ?? 8915);
export const JF_VOLUMES = ["config", "cache", "media"].map((v) => `${JF_NAME}-${v}`);

export interface BenchAccount {
  name: string;
  id: string;
  /** Jeton Jellyfin du compte : la RÉFÉRENCE, ce que Jellyfin lui montre. */
  token: string;
}

export interface JellyfinBench {
  url: string;
  http: JellyfinHttp;
  apiKey: string;
  admin: BenchAccount;
  restricted: BenchAccount;
  free: BenchAccount;
  filmsOnly: BenchAccount;
  libraries: Record<LibraryKey, string>;
}

/** Guillemets simples pour bash. */
const q = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;
const xml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const tagsXml = (tags?: string[]): string => (tags ?? []).map((t) => `<tag>${xml(t)}</tag>`).join("");
const ratingXml = (rating?: string): string => (rating ? `<mpaa>${xml(rating)}</mpaa>` : "");

/** Le script qui fabrique la médiathèque dans le volume (un seul clip, recopié). */
function mediaScript(): string {
  const lines = [
    "set -e",
    "FF=/usr/lib/jellyfin-ffmpeg/ffmpeg",
    "rm -rf /media/films /media/series /media/reservee /media/reservee-series",
    "$FF -loglevel error -y -f lavfi -i testsrc=size=320x180:rate=10 -f lavfi -i sine=frequency=440 -t 4 -c:v libx264 -preset ultrafast -c:a aac -shortest /tmp/clip.mkv",
  ];
  const put = (path: string, content: string) => lines.push(`printf '%s\\n' ${q(content)} > ${q(path)}`);
  for (const m of MOVIES) {
    const folder = LIBRARIES.find((l) => l.key === m.library)!.folder;
    const dir = `/media/${folder}/${m.title} (${m.year})`;
    lines.push(`mkdir -p ${q(dir)}`, `cp /tmp/clip.mkv ${q(`${dir}/${m.title} (${m.year}).mkv`)}`);
    put(`${dir}/movie.nfo`, `<movie><title>${xml(m.title)}</title><year>${m.year}</year>${ratingXml(m.rating)}${tagsXml(m.tags)}<uniqueid type="tmdb" default="true">${m.tmdbId}</uniqueid><tmdbid>${m.tmdbId}</tmdbid><lockdata>true</lockdata></movie>`);
  }
  for (const s of SERIES) {
    const folder = LIBRARIES.find((l) => l.key === (s.library ?? "series"))!.folder;
    const dir = `/media/${folder}/${s.title} (${s.year})`;
    lines.push(`mkdir -p ${q(dir)}`);
    put(`${dir}/tvshow.nfo`, `<tvshow><title>${xml(s.title)}</title><year>${s.year}</year>${ratingXml(s.rating)}${tagsXml(s.tags)}<uniqueid type="tmdb" default="true">${s.tmdbId}</uniqueid><tmdbid>${s.tmdbId}</tmdbid><lockdata>true</lockdata></tvshow>`);
    for (const e of s.episodes) {
      const season = `${dir}/Season ${String(e.season).padStart(2, "0")}`;
      const base = `${season}/${s.title} - S${String(e.season).padStart(2, "0")}E${String(e.episode).padStart(2, "0")}`;
      lines.push(`mkdir -p ${q(season)}`, `cp /tmp/clip.mkv ${q(`${base}.mkv`)}`);
      put(`${base}.nfo`, `<episodedetails><title>${xml(e.title)}</title><season>${e.season}</season><episode>${e.episode}</episode>${ratingXml(e.rating)}<lockdata>true</lockdata></episodedetails>`);
    }
  }
  lines.push(`echo ${MEDIA_STAMP} > /media/.stamp`);
  return lines.join("\n");
}

const MEDIA_STAMP = createHash("sha1").update(JSON.stringify([MOVIES, SERIES, LIBRARIES])).digest("hex").slice(0, 12);

/** Le conteneur, lancé (créé au besoin) ; la médiathèque refaite si le catalogue a changé. */
export function ensureContainer(log: (l: string) => void): boolean {
  const state = containerState(JF_NAME);
  if (state === "missing") {
    for (const v of JF_VOLUMES) docker(["volume", "create", v]);
  }
  const stamp = readContainerFile(JF_NAME, "/media/.stamp")?.trim();
  const mediaChanged = stamp !== MEDIA_STAMP;
  if (mediaChanged) {
    log("Médiathèque factice (ffmpeg de l'image Jellyfin)…");
    runInJellyfinImage(JF_IMAGE, `${JF_NAME}-media`, mediaScript());
  }
  if (state === "missing") {
    docker([
      "run", "-d", "--name", JF_NAME, "--label", "tentacle.parental-bench=1",
      "-p", `127.0.0.1:${JF_PORT}:8096`, "-e", "TZ=Europe/Paris",
      "-v", `${JF_NAME}-config:/config`, "-v", `${JF_NAME}-cache:/cache`, "-v", `${JF_NAME}-media:/media:ro`,
      JF_IMAGE,
    ]);
  } else if (state === "stopped") docker(["start", JF_NAME]);
  return mediaChanged;
}

/** Supprime conteneur et volumes (fin du banc). */
export function destroyContainer(): void {
  docker(["rm", "-f", "-v", JF_NAME], { allowFail: true });
  for (const v of JF_VOLUMES) docker(["volume", "rm", "-f", v], { allowFail: true });
}

const authHeader = (deviceId: string) =>
  `MediaBrowser Client="Banc parental", Device="banc", DeviceId="${deviceId}", Version="1.0.0"`;

export async function login(url: string, name: string): Promise<BenchAccount> {
  const res = await fetch(`${url}/Users/AuthenticateByName`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader(`parental-${name}`) },
    body: JSON.stringify({ Username: name, Pw: BENCH_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Connexion Jellyfin de ${name} refusée (${res.status})`);
  const body = (await res.json()) as { AccessToken: string; User: { Id: string } };
  return { name, id: body.User.Id, token: body.AccessToken };
}

const LIBRARY_OPTIONS = {
  Enabled: true, EnableRealtimeMonitor: false, EnableInternetProviders: false, MetadataSavers: [],
  EnableTrickplayImageExtraction: false, EnableChapterImageExtraction: false,
  PreferredMetadataLanguage: "fr", MetadataCountryCode: "FR", AutomaticRefreshIntervalDays: 0,
};

async function ensureUser(http: JellyfinHttp, token: string, name: string): Promise<string> {
  const users = await http.get<Array<{ Id: string; Name: string }>>("/Users", token);
  const found = users.find((u) => u.Name === name);
  if (found) return found.Id;
  return (await http.post<{ Id: string }>("/Users/New", { Name: name, Password: BENCH_PASSWORD }, token)).Id;
}

async function patchPolicy(http: JellyfinHttp, token: string, userId: string, patch: Record<string, unknown>): Promise<void> {
  const user = await http.get<{ Policy: Record<string, unknown> }>(`/Users/${userId}`, token);
  await http.post(`/Users/${userId}/Policy`, { ...user.Policy, ...patch }, token);
}

/** Assistant, clé d'API, bibliothèques scannées, comptes et leurs politiques. */
export async function provision(log: (l: string) => void, rescan: boolean): Promise<JellyfinBench> {
  const url = `http://127.0.0.1:${JF_PORT}`;
  const http = new JellyfinHttp(url);
  await waitUntil(async () => Boolean((await http.get<{ Id?: string }>("/System/Info/Public")).Id), 180_000, "Jellyfin répond");
  const info = await http.get<{ StartupWizardCompleted: boolean }>("/System/Info/Public");
  if (!info.StartupWizardCompleted) {
    await http.post("/Startup/Configuration", { UICulture: "fr-FR", MetadataCountryCode: "FR", PreferredMetadataLanguage: "fr" });
    await http.get("/Startup/User");
    await http.post("/Startup/User", { Name: ADMIN_NAME, Password: BENCH_PASSWORD });
    await http.post("/Startup/Complete");
    await waitUntil(async () => (await http.get<{ StartupWizardCompleted: boolean }>("/System/Info/Public")).StartupWizardCompleted, 30_000, "assistant");
  }
  const admin = await login(url, ADMIN_NAME);
  type Keys = { Items: Array<{ AccessToken: string; AppName: string }> };
  const findKey = async () => (await http.get<Keys>("/Auth/Keys", admin.token)).Items.find((k) => k.AppName === "Tentacle")?.AccessToken;
  if (!(await findKey())) await http.request("/Auth/Keys?app=Tentacle", { method: "POST", token: admin.token });
  const apiKey = (await findKey())!;

  type Folder = { Name: string; ItemId?: string };
  const folders = () => http.get<Folder[]>("/Library/VirtualFolders", admin.token);
  const existing = await folders();
  for (const lib of LIBRARIES) {
    if (existing.some((f) => f.Name === lib.name)) continue;
    const params = new URLSearchParams({ name: lib.name, paths: `/media/${lib.folder}`, collectionType: lib.collectionType, refreshLibrary: "false" });
    await http.request(`/Library/VirtualFolders?${params}`, { method: "POST", token: admin.token, body: { LibraryOptions: LIBRARY_OPTIONS } });
    rescan = true;
  }
  const expected = MOVIES.length + SERIES.length + SERIES.reduce((n, s) => n + s.episodes.length, 0);
  const count = async () =>
    (await http.get<{ TotalRecordCount: number }>(`/Items?Recursive=true&IncludeItemTypes=Movie,Series,Episode&Limit=0&userId=${admin.id}`, admin.token)).TotalRecordCount;
  if (rescan || (await count()) !== expected) {
    log("Scan des bibliothèques…");
    await http.request("/Library/Refresh", { method: "POST", token: admin.token });
    await waitUntil(async () => (await count()) === expected, 300_000, `${expected} titres scannés`, 2000);
  }
  const all = await folders();
  const libraries = Object.fromEntries(LIBRARIES.map((l) => [l.key, all.find((f) => f.Name === l.name)!.ItemId!])) as Record<LibraryKey, string>;

  const restrictedId = await ensureUser(http, admin.token, RESTRICTED_NAME);
  await patchPolicy(http, admin.token, restrictedId, {
    MaxParentalRating: RESTRICTED_MAX_RATING,
    BlockUnratedItems: ["Movie", "Trailer", "Series", "Music", "Book", "LiveTvChannel", "LiveTvProgram", "ChannelContent", "Other"],
    BlockedTags: [BLOCKED_TAG],
    EnableAllFolders: false,
    EnabledFolders: [libraries.films, libraries.series],
    AccessSchedules: [],
  });
  const freeId = await ensureUser(http, admin.token, FREE_NAME);
  await patchPolicy(http, admin.token, freeId, { MaxParentalRating: null, BlockUnratedItems: [], BlockedTags: [], EnableAllFolders: true });
  const filmsOnlyId = await ensureUser(http, admin.token, FILMS_ONLY_NAME);
  await patchPolicy(http, admin.token, filmsOnlyId, { MaxParentalRating: null, BlockUnratedItems: [], BlockedTags: [], EnableAllFolders: false, EnabledFolders: [libraries.films] });
  log(`Jellyfin prêt : ${expected} titres, ${RESTRICTED_NAME} (≤ ${RESTRICTED_MAX_RATING}, sans les « Réservée »), ${FREE_NAME}`);
  return {
    url, http, apiKey, admin, libraries,
    restricted: await login(url, RESTRICTED_NAME),
    free: await login(url, FREE_NAME),
    filmsOnly: await login(url, FILMS_ONLY_NAME),
  };
}
