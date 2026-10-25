/**
 * Octave — la ReplayGain d'un titre, LUE DES TAGS de son fichier (par plages,
 * au plus cinq lectures, quelques centaines de Ko), une fois : le résultat est
 * gardé dans l'index (`replayGainJson`, `{}` = le fichier n'en dit rien) et
 * relu tant que le fichier ne change pas.
 *
 * Sans tag : `NormalizationGain` de Jellyfin (son analyse LUFS, ou le gain de
 * titre qu'il a lu lui-même), en gain de titre seul.
 */

import type { ReplayGainInfo } from "../contract/musicPlayback";
import { replayGainJsonOf } from "../index/indexQueries";
import { saveReplayGain } from "../index/indexStore";
import type { IndexRow } from "../index/indexTypes";
import { jfRaw, q } from "../jellyfin/musicJellyfin";
import { RG_PROBE_BYTES, scanReplayGain, type ScanMode } from "./rgScan";

const MAX_READS = 5;

async function readRange(itemId: string, offset: number, length: number): Promise<Buffer | null> {
  const res = await jfRaw(`/Audio/${q(itemId)}/stream?static=true`, {
    headers: { Range: `bytes=${offset}-${offset + length - 1}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res || (res.status !== 206 && res.status !== 200)) {
    await res?.body?.cancel().catch(() => undefined);
    return null;
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  // Un 200 (plage ignorée) rend tout le fichier : on n'en garde que la plage voulue.
  return res.status === 200 ? bytes.subarray(offset, offset + length) : bytes;
}

async function readFromTags(itemId: string): Promise<ReplayGainInfo | null | undefined> {
  let offset = 0;
  let length = RG_PROBE_BYTES;
  let mode: ScanMode = "start";
  for (let i = 0; i < MAX_READS; i++) {
    const buf = await readRange(itemId, offset, length);
    // Jellyfin muet : on ne sait pas — rien n'est gardé, on relira.
    if (!buf) return undefined;
    const scan = scanReplayGain(buf, offset, mode);
    if (scan.done) return scan.info;
    ({ offset, length, mode } = scan);
  }
  return null;
}

function parseStored(json: string): ReplayGainInfo | null {
  try {
    const value = JSON.parse(json) as Partial<ReplayGainInfo>;
    if (!value || typeof value !== "object" || !("trackGainDb" in value)) return null;
    return {
      trackGainDb: value.trackGainDb ?? null,
      trackPeak: value.trackPeak ?? null,
      albumGainDb: value.albumGainDb ?? null,
      albumPeak: value.albumPeak ?? null,
    };
  } catch {
    return null;
  }
}

function fallback(row: IndexRow): ReplayGainInfo | null {
  return row.normalizationGain === null ? null : { trackGainDb: row.normalizationGain, trackPeak: null, albumGainDb: null, albumPeak: null };
}

export async function replayGainFor(row: IndexRow): Promise<ReplayGainInfo | null> {
  const stored = await replayGainJsonOf(row.id);
  if (stored !== null) return parseStored(stored) ?? fallback(row);
  const info = await readFromTags(row.id).catch(() => undefined);
  if (info === undefined) return fallback(row);
  await saveReplayGain(row.id, info ? JSON.stringify(info) : "{}").catch(() => undefined);
  return info ?? fallback(row);
}
