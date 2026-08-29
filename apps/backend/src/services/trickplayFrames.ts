/**
 * Les vignettes de la barre de progression, lues et MESURÉES.
 *
 * Ce service ne décide rien : il rapporte, pour chaque vignette du dernier tiers
 * du média, la part de noir et la saturation. C'est `creditsFromFrames.ts` (la
 * paire miroir) qui en tire un générique et une scène.
 *
 * # Pourquoi les vignettes, et pas la vidéo
 *
 * Le travail coûteux — décoder le film — a DÉJÀ été payé une fois pour toutes
 * par la tâche « Générer des images Trickplay » de Jellyfin. On relit des JPEG
 * qui sont sur son disque : aucun transcodage, aucun accès aux fichiers médias.
 * Mesuré sur « Spider-Man : No Way Home » (148 min) : trois planches, 2,45 Mo,
 * 31 ms de réseau et 430 ms de décodage — une fois par média.
 *
 * # Le dernier tiers, et pourquoi 60 %
 *
 * Un générique de fin ne commence jamais avant la moitié d'un média ; 60 %
 * laisse de la marge sans multiplier les planches. Ce qui précède n'est pas lu :
 * l'intro et le résumé sont déjà bien vus par les greffons, et les chercher ici
 * coûterait tout le film.
 *
 * ⚠️ Le backend NE DÉPEND PAS de `@tentacle-tv/shared` (tsc CommonJS, image
 * Docker sans packages/) : les quelques lignes de calcul tuile ↔ temps sont
 * recopiées ici plutôt qu'importées de `utils/trickplay.ts`.
 */

import { decode } from "jpeg-js";
import type { FrameSample } from "../playback/creditsFromFrames";

/** Ce que Jellyfin publie par (source, largeur) dans le champ `Trickplay`. */
export interface TrickplayInfo {
  Width: number;
  Height: number;
  TileWidth: number;
  TileHeight: number;
  ThumbnailCount: number;
  /** Millisecondes entre deux vignettes. */
  Interval: number;
}

/** `{ [mediaSourceId]: { [largeur]: TrickplayInfo } }` */
export type TrickplayManifest = Record<string, Record<string, TrickplayInfo> | undefined>;

/** La part du média à partir de laquelle on regarde. */
const FROM_RATIO = 0.6;
/** Au-delà, on s'arrête et on le DIT — jamais une troncature silencieuse. */
const MAX_TILES = 12;
/** Un pixel plus sombre que ça compte pour noir. */
const DARK_LEVEL = 24;
/** Un pixel sur quatre suffit : la mesure est globale, pas fine. */
const PIXEL_STEP = 2;
const FETCH_TIMEOUT_MS = 20_000;

/** La largeur la plus proche de 320, sur la source demandée à défaut la première. */
export function pickTrickplay(
  manifest: TrickplayManifest | null | undefined,
  mediaSourceId?: string,
): { width: number; info: TrickplayInfo } | null {
  if (!manifest) return null;
  const sourceIds = Object.keys(manifest);
  if (sourceIds.length === 0) return null;
  const sourceId = mediaSourceId && manifest[mediaSourceId] ? mediaSourceId : sourceIds[0];
  const widths = manifest[sourceId];
  if (!widths) return null;

  let best: { width: number; info: TrickplayInfo } | null = null;
  for (const [key, info] of Object.entries(widths)) {
    const width = Number(key);
    if (!Number.isFinite(width) || width <= 0) continue;
    if (!info || info.TileWidth <= 0 || info.TileHeight <= 0 || info.Interval <= 0) continue;
    if (best === null || Math.abs(width - 320) < Math.abs(best.width - 320)) {
      best = { width, info };
    }
  }
  return best;
}

/**
 * Les planches à lire pour couvrir la fin du média.
 *
 * `last` est INCLUSIF. `null` quand il n'y a rien à lire — média trop court,
 * manifeste incohérent.
 */
export function tileRange(
  info: TrickplayInfo,
  runtimeMs: number,
): { first: number; last: number; truncated: boolean } | null {
  const perTile = info.TileWidth * info.TileHeight;
  if (perTile <= 0 || info.ThumbnailCount <= 0 || runtimeMs <= 0) return null;

  const firstFrame = Math.floor((runtimeMs * FROM_RATIO) / info.Interval);
  // La dernière vignette qui existe VRAIMENT : le manifeste fait foi, et les
  // cellules au-delà sont du noir de remplissage (mesuré).
  const lastFrame = Math.min(
    info.ThumbnailCount - 1,
    Math.floor((runtimeMs - 1) / info.Interval),
  );
  if (lastFrame < firstFrame) return null;

  const first = Math.floor(firstFrame / perTile);
  const wanted = Math.floor(lastFrame / perTile);
  const last = Math.min(wanted, first + MAX_TILES - 1);
  return { first, last, truncated: last < wanted };
}

