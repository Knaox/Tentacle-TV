/* ------------------------------------------------------------------ */
/*  Ce que les routes lisent d'une vidéo du relais                     */
/*                                                                     */
/*  Le maître, les listes, les segments et le MP4 d'une vidéo résolue  */
/*  (`trailerRelay.ts`), avec la reprise d'une lecture dont l'URL amont */
/*  est morte : UNE nouvelle extraction — jamais pour un aperçu. Sorti */
/*  de `trailerRelay.ts`, qui garde la mémoire des vidéos ; exporté    */
/*  par lui, les appelants n'ont pas changé.                           */
/* ------------------------------------------------------------------ */

import { OPUS_KEY } from "./hlsPlaylists";
import { opusSegment, type OpusSegment } from "./open/openAudio";
import { fixedMaster } from "./relayEntry";
import type { RelayScope } from "./relayToken";
import { loadMaster, loadMedia, resolveEntry } from "./trailerRelay";

/**
 * Les essais d'une lecture amont pour un jeton de cette portée : une lecture
 * (`/resolve`) en a deux — le second après une nouvelle extraction, si
 * googlevideo refuse l'URL ; un aperçu, un seul, sur la vidéo que le relais
 * tient (`relayToken.ts`) : l'oubliée se redemande à `/preview`, gardé.
 */
export function relayAttempts(scope: RelayScope): Array<{ fresh: boolean; heldOnly: boolean }> {
  return scope === "preview" ? [{ fresh: false, heldOnly: true }] : [{ fresh: false, heldOnly: false }, { fresh: true, heldOnly: false }];
}

/**
 * Le maître relayé (gabarit à jeton), avec une reprise si l'URL amont est
 * morte. Avec `height`, le maître réduit à cette qualité.
 */
export async function masterTemplate(ref: string, height?: number, scope: RelayScope = "play"): Promise<string | null> {
  for (const attempt of relayAttempts(scope)) {
    const entry = await resolveEntry(ref, attempt);
    if (!entry) return null;
    const master = await loadMaster(entry);
    if (master) return height ? fixedMaster(entry, master, height) : entry.masterText ?? null;
    if (entry.source.kind !== "hls") return null;
  }
  return null;
}

/** Une liste de segments relayée (gabarit à jeton), avec une reprise si l'URL amont est morte. */
export async function mediaTemplate(ref: string, key: string, scope: RelayScope = "play"): Promise<string | null> {
  for (const attempt of relayAttempts(scope)) {
    const entry = await resolveEntry(ref, attempt);
    if (!entry) return null;
    const media = await loadMedia(entry, key);
    if (media) return media.text;
  }
  return null;
}

/** L'URL amont d'un segment (`index` ou `"init"`) et les en-têtes qui vont avec. */
export async function segmentTarget(ref: string, key: string, index: number | "init", attempt: { fresh?: boolean; heldOnly?: boolean } = {}) {
  const entry = await resolveEntry(ref, attempt);
  if (!entry) return null;
  const media = await loadMedia(entry, key);
  const url = index === "init" ? media?.init : media?.segments[index];
  return url ? { url, headers: entry.source.headers } : null;
}

/**
 * Un segment de la piste Opus d'une entrée libre (`index` ou `"init"`), lu chez
 * googlevideo et réemballé (`open/openAudio.ts`). `refused` : l'URL ne se sert
 * plus — une lecture retente après une nouvelle extraction, comme un segment
 * vidéo ; `null` : rien à servir.
 */
export async function opusSegmentOf(
  ref: string, index: number | "init", attempt: { fresh?: boolean; heldOnly?: boolean } = {}, signal?: AbortSignal,
): Promise<OpusSegment | { refused: true } | null> {
  const entry = await resolveEntry(ref, attempt);
  if (!entry?.open || !(await loadMedia(entry, OPUS_KEY)) || !entry.opus) return null;
  return opusSegment(entry.opus, index, signal);
}

/** L'URL amont du MP4 progressif (repli des vidéos sans HLS). */
export async function progressiveTarget(ref: string, attempt: { fresh?: boolean; heldOnly?: boolean } = {}) {
  const entry = await resolveEntry(ref, attempt);
  return entry?.source.kind === "progressive" ? { url: entry.source.url, headers: entry.source.headers } : null;
}
