/* ------------------------------------------------------------------ */
/*  Les premiers segments d'une bande-annonce, lus d'avance             */
/*                                                                     */
/*  La première image attend le premier segment VIDÉO et le premier    */
/*  segment AUDIO — l'audio peut traîner chez googlevideo (0,95 s      */
/*  mesurés par le bureau, contre 0,3 s pour la vidéo). L'aperçu les   */
/*  fait lire dès sa décision ; le lecteur qui les demande les reçoit  */
/*  de la mémoire, ou rejoint la lecture en cours au lieu d'en lancer  */
/*  une autre. Mémoire BORNÉE (32 Mo, cinq minutes par segment, 8 Mo   */
/*  au plus chacun) et quatre lectures d'avance à la fois au plus :    */
/*  au-delà, on n'anticipe pas — le relais lira à la demande.          */
/* ------------------------------------------------------------------ */

import { fetchUpstream, segmentTarget } from "./trailerRelay";

export interface HeldSegment {
  body: Buffer;
  contentType: string;
}

type SegmentIndex = number | "init";

const MAX_BYTES = 32 * 1024 * 1024;
const MAX_SEGMENT_BYTES = 8 * 1024 * 1024;
const TTL_MS = 5 * 60 * 1000;
const MAX_PARALLEL = 4;
const FETCH_TIMEOUT_MS = 20_000;

/** Dans l'ordre où ils ont servi : le premier est le moins récent. */
const held = new Map<string, { segment: HeldSegment; until: number }>();
let heldBytes = 0;
const reading = new Map<string, Promise<HeldSegment | null>>();

const keyOf = (ytId: string, key: string, index: SegmentIndex) => `${ytId}/${key}/${index}`;

function drop(id: string): void {
  const known = held.get(id);
  if (!known) return;
  held.delete(id);
  heldBytes -= known.segment.body.length;
}

function keep(id: string, segment: HeldSegment): void {
  drop(id);
  held.set(id, { segment, until: Date.now() + TTL_MS });
  heldBytes += segment.body.length;
  const now = Date.now();
  for (const [other, entry] of held) {
    if (heldBytes <= MAX_BYTES && entry.until > now) break;
    if (other !== id || entry.until <= now) drop(other);
  }
}

/** Lit un segment chez googlevideo, en entier — `null` s'il est refusé, trop gros ou trop lent. */
async function readSegment(ytId: string, key: string, index: SegmentIndex): Promise<HeldSegment | null> {
  const target = await segmentTarget(ytId, key, index);
  if (!target) return null;
  const { res } = await fetchUpstream(target.url, target.headers, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok || !res.body || Number(res.headers.get("content-length") ?? 0) > MAX_SEGMENT_BYTES) {
    await res.body?.cancel();
    return null;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.length;
    // Plus gros qu'annoncé, ou annoncé nulle part : on n'en garde pas tant.
    if (size > MAX_SEGMENT_BYTES) return null;
    chunks.push(chunk);
  }
  return { body: Buffer.concat(chunks), contentType: res.headers.get("content-type") ?? "video/mp2t" };
}

/**
 * Fait lire un segment d'avance, sans l'attendre : sans effet s'il est déjà
 * là ou en route, ou si quatre lectures d'avance sont déjà en cours.
 */
export function prefetchSegment(ytId: string, key: string, index: SegmentIndex): void {
  const id = keyOf(ytId, key, index);
  const known = held.get(id);
  if ((known && known.until > Date.now()) || reading.has(id) || reading.size >= MAX_PARALLEL) return;
  const task = readSegment(ytId, key, index)
    .then((segment) => {
      if (segment) keep(id, segment);
      return segment;
    })
    .catch(() => null)
    .finally(() => reading.delete(id));
  reading.set(id, task);
}

/**
 * Le segment s'il a été lu d'avance — tout de suite, ou à la fin de la
 * lecture en cours ; `null` : rien d'anticipé, le relais le lit à la demande.
 */
export function heldSegment(ytId: string, key: string, index: SegmentIndex): Promise<HeldSegment | null> | null {
  const id = keyOf(ytId, key, index);
  const known = held.get(id);
  if (known && known.until > Date.now()) {
    held.delete(id);
    held.set(id, known);
    return Promise.resolve(known.segment);
  }
  if (known) drop(id);
  return reading.get(id) ?? null;
}

/** Pour les tests : l'occupation, et repartir de rien. */
export function heldSegmentsState(): { count: number; bytes: number; reading: number } {
  return { count: held.size, bytes: heldBytes, reading: reading.size };
}

export function resetHeldSegments(): void {
  held.clear();
  heldBytes = 0;
  reading.clear();
}
