/**
 * Les FENÊTRES d'audio d'un épisode, et comment on va les chercher chez
 * Jellyfin sans lui faire transcoder plus que nécessaire.
 *
 * # Deux fenêtres, pas le fichier entier
 *
 * L'opening vit dans la tête, l'ending dans la queue : on n'écoute que ça.
 * Les fenêtres excluent par construction l'eyecatch du milieu (16 s partagées
 * vers 57 % sur One Piece — mesuré) et restent proportionnées : 20 % de la
 * durée, bornées. Le plancher de la queue (6 min) couvre un ending rejoué à
 * 4,5 min de la fin, suivi d'un épilogue (Re:Zero S4E4).
 *
 * # ⚠️ Le transcodage de Jellyfin n'a pas de borne de fin
 *
 * `startTimeTicks` existe, pas de fin : ffmpeg part du point demandé et court
 * jusqu'au bout du fichier — puis survit dix secondes à la coupure du socket.
 * Pour la TÊTE, laisser faire coûterait tout l'épisode. D'où la lecture en
 * flux avec un budget d'octets (64 kbit/s = 8 000 o/s), l'arrêt net, et
 * SURTOUT le `DELETE /Videos/ActiveEncodings` juste après, qui tue le job et
 * efface son fichier temporaire (route vérifiée, 204). La queue, elle,
 * atteint la fin d'elle-même ; on la libère pareil, par hygiène.
 *
 * # Ce que l'URL doit porter, et pourquoi
 *
 *  - un `PlaySessionId` UNIQUE par fenêtre : le chemin du transcodage est un
 *    hachage de l'appareil et de la session, PAS du point de départ — mesuré :
 *    sans lui, la seconde fenêtre reçoit le fichier partiel de la première ;
 *  - `mediaSourceId` : la durée témoin est celle de `MediaSources[0]` ;
 *  - un `DeviceId` fixe : vérifié, une clé API n'ouvre ni session ni appareil.
 *
 * `static=true` est PROSCRIT ici : sur un item vidéo, il rend la vidéo entière.
 *
 * # La garde de vitesse
 *
 * Un serveur qui transcode à moins de dix fois le temps réel est un serveur à
 * genoux, ou trop loin : on n'attend pas les deux minutes du délai, on coupe,
 * et l'appelant met la fonction au repos une heure.
 */

import { randomUUID } from "crypto";
import { open, type FileHandle } from "fs/promises";

/** Part de la durée écoutée à chaque bout. */
export const WINDOW_RATIO = 0.2;
export const HEAD_WINDOW_MIN_MS = 5 * 60_000;
export const HEAD_WINDOW_MAX_MS = 10 * 60_000;
export const TAIL_WINDOW_MIN_MS = 6 * 60_000;
export const TAIL_WINDOW_MAX_MS = 10 * 60_000;

/** Le MP3 demandé : mono, 64 kbit/s — « qualité voix », assez pour chromaprint. */
export const AUDIO_BITRATE = 64_000;
export const AUDIO_BYTES_PER_SECOND = AUDIO_BITRATE / 8;
/** Marge d'en-tête et de dernière trame au-dessus du débit nominal. */
export const AUDIO_BUDGET_RATIO = 1.1;
export const AUDIO_HEADER_SLACK_BYTES = 65_536;

export const AUDIO_DEVICE_ID = "tentacle-audio-analysis";
export const AUDIO_FETCH_TIMEOUT_MS = 120_000;
export const ENCODING_RELEASE_TIMEOUT_MS = 3_000;

/** La garde de vitesse ne juge qu'après ce délai, et exige ce multiple du temps réel. */
export const SPEED_GUARD_AFTER_MS = 10_000;
export const SPEED_GUARD_MIN_RATIO = 10;

const TICKS_PER_MS = 10_000;

