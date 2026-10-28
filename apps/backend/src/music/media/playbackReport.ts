/**
 * Octave — l'écoute d'un titre, rapportée à Jellyfin AU NOM DE L'APPAREIL qui
 * écoute (son jeton Jellyfin, la règle du canal de session :
 * `deviceSessions/tokenResolver.ts`) : la session apparaît dans le tableau de
 * bord de Jellyfin, et Jellyfin compte lui-même l'écoute (PlayCount, date) à
 * l'arrêt — c'est ce que lisent « Récemment écoutés » et « Souvent écoutés ».
 *
 * Sans jeton Jellyfin (« voir en tant que », TV sans Quick Connect) : rien
 * n'est rapporté en cours de route ; une écoute MENÉE AU BOUT est marquée lue
 * pour le compte (clé + `userId`), une seule fois.
 */

import type { FastifyRequest } from "fastify";
import { getTokenFromRequest } from "../../middleware/auth";
import { jellyfinCaller } from "../../services/deviceSessions/jellyfinCalls";
import { resolveDeviceAuth } from "../../services/deviceSessions/tokenResolver";
import type { MusicPlaybackEvent, MusicPlaybackReport } from "../contract/musicCoreApi";
import { jfWrite, q } from "../jellyfin/musicJellyfin";

const EVENTS: readonly MusicPlaybackEvent[] = ["start", "progress", "pause", "stop"];

/** Le corps reçu, validé ; `null` s'il est mal formé. */
export function parsePlaybackReport(body: unknown): MusicPlaybackReport | null {
  const b = (body ?? {}) as Partial<Record<keyof MusicPlaybackReport, unknown>>;
  if (typeof b.itemId !== "string" || !/^[0-9a-fA-F-]{32,36}$/.test(b.itemId)) return null;
  if (typeof b.positionMs !== "number" || !Number.isFinite(b.positionMs) || b.positionMs < 0) return null;
  if (typeof b.event !== "string" || !EVENTS.includes(b.event as MusicPlaybackEvent)) return null;
  return {
    itemId: b.itemId,
    positionMs: Math.floor(b.positionMs),
    event: b.event as MusicPlaybackEvent,
    ...(b.completed === true ? { completed: true } : {}),
  };
}

function bodyOf(report: MusicPlaybackReport): Record<string, unknown> {
  const base = { ItemId: report.itemId, MediaSourceId: report.itemId, PositionTicks: report.positionMs * 10_000, PlayMethod: "DirectPlay", CanSeek: true };
  if (report.event === "start") return { ...base, IsPaused: false };
  if (report.event === "stop") return base;
  return { ...base, IsPaused: report.event === "pause", EventName: report.event === "pause" ? "Pause" : "TimeUpdate" };
}

const PATHS: Record<MusicPlaybackEvent, string> = {
  start: "/Sessions/Playing",
  progress: "/Sessions/Playing/Progress",
  pause: "/Sessions/Playing/Progress",
  stop: "/Sessions/Playing/Stopped",
};

export async function reportPlayback(request: FastifyRequest, userId: string, report: MusicPlaybackReport): Promise<{ ok: boolean; via: "device" | "account" | "none" }> {
  // Le jeton a DÉJÀ passé `requireAuth` (preHandler de `musicRoutes`), et le titre `playableRow` : la condition
  // ne fait que choisir AU NOM DE QUI rapporter — l'appareil (son jeton Jellyfin) ou le compte de la session.
  const token = getTokenFromRequest(request);
  const auth = token ? await resolveDeviceAuth(token).catch(() => null) : null;
  if (auth) return { ok: await jellyfinCaller(auth).post(PATHS[report.event], bodyOf(report)), via: "device" };
  if (report.event === "stop" && report.completed) {
    const marked = await jfWrite(`/UserPlayedItems/${q(report.itemId)}?userId=${q(userId)}`, "POST");
    return { ok: marked.ok, via: "account" };
  }
  return { ok: true, via: "none" };
}
