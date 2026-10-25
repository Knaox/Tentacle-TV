/**
 * L'Allégé AUDIO de `/api/downloads/light/:itemId?preset=a256` (musique gardée
 * hors ligne, capacité `offline.music`) : la même garde et le même plafond de
 * débit que l'Allégé vidéo (`downloads.ts`), la requête de Jellyfin en moins
 * (`offlinePrepare/audioLight.ts`). Refus : 404 générique, comme partout.
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { getJellyfinUrl } from "../services/configStore";
import { throttled } from "../services/downloadBandwidth/throttledStream";
import { checkAudioLightRight, mediaBrowserAuthHeader } from "../services/jellyfinPolicy";
import { audioStreamPath, type AudioLightRequest } from "../services/offlinePrepare/audioLight";

export async function serveAudioLight(request: FastifyRequest, reply: FastifyReply, token: string, audio: AudioLightRequest) {
  const notFound = () => reply.status(404).send({ error: "Not found" });
  if (!(await checkAudioLightRight(token, audio.itemId))) return notFound();
  const jellyfinUrl = getJellyfinUrl();
  if (!jellyfinUrl) return notFound();

  // Une session à nous, rendue dans les en-têtes : le moteur l'arrête à toute fin de transfert.
  const playSessionId = randomUUID();
  const deviceId = `tentacle-dl-${playSessionId.slice(0, 8)}`;
  let upstream: Response;
  try {
    upstream = await fetch(`${jellyfinUrl}${audioStreamPath(audio, { playSessionId, deviceId })}`, {
      headers: { Authorization: mediaBrowserAuthHeader(token) },
    });
  } catch {
    return notFound();
  }
  if (upstream.status !== 200 || !upstream.body) return notFound();

  reply.status(200);
  reply.header("x-accel-buffering", "no");
  reply.header("content-type", upstream.headers.get("content-type") ?? "audio/mp4");
  reply.header("x-tentacle-play-session", playSessionId);
  reply.header("x-tentacle-device-id", deviceId);
  return reply.send(throttled(request, Readable.fromWeb(upstream.body as unknown as import("node:stream/web").ReadableStream)));
}
