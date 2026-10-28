/**
 * Octave — les pochettes, relayées depuis Jellyfin et GARDÉES sur le disque du
 * serveur (`<données>/cache/music-artwork/`), par élément, étiquette d'image et
 * taille : une pochette changée a une autre étiquette, donc un autre fichier.
 * Tailles fixes (64 → 1024) : une grille et une barre de lecture ne font pas
 * fabriquer à Jellyfin une image par pixel demandé.
 *
 * Le dossier est borné (4 000 fichiers ; au-delà, les plus anciens partent,
 * une fois par heure au plus). Rien n'y est indispensable : effacé, il se
 * refait à la demande.
 */

import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { DATA_ROOT } from "../../services/dataDir";
import { jfRaw, q } from "../jellyfin/musicJellyfin";

export const ARTWORK_SIZES = [64, 128, 256, 512, 1024] as const;
const DIR = resolve(DATA_ROOT, "cache", "music-artwork");
const MAX_FILES = 4000;
const PRUNE_EVERY_MS = 60 * 60_000;
let lastPrune = 0;

export function artworkSize(value: unknown): number {
  const n = typeof value === "string" ? parseInt(value, 10) : NaN;
  if (!Number.isFinite(n)) return 512;
  return ARTWORK_SIZES.find((s) => s >= n) ?? 1024;
}

/** Un identifiant Jellyfin NORMALISÉ (`normalizeId`) : le seul qui nomme un fichier du cache. */
const CACHE_ID = /^[0-9a-f]{32}$/;

/**
 * Le fichier d'une pochette, toujours DANS le dossier du cache ; `null` (servie sans cache) si l'identifiant
 * ou l'étiquette ne peuvent pas nommer un fichier — la route les a déjà filtrés, la garde reste ici.
 */
function fileOf(id: string, tag: string, size: number): string | null {
  const safeTag = tag.replace(/[^A-Za-z0-9]/g, "").slice(0, 64);
  if (!CACHE_ID.test(id) || !safeTag || !ARTWORK_SIZES.includes(size as (typeof ARTWORK_SIZES)[number])) return null;
  const file = resolve(DIR, `${id}-${safeTag}-${size}.jpg`);
  return dirname(file) === DIR ? file : null;
}

async function prune(): Promise<void> {
  if (Date.now() - lastPrune < PRUNE_EVERY_MS) return;
  lastPrune = Date.now();
  const names = await readdir(DIR).catch(() => [] as string[]);
  if (names.length <= MAX_FILES) return;
  const dated = await Promise.all(
    names.map(async (name) => ({ name, at: (await stat(join(DIR, name)).catch(() => null))?.mtimeMs ?? 0 })),
  );
  dated.sort((a, b) => a.at - b.at);
  for (const { name } of dated.slice(0, names.length - MAX_FILES + MAX_FILES / 10)) await unlink(join(DIR, name)).catch(() => undefined);
}

export interface Artwork {
  bytes: Buffer;
  contentType: string;
  /** Vrai : servi sous une étiquette, il ne changera jamais à cette URL. */
  immutable: boolean;
}

/** La pochette de l'élément `id` ; `null` s'il n'en a pas (ou Jellyfin muet). */
export async function artworkFor(id: string, tag: string | null, size: number): Promise<Artwork | null> {
  const file = tag ? fileOf(id, tag, size) : null;
  if (file) {
    const cached = await readFile(file).catch(() => null);
    if (cached) return { bytes: cached, contentType: "image/jpeg", immutable: true };
  }
  const res = await jfRaw(`/Items/${q(id)}/Images/Primary?maxWidth=${size}&maxHeight=${size}&quality=88&format=Jpg${tag ? `&tag=${q(tag)}` : ""}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res || !res.ok) {
    await res?.body?.cancel().catch(() => undefined);
    return null;
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  if (file && contentType.startsWith("image/")) {
    await mkdir(DIR, { recursive: true }).catch(() => undefined);
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, bytes)
      .then(() => rename(tmp, file))
      .catch(() => unlink(tmp).catch(() => undefined));
    void prune();
  }
  return { bytes, contentType, immutable: file !== null };
}