/** Mesure les cellules d'une planche décodée. */
export function sampleTile(
  pixels: Uint8Array | Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  info: TrickplayInfo,
  tileIndex: number,
  lastFrame: number,
): FrameSample[] {
  const perTile = info.TileWidth * info.TileHeight;
  const out: FrameSample[] = [];

  for (let cell = 0; cell < perTile; cell++) {
    const frame = tileIndex * perTile + cell;
    if (frame > lastFrame) break;
    const originX = (cell % info.TileWidth) * info.Width;
    const originY = Math.floor(cell / info.TileWidth) * info.Height;
    // Une planche incomplète (dernière du média) : la cellule n'existe pas.
    if (originX + info.Width > imageWidth || originY + info.Height > imageHeight) break;

    let dark = 0;
    let saturation = 0;
    let counted = 0;
    for (let y = originY; y < originY + info.Height; y += PIXEL_STEP) {
      for (let x = originX; x < originX + info.Width; x += PIXEL_STEP) {
        const i = (y * imageWidth + x) * 4;
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        // Luminance perçue — la même pondération que partout ailleurs.
        if (0.2126 * r + 0.7152 * g + 0.0722 * b < DARK_LEVEL) dark += 1;
        saturation += Math.max(r, g, b) - Math.min(r, g, b);
        counted += 1;
      }
    }
    if (counted === 0) continue;
    out.push({
      ms: frame * info.Interval,
      dark: dark / counted,
      saturation: saturation / counted,
    });
  }
  return out;
}

async function fetchTile(url: string, apiKey: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "X-Emby-Token": apiKey },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export interface FrameCollectRequest {
  itemId: string;
  manifest: TrickplayManifest | null | undefined;
  mediaSourceId?: string;
  runtimeMs: number;
  jellyfinUrl: string;
  apiKey: string;
}

/**
 * Les mesures du dernier tiers, ou une liste VIDE quand on n'a rien pu lire.
 *
 * Vide et non `null` : l'appelant n'a pas à distinguer « pas de trickplay » de
 * « planche illisible » — dans les deux cas il n'y a rien à conclure, et le
 * résolveur s'en tient à ce que disent les greffons.
 */
export async function collectFrameSamples(request: FrameCollectRequest): Promise<FrameSample[]> {
  const picked = pickTrickplay(request.manifest, request.mediaSourceId);
  if (!picked) return [];
  const range = tileRange(picked.info, request.runtimeMs);
  if (!range) return [];
  if (range.truncated) {
    console.info(
      `[segments] ${request.itemId} : analyse bornée à ${String(MAX_TILES)} planches` +
        ` — la fin du média n'est pas entièrement lue`,
    );
  }

  const lastFrame = Math.min(
    picked.info.ThumbnailCount - 1,
    Math.floor((request.runtimeMs - 1) / picked.info.Interval),
  );
  const base = `${request.jellyfinUrl}/Videos/${request.itemId}/Trickplay/${String(picked.width)}`;
  const samples: FrameSample[] = [];

  for (let tile = range.first; tile <= range.last; tile++) {
    // En série, à dessein : trois planches lues d'un coup n'iraient pas plus
    // vite (le décodage est le poste coûteux) et taperaient le serveur en rafale.
    const raw = await fetchTile(`${base}/${String(tile)}.jpg`, request.apiKey);
    if (raw === null) {
      console.warn(`[segments] ${request.itemId} : planche ${String(tile)} illisible`);
      continue;
    }
    try {
      const image = decode(raw, { useTArray: true });
      samples.push(
        ...sampleTile(image.data, image.width, image.height, picked.info, tile, lastFrame),
      );
    } catch {
      console.warn(`[segments] ${request.itemId} : planche ${String(tile)} indécodable`);
    }
    // Une planche de 3200 × 1800 pixels décodée pèse ~23 Mo. Elle est relâchée
    // à chaque tour : `samples` ne retient que deux nombres par vignette.
  }
  return samples;
}
