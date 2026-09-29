import type { JellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { invoke, supportsMediaWarm } from "../desktop/bridge";
import { directPlayUrl } from "./directPlayUrl";

/**
 * Le disque du serveur, réchauffé pendant qu'on regarde la fiche.
 *
 * Un titre que le serveur n'a jamais lu s'ouvrait en 300 ms à 1 s : Jellyfin
 * va chercher sur son disque la tête du fichier, puis l'index en FIN de MKV
 * (mesuré le 29.09.2026 ; une fois lus, 35-80 ms). La tête et la fin du fichier
 * que « Lire » jouerait sont donc demandées d'avance — la coquille les lit et
 * les jette (`apps/desktop-electron/src/main/ipc/mediaWarm.ts`), le serveur
 * les garde en cache pour mpv.
 *
 * Bureau seulement : c'est là que mpv lit le fichier tel quel, et que la
 * requête part sans CORS. Trois Mio par titre, une fois par dix minutes au plus.
 */

/** La tête : en-têtes, pistes, et le début du premier bloc. */
const HEAD_BYTES = 2 * 1024 * 1024;
/** La fin : l'index (Cues) et les Tags d'un MKV, le `moov` d'un MP4 mal rangé. */
const TAIL_BYTES = 1024 * 1024;
/** Un même titre n'est redemandé qu'après ce délai — la coquille le garde aussi. */
const REPLAY_AFTER_MS = 10 * 60_000;

const warmedAt = new Map<string, number>();

/** Pure : les plages à lire pour un fichier de `size` octets. */
export function warmupRanges(size: number | undefined): [number, number][] {
  if (size === undefined || !Number.isSafeInteger(size) || size <= 0) return [];
  if (size <= HEAD_BYTES + TAIL_BYTES) return [[0, size - 1]];
  return [[0, HEAD_BYTES - 1], [size - TAIL_BYTES, size - 1]];
}

/** La source que « Lire » ouvrirait : la version choisie, sinon la première. */
function pickSource(item: MediaItem, mediaSourceId?: string | null) {
  const sources = item.MediaSources ?? [];
  return (mediaSourceId ? sources.find((s) => s.Id === mediaSourceId) : undefined) ?? sources[0];
}

/**
 * Demande le préchargement du fichier de `item`. Sans effet hors bureau, sans
 * taille connue (une série, un résumé sans sources), ou déjà fait récemment.
 */
export function warmMediaFile(
  client: JellyfinClient,
  item: MediaItem,
  mediaSourceId?: string | null,
  now: number = Date.now(),
): void {
  if (!supportsMediaWarm()) return;
  const source = pickSource(item, mediaSourceId);
  const ranges = warmupRanges(source?.Size);
  if (!source || ranges.length === 0) return;
  const key = `${item.Id}:${source.Id}`;
  const last = warmedAt.get(key);
  if (last !== undefined && now - last < REPLAY_AFTER_MS) return;
  warmedAt.set(key, now);
  invoke("media_warm", { url: directPlayUrl(client, item.Id, source.Id), ranges }).catch(() => {
    // Un préchargement manqué ne coûte que l'attente d'avant.
  });
}