export interface AudioWindow {
  kind: "head" | "tail";
  startMs: number;
  lengthMs: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function headWindowMs(runtimeMs: number): number {
  return Math.min(runtimeMs, clamp(runtimeMs * WINDOW_RATIO, HEAD_WINDOW_MIN_MS, HEAD_WINDOW_MAX_MS));
}

export function tailWindowMs(runtimeMs: number): number {
  return Math.min(runtimeMs, clamp(runtimeMs * WINDOW_RATIO, TAIL_WINDOW_MIN_MS, TAIL_WINDOW_MAX_MS));
}

/** Les deux fenêtres d'un épisode, en ms de média. Durée ≤ 0 : les deux vides. */
export function analysisWindows(runtimeMs: number): { head: AudioWindow; tail: AudioWindow } {
  const runtime = Math.max(0, Math.round(runtimeMs));
  const head = headWindowMs(runtime);
  const tail = tailWindowMs(runtime);
  return {
    head: { kind: "head", startMs: 0, lengthMs: Math.round(head) },
    tail: { kind: "tail", startMs: Math.round(runtime - tail), lengthMs: Math.round(tail) },
  };
}

/** Les octets au-delà desquels on a tout ce qu'on voulait entendre. */
export function windowByteBudget(lengthMs: number): number {
  return Math.ceil((lengthMs / 1000) * AUDIO_BYTES_PER_SECOND * AUDIO_BUDGET_RATIO) + AUDIO_HEADER_SLACK_BYTES;
}

export function audioStreamUrl(
  jellyfinUrl: string,
  itemId: string,
  mediaSourceId: string | null,
  startMs: number,
  playSessionId: string,
): string {
  const source = mediaSourceId ? `&mediaSourceId=${encodeURIComponent(mediaSourceId)}` : "";
  return (
    `${jellyfinUrl}/Audio/${itemId}/stream.mp3?audioCodec=mp3&audioBitRate=${String(AUDIO_BITRATE)}` +
    `&audioChannels=1&startTimeTicks=${String(Math.round(startMs) * TICKS_PER_MS)}${source}` +
    `&DeviceId=${AUDIO_DEVICE_ID}&PlaySessionId=${playSessionId}`
  );
}

export function activeEncodingUrl(jellyfinUrl: string, playSessionId: string): string {
  return `${jellyfinUrl}/Videos/ActiveEncodings?deviceId=${AUDIO_DEVICE_ID}&playSessionId=${playSessionId}`;
}

export type WindowFetchFailure = "not-supported" | "transient" | "too-slow";

export type WindowFetchResult =
  | { ok: true; bytes: number; elapsedMs: number; complete: boolean }
  | { ok: false; failure: WindowFetchFailure; status?: number };

export interface WindowFetchRequest {
  jellyfinUrl: string;
  apiKey: string;
  itemId: string;
  mediaSourceId: string | null;
  window: AudioWindow;
  filePath: string;
  /** L'horloge, injectable pour les tests de la garde de vitesse. */
  clock?: () => number;
}

/**
 * Télécharge une fenêtre dans `filePath`, coupe au budget, libère l'encodage.
 * Le fichier peut rester partiel en cas d'échec : à l'appelant de le jeter.
 */
export async function fetchAudioWindowToFile(request: WindowFetchRequest): Promise<WindowFetchResult> {
  const now = request.clock ?? Date.now;
  const playSessionId = randomUUID();
  const url = audioStreamUrl(
    request.jellyfinUrl, request.itemId, request.mediaSourceId, request.window.startMs, playSessionId,
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUDIO_FETCH_TIMEOUT_MS);
  const budget = windowByteBudget(request.window.lengthMs);
  const startedAt = now();
  let file: FileHandle | null = null;
  let bytes = 0;
  let complete = true;

  try {
    let res: Response;
    try {
      res = await fetch(url, { headers: { "X-Emby-Token": request.apiKey }, signal: controller.signal });
    } catch {
      return { ok: false, failure: "transient" };
    }
    if (!res.ok || res.body === null) {
      const status = res.status;
      const unsupported = [400, 401, 403, 404, 405].includes(status);
      return { ok: false, failure: unsupported ? "not-supported" : "transient", status };
    }

    file = await open(request.filePath, "w");
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await file.write(value);
      bytes += value.byteLength;
      const elapsed = now() - startedAt;
      if (elapsed >= SPEED_GUARD_AFTER_MS && bytes < AUDIO_BYTES_PER_SECOND * SPEED_GUARD_MIN_RATIO * (elapsed / 1000)) {
        await reader.cancel().catch(() => undefined);
        controller.abort();
        return { ok: false, failure: "too-slow" };
      }
      if (bytes >= budget) {
        complete = false;
        await reader.cancel().catch(() => undefined);
        controller.abort();
        break;
      }
    }
    return { ok: true, bytes, elapsedMs: now() - startedAt, complete };
  } catch {
    return { ok: false, failure: "transient" };
  } finally {
    clearTimeout(timer);
    if (file !== null) await file.close().catch(() => undefined);
    await releaseEncoding(request.jellyfinUrl, request.apiKey, playSessionId);
  }
}

/** Tue le job de transcodage de cette session — sans jamais faire échouer l'appelant. */
async function releaseEncoding(jellyfinUrl: string, apiKey: string, playSessionId: string): Promise<void> {
  try {
    await fetch(activeEncodingUrl(jellyfinUrl, playSessionId), {
      method: "DELETE",
      headers: { "X-Emby-Token": apiKey },
      signal: AbortSignal.timeout(ENCODING_RELEASE_TIMEOUT_MS),
    });
  } catch {
    // Un job qu'on n'a pas pu tuer meurt seul dix secondes après la coupure.
  }
}
