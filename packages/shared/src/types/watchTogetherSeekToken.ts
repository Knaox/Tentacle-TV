/**
 * Watch Together — le JETON d'un seek (`appareil:numéro`), pour les sauts
 * rapides (« +30 s » martelé, défaut B7 du 20/10).
 *
 * Chaque appareil numérote ses seeks ; le serveur renvoie dans l'état le jeton
 * du seek qui a posé la position de la salle. Un émetteur qui a DÉJÀ demandé
 * plus loin reconnaît l'écho d'un de ses seeks plus anciens et ne s'y recale
 * pas (sans cela, chaque écho le ramenait en arrière et les appuis suivants
 * repartaient de là : huit « +30 s » ne faisaient qu'une minute). Le serveur,
 * lui, ignore un seek plus ancien que celui de la salle venu du même appareil.
 *
 * Recopié tel quel dans le backend
 * (`apps/backend/src/services/watchTogether/watchTogetherSeekToken.ts`) —
 * aucun import, `cp` suffit ; `protocolMirror.test.ts` tient les deux copies.
 */

export interface WtSeekToken {
  /** L'appareil (un tirage au chargement de l'app : un onglet = un appareil). */
  device: string;
  /** Croissant par appareil. */
  seq: number;
}

const SEEK_TOKEN = /^([a-z0-9]{1,16}):(\d{1,9})$/;

export function formatWtSeekToken(token: WtSeekToken): string {
  return `${token.device}:${token.seq}`;
}

/** Un jeton lisible, ou null (absent, mal formé : client d'avant, entrée hostile). */
export function parseWtSeekToken(value: unknown): WtSeekToken | null {
  if (typeof value !== "string") return null;
  const match = SEEK_TOKEN.exec(value);
  return match ? { device: match[1], seq: Number(match[2]) } : null;
}

/** `candidate` est-il un seek plus ANCIEN (ou le même) que `latest`, du même appareil ? */
export function isStaleWtSeekToken(candidate: unknown, latest: unknown): boolean {
  const a = parseWtSeekToken(candidate);
  const b = parseWtSeekToken(latest);
  return !!a && !!b && a.device === b.device && a.seq <= b.seq;
}
