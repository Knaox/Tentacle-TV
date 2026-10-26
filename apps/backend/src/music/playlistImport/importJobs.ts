/**
 * Octave — les imports EN COURS, en mémoire : lecture → rapprochement →
 * création de la playlist Jellyfin AU NOM du compte, avec les seuls titres de
 * la bibliothèque. Un import à la fois par compte, quatre pour tout le
 * serveur ; un import fini se lit encore 15 min. Seul le compte qui l'a lancé
 * le lit (`getImport` : un autre identifiant répond « inconnu », jamais 403).
 */

import { randomUUID } from "crypto";
import { absentPositions, type ImportAbsentTrack, type ImportedPlaylist, type MusicImportJob } from "../contract/musicImport";
import type { UserView } from "../view/viewContext";
import { matchImported, type MatchFn } from "./importMatching";
import type { ImportRequestParsed } from "./importInput";
import { ImportReadFailure } from "./readers/readerKit";
import { readSource } from "./readSource";
import type { ImportFetcher } from "./importFetch";

const KEEP_MS = 15 * 60_000;
const MAX_RUNNING = 4;

export interface ImportDeps {
  fetcher: ImportFetcher;
  view: (userId: string) => Promise<UserView>;
  create: (userId: string, name: string, itemIds: string[]) => Promise<{ ok: true; value: string } | { ok: false }>;
  match?: MatchFn;
  now?: () => number;
}

interface JobRecord {
  userId: string;
  job: MusicImportJob;
  finishedAt: number | null;
}

const jobs = new Map<string, JobRecord>();

function sweep(now: number): void {
  for (const [id, record] of jobs) if (record.finishedAt !== null && now - record.finishedAt > KEEP_MS) jobs.delete(id);
}

const running = () => [...jobs.values()].filter((r) => r.finishedAt === null);

/** Le nom de la playlist créée : celui demandé, sinon celui de la source, sinon un nom daté. */
export function playlistName(asked: string | null, playlist: ImportedPlaylist, now: number): string {
  if (asked) return asked;
  if (playlist.name.trim()) return playlist.name.trim().slice(0, 200);
  return `Import ${new Date(now).toISOString().slice(0, 10)}`;
}

async function run(record: JobRecord, parsed: ImportRequestParsed, deps: ImportDeps): Promise<void> {
  const now = deps.now ?? Date.now;
  const job = record.job;
  const fail = (failure: NonNullable<MusicImportJob["failure"]>) => Object.assign(job, { stage: "failed", failure });
  try {
    const playlist = await readSource(deps.fetcher, parsed.input);
    Object.assign(job, { stage: "matching", source: playlist.source, name: playlist.name || null, total: playlist.tracks.length });
    const view = await deps.view(record.userId);
    const found = await matchImported(view, playlist.tracks, (matched, hits) => Object.assign(job, { matched, found: hits }), deps.match);
    const indexes = new Set(found.keys());
    const places = absentPositions(playlist.tracks.length, indexes);
    const absent: ImportAbsentTrack[] = playlist.tracks.filter((t) => !indexes.has(t.index)).map((t) => ({ ...t, position: places.get(t.index) ?? 0 }));
    if (indexes.size === 0 && !parsed.keepEmpty) return void fail("noneInLibrary");
    job.stage = "creating";
    const name = playlistName(parsed.name, playlist, now());
    const itemIds = playlist.tracks.flatMap((t) => (found.has(t.index) ? [found.get(t.index)!.id] : []));
    const created = await deps.create(record.userId, name, itemIds);
    if (!created.ok) return void fail("failed");
    job.result = { playlistId: created.value, name, source: playlist.source, total: playlist.tracks.length, added: itemIds.length, absent, truncated: playlist.truncated };
    job.stage = "done";
  } catch (error) {
    fail(error instanceof ImportReadFailure ? error.failure : "failed");
  } finally {
    record.finishedAt = now();
  }
}

export type StartOutcome = { ok: true; jobId: string; done: Promise<void> } | { ok: false; reason: "busy" };

export function startImport(userId: string, parsed: ImportRequestParsed, deps: ImportDeps): StartOutcome {
  sweep((deps.now ?? Date.now)());
  const active = running();
  if (active.length >= MAX_RUNNING || active.some((r) => r.userId === userId)) return { ok: false, reason: "busy" };
  const jobId = randomUUID();
  const record: JobRecord = {
    userId,
    finishedAt: null,
    job: { jobId, stage: "reading", source: parsed.input.kind === "url" ? parsed.input.url.source : null, name: null, total: 0, matched: 0, found: 0 },
  };
  jobs.set(jobId, record);
  return { ok: true, jobId, done: run(record, parsed, deps) };
}

/** L'état d'un import de CE compte ; `null` pour un identifiant inconnu ou celui d'un autre. */
export function getImport(userId: string, jobId: string): MusicImportJob | null {
  const record = jobs.get(jobId);
  return record && record.userId === userId ? { ...record.job } : null;
}

export function resetImportsForTests(): void {
  jobs.clear();
}
