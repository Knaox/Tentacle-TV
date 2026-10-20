/**
 * Les règles PURES de la préparation tenue par le serveur : la clé d'une
 * demande, la plage d'octets qu'on peut honorer, et quand une préparation
 * oubliée s'efface. Horloge injectée, rien d'autre.
 */

import { createHash } from "node:crypto";
import type { LightRequest } from "./lightStream";
import type { PrepareState } from "./prepareJob";

/**
 * Une préparation prête attend le téléphone UNE JOURNÉE après son dernier
 * passage : il peut avoir dormi toute la nuit, verrouillé, sans réseau.
 */
export const PREPARED_IDLE_TTL_MS = 24 * 60 * 60 * 1000;
/**
 * Une préparation qui tourne sans que personne ne la réclame plus depuis
 * douze heures est abandonnée : le téléphone a été effacé, le compte retiré.
 */
export const RUNNING_IDLE_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * La clé d'une demande : même compte, même titre, même palier, mêmes pistes =
 * la même préparation. Deux appareils du compte la partagent, et une demande
 * répétée (reprise, relance, retour dans l'app) ne la refait jamais.
 */
export function prepareKey(userId: string, request: LightRequest): string {
  const parts = [
    userId,
    request.itemId.toLowerCase(),
    request.mediaSourceId?.toLowerCase() ?? "",
    request.presetId,
    request.audioStreamIndex ?? "",
    request.burnSubtitleIndex ?? "",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

/** `Range: bytes=N-` → N ; toute autre forme est ignorée (lecture depuis le début). */
export function rangeStart(header: string | undefined): number | null {
  if (typeof header !== "string") return null;
  const match = /^bytes=(\d+)-$/.exec(header.trim());
  if (match === null) return null;
  const start = Number(match[1]);
  return Number.isSafeInteger(start) ? start : null;
}

/** L'étiquette d'appareil qu'un client joint à ses demandes (`?tag=`) : 8 à 64 caractères simples. */
export function readerTag(raw: string | undefined): string | null {
  return typeof raw === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(raw) ? raw : null;
}

/**
 * D'où servir. Une reprise n'est honorée que par une préparation que CET
 * appareil a déjà lue (son étiquette, `readerTag`) : une préparation recréée —
 * serveur redémarré, effacée entre-temps, relancée par un autre appareil —
 * n'écrit pas forcément les mêmes octets, et coller sa suite au morceau que le
 * téléphone garde donnerait un fichier corrompu. Là, tout repart de zéro (200),
 * et les deux plateformes jettent alors leur morceau.
 */
export function servedFrom(
  start: number | null,
  job: { state: PrepareState; bytes: number },
  readByThisDevice: boolean,
): number {
  if (start === null || start <= 0 || !readByThisDevice) return 0;
  // On ne sert pas une plage que la préparation n'a pas encore écrite : le
  // téléphone en a plus que nous, donc un morceau d'une AUTRE préparation.
  return start <= job.bytes ? start : 0;
}

/** La préparation est-elle à effacer maintenant ? */
export function prepareExpired(
  job: { state: PrepareState; readers: number; released: boolean; lastAccessAt: number },
  nowMs: number,
): boolean {
  if (job.readers > 0) return false;
  if (job.released || job.state === "failed") return true;
  const idle = nowMs - job.lastAccessAt;
  return job.state === "done" ? idle >= PREPARED_IDLE_TTL_MS : idle >= RUNNING_IDLE_TTL_MS;
}
