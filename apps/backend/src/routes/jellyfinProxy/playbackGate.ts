/**
 * La porte de la LECTURE dans le proxy (docs/DROITS-UTILISATEURS.md § 7 et § 9.2).
 *
 * Un flux, ou un `PlaybackInfo`, ne part que si :
 *
 * 1. le compte voit le titre (`streamAccess.ts` : 404 sinon) ;
 * 2. la politique Jellyfin du compte permet la LECTURE — Jellyfin ne la garde
 *    nulle part (`EnableMediaPlayback` ne change que `PlayAccess`) : 403
 *    `playback_not_allowed` ;
 * 3. ce que le flux fait faire au serveur (`streamConversions`) est permis —
 *    réencoder l'image, convertir le son, changer de conteneur : 403
 *    `conversion_not_allowed`. Jellyfin, lui, copie de force pour un jeton de
 *    compte (flux illisible) et ne juge rien derrière une clé d'API ;
 * 4. le plafond des clients DISTANTS (adresse RÉELLE) borne `PlaybackInfo` et
 *    les paramètres d'un flux converti — Jellyfin ne voit que Tentacle, local.
 *
 * Ce qui reste permis sans le droit de le réencoder part en COPIE forcée
 * (`VideoCodec=copy`, `AudioCodec=copy`), la règle de Jellyfin pour un jeton
 * de compte : rien n'est réencodé, même là où la règle penche vers la copie
 * sans pouvoir l'affirmer (profil, niveau, plage).
 *
 * Le fichier tel quel (`Static=true`) n'est pas plafonné — Jellyfin non plus :
 * les lecteurs lisent leur plafond (`/api/playback/rights`) et choisissent un
 * palier dessous.
 */

import { validateToken } from "../../middleware/auth";
import { playbackRefusal, queryParam, streamConversions, type PlaybackRefusal } from "../../playback/playbackRights";
import { isUnrestricted, playbackRightsFor } from "../../services/playbackRights";
import { itemRefused, streamItemId } from "./streamAccess";
import { streamSourceFacts } from "./streamSource";

export type PlaybackGate = { kind: "pass"; query?: string } | { kind: "hidden" } | { kind: "refused"; code: PlaybackRefusal };

const PLAYBACK_INFO = /^Items\/([^/]+)\/PlaybackInfo$/i;

/** Plancher d'une image plafonnée : sous 64 kb/s, Jellyfin ne sort rien de regardable. */
const MIN_VIDEO_BITRATE = 64_000;

interface GateInput {
  path: string;
  /** La query du client (`?…` ou vide). */
  query: string;
  token: string | undefined;
  /** Le compte déjà établi (appareil, « voir en tant que »). */
  lentKeyUser: string | null;
  clientIp: string;
}

function setParam(params: URLSearchParams, name: string, value: string): void {
  for (const key of [...params.keys()]) if (key.toLowerCase() === name.toLowerCase()) params.delete(key);
  params.set(name, value);
}

/** Le plafond posé sur les paramètres d'un flux converti (débit total, son compris). */
export function clampBitrateParams(params: URLSearchParams, limit: number): void {
  const read = (name: string) => {
    const value = Number(queryParam(Object.fromEntries(params), name));
    return Number.isFinite(value) && value > 0 ? value : null;
  };
  setParam(params, "MaxStreamingBitrate", String(Math.min(read("MaxStreamingBitrate") ?? limit, limit)));
  const audio = read("AudioBitrate") ?? 0;
  const videoBudget = Math.max(limit - audio, MIN_VIDEO_BITRATE);
  setParam(params, "VideoBitrate", String(Math.min(read("VideoBitrate") ?? videoBudget, videoBudget)));
}

async function accountOf(token: string | undefined, lentKeyUser: string | null): Promise<string | null> {
  if (lentKeyUser) return lentKeyUser;
  if (!token) return null;
  const validation = await validateToken(token);
  return validation.ok ? validation.user.userId : null;
}

export async function gatePlayback(input: GateInput): Promise<PlaybackGate> {
  const streamItem = streamItemId(input.path);
  const itemId = streamItem ?? PLAYBACK_INFO.exec(input.path)?.[1] ?? null;
  if (!itemId) return { kind: "pass" };
  const userId = await accountOf(input.token, input.lentKeyUser);
  if (!userId) return { kind: "pass" };
  if (streamItem && (await itemRefused(streamItem, input.token, userId))) return { kind: "hidden" };

  const rights = await playbackRightsFor(userId, input.clientIp);
  if (isUnrestricted(rights)) return { kind: "pass" };
  if (!rights.mediaPlayback) return { kind: "refused", code: "playback_not_allowed" };

  const params = new URLSearchParams(input.query.startsWith("?") ? input.query.slice(1) : input.query);
  const reserialized = () => ({ kind: "pass" as const, query: `?${params.toString()}` });
  if (!streamItem) {
    if (rights.maxBitrate === null) return { kind: "pass" };
    setParam(params, "MaxStreamingBitrate", String(Math.min(Number(queryParam(Object.fromEntries(params), "MaxStreamingBitrate")) || rights.maxBitrate, rights.maxBitrate)));
    return reserialized();
  }

  const asIs = streamConversions(input.path, Object.fromEntries(params), null);
  if (!asIs || !asIs.container) return { kind: "pass" };
  if (rights.maxBitrate !== null) clampBitrateParams(params, rights.maxBitrate);
  const allConversions = rights.videoTranscoding && rights.audioTranscoding && rights.remuxing;
  const source = allConversions ? null : await streamSourceFacts(itemId, queryParam(Object.fromEntries(params), "MediaSourceId"), userId);
  const refusal = playbackRefusal(rights, streamConversions(input.path, Object.fromEntries(params), source));
  if (refusal) return { kind: "refused", code: refusal };
  if (!rights.videoTranscoding && !/^Audio\//i.test(input.path)) setParam(params, "VideoCodec", "copy");
  if (!rights.audioTranscoding) setParam(params, "AudioCodec", "copy");
  return reserialized();
}
