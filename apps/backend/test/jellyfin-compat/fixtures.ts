/**
 * Après la préparation : attendre que Jellyfin ait scanné la médiathèque
 * synthétique (métadonnées TMDB, trickplay, images de chapitres), puis
 * retrouver les identifiants des titres que la suite interroge.
 */

import { JellyfinHttp, waitUntil } from "./jellyfinHttp";

interface Task {
  Id: string;
  Key: string;
  Name: string;
  State: "Idle" | "Running" | "Cancelling";
  LastExecutionResult?: { EndTimeUtc?: string; Status?: string };
}

async function tasks(http: JellyfinHttp, token: string): Promise<Task[]> {
  return http.get<Task[]>("/ScheduledTasks?isHidden=false", token);
}

/** Lance une tâche planifiée (la première clé connue) et attend sa fin. Rend sa clé, ou null. */
export async function runTask(http: JellyfinHttp, token: string, keys: string[], timeoutMs = 300_000): Promise<string | null> {
  const all = await tasks(http, token);
  const task = keys.map((k) => all.find((t) => t.Key === k)).find(Boolean);
  if (!task) return null;
  const startedAt = Date.now();
  await http.request(`/ScheduledTasks/Running/${task.Id}`, { method: "POST", token });
  await waitUntil(async () => {
    const t = (await tasks(http, token)).find((x) => x.Id === task.Id);
    const end = t?.LastExecutionResult?.EndTimeUtc ? Date.parse(t.LastExecutionResult.EndTimeUtc) : 0;
    return t?.State === "Idle" && end >= startedAt - 2000;
  }, timeoutMs, `tâche « ${task.Name} » terminée`, 2000);
  return task.Key;
}

export interface Counts {
  MovieCount: number;
  SeriesCount: number;
  EpisodeCount: number;
}

const enough = (c: Counts): boolean => c.MovieCount >= 5 && c.SeriesCount >= 2 && c.EpisodeCount >= 8;

/** Une instance reprise (`--reuse`) déjà scannée n'a pas à l'être de nouveau. */
export async function libraryReady(http: JellyfinHttp, token: string): Promise<Counts | null> {
  const counts = await http.get<Counts>("/Items/Counts", token);
  return enough(counts) ? counts : null;
}

/** Scan complet, puis trickplay, images de chapitres et segments quand la version les a. */
export async function scanLibrary(http: JellyfinHttp, token: string, log: (l: string) => void): Promise<Counts> {
  log("Scan de la médiathèque (métadonnées TMDB comprises)…");
  await runTask(http, token, ["RefreshLibrary"], 600_000);
  let counts: Counts = { MovieCount: 0, SeriesCount: 0, EpisodeCount: 0 };
  await waitUntil(async () => {
    counts = await http.get<Counts>("/Items/Counts", token);
    return enough(counts);
  }, 180_000, "films, séries et épisodes indexés", 2000);
  for (const [label, keys] of [
    ["images trickplay", ["RefreshTrickplayImages"]],
    ["images de chapitres", ["RefreshChapterImages"]],
    ["segments de média", ["TaskExtractMediaSegments"]],
  ] as const) {
    const key = await runTask(http, token, [...keys]);
    log(key ? `Tâche ${label} : terminée` : `Tâche ${label} : absente de cette version`);
  }
  return counts;
}

interface Item {
  Id: string;
  Name: string;
  Type: string;
  Path?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  SeriesId?: string;
  MediaSourceCount?: number;
}

export interface Fixtures {
  movies: { bbb: string; sintel: string; tears: string; elephants: string; cosmos: string };
  series: { breakingBad: string; bebop: string };
  seasons: { bb1: string; bb2: string };
  episodes: { bbS01E01: string; bbS01E02: string; bbS02E01: string; bebopS01E01: string };
  mixed: { movie: string };
  collection: string;
}

/** Les identifiants des titres de la médiathèque, retrouvés par leur chemin. */
export async function resolveFixtures(http: JellyfinHttp, token: string, userId: string): Promise<Fixtures> {
  const params = new URLSearchParams({
    userId, recursive: "true", fields: "Path", limit: "500",
    includeItemTypes: "Movie,Series,Season,Episode",
  });
  const { Items } = await http.get<{ Items: Item[] }>(`/Items?${params}`, token);
  const byPath = (type: string, fragment: string): string => {
    const hit = Items.find((i) => i.Type === type && (i.Path ?? "").includes(fragment));
    if (!hit) throw new Error(`Titre introuvable : ${type} « ${fragment} »`);
    return hit.Id;
  };
  const breakingBad = byPath("Series", "/shows/Breaking Bad (2008)");
  const season = (n: number): string => {
    const hit = Items.find((i) => i.Type === "Season" && i.SeriesId === breakingBad && i.IndexNumber === n);
    if (!hit) throw new Error(`Saison ${n} de Breaking Bad introuvable`);
    return hit.Id;
  };
  const collection = await ensureCollection(http, token, userId, [
    byPath("Movie", "Big Buck Bunny (2008).mkv"), byPath("Movie", "Elephants Dream"), byPath("Movie", "Cosmos Laundromat"),
  ]);
  return {
    movies: {
      bbb: byPath("Movie", "Big Buck Bunny (2008).mkv"),
      sintel: byPath("Movie", "/Sintel (2010)/"),
      tears: byPath("Movie", "Tears of Steel"),
      elephants: byPath("Movie", "Elephants Dream"),
      cosmos: byPath("Movie", "Cosmos Laundromat"),
    },
    series: { breakingBad, bebop: byPath("Series", "/shows/Cowboy Bebop (1998)") },
    seasons: { bb1: season(1), bb2: season(2) },
    episodes: {
      // Le NOM de la série fait partie du repère : Cowboy Bebop a aussi un S01E02.
      bbS01E01: byPath("Episode", "Breaking Bad - S01E01 - Pilot"),
      bbS01E02: byPath("Episode", "Breaking Bad - S01E02"),
      bbS02E01: byPath("Episode", "Breaking Bad - S02E01"),
      bebopS01E01: byPath("Episode", "Cowboy Bebop - S01E01"),
    },
    mixed: { movie: byPath("Movie", "Night of the Living Dead") },
    collection,
  };
}

const COLLECTION_NAME = "Films libres Blender";

/** Une collection (BoxSet) de trois films : « Inclus dans » et les sagas s'y éprouvent. */
async function ensureCollection(http: JellyfinHttp, token: string, userId: string, ids: string[]): Promise<string> {
  const find = async (): Promise<string | undefined> => {
    const params = new URLSearchParams({ userId, recursive: "true", includeItemTypes: "BoxSet", searchTerm: "Blender" });
    return (await http.get<{ Items: Item[] }>(`/Items?${params}`, token)).Items.find((i) => i.Name === COLLECTION_NAME)?.Id;
  };
  const existing = await find();
  if (existing) return existing;
  const params = new URLSearchParams({ name: COLLECTION_NAME, ids: ids.join(",") });
  const created = await http.post<{ Id: string }>(`/Collections?${params}`, undefined, token);
  let id = created?.Id;
  await waitUntil(async () => Boolean((id = id ?? (await find()))), 60_000, "collection créée");
  return id as string;
}
