/**
 * Le réveil d'un iPhone dont un titre gardé hors ligne attend qu'une EXTENSION
 * le prépare.
 *
 * La route `offline` du contrat `music` d'une extension (Sillon) prépare un
 * titre à son rythme et répond 503 + `Retry-After` tant qu'il n'est pas prêt ; le
 * moteur du téléphone relance À L'HEURE DITE (`retryAfter.ts`, offline-core). Sur
 * un iPhone derrière, ce minuteur ne sonne jamais : le JavaScript est suspendu,
 * et une playlist gardée hors ligne s'arrêtait aux titres déjà prêts (29/10).
 *
 * La vidéo a la même chaîne, tenue par le serveur : sa préparation achevée sans
 * lecteur réveille l'iPhone par une push SILENCIEUSE (`offline:prepared`,
 * `offlinePrepare.ts`). Ici le cœur ne sait pas quand l'extension aura fini — il
 * ne connaît aucune extension —, mais il voit passer sa réponse : à l'heure
 * qu'ELLE a dite, la même push part vers les iPhone du compte, qui relancent
 * leur file (`wakeForPrepared`, déjà livré : aucune mise à jour d'application).
 * La relance répond 503 à nouveau ? Le prochain réveil se programme de même.
 *
 * Bornes : une push par compte au plus par `WAKE_MIN_GAP_MS` (iOS bride les
 * pushes de fond trop fréquentes), une seule échéance retenue par compte (la plus
 * proche), six heures au plus. En mémoire : un redémarrage du serveur n'en garde
 * rien, et l'iPhone relancera de toute façon au premier plan.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { JellyfinUser } from "../../middleware/auth";
import { readPluginMusicManifest } from "../../routes/pluginMusicMeta";
import { readPluginManifest } from "../pluginServerModule";
import { sendSilentToUser } from "../pushService";
import { PREPARED_PUSH_TYPE } from "./offlinePrepare";

/** Après l'heure dite : l'horloge du téléphone n'est pas celle du serveur. */
export const WAKE_MARGIN_MS = 10_000;
/** Une push de fond par compte et par minute au plus. */
export const WAKE_MIN_GAP_MS = 60_000;
const MAX_WAIT_MS = 6 * 60 * 60_000;
/** Au-delà, rien de neuf n'est retenu : une fuite ne fait pas grossir la table. */
const MAX_USERS = 5_000;

/** Le `Retry-After` d'un 503 en millisecondes (secondes ou date HTTP), borné ; `null` sinon. */
export function retryAfterMs(status: number, raw: string | null | undefined, nowMs: number): number | null {
  if (status !== 503 || !raw) return null;
  const value = raw.trim();
  const ms = /^\d+$/.test(value) ? Number(value) * 1_000 : Date.parse(value) - nowMs;
  if (!Number.isFinite(ms)) return null;
  return Math.min(Math.max(ms, 1_000), MAX_WAIT_MS);
}

/**
 * La requête vise-t-elle la route `offline` d'une extension ? `offlineRoute` lit
 * le contrat de l'extension (son manifeste) ; rend l'identifiant de l'extension.
 */
export function offlineRequestOf(url: string, offlineRoute: (pluginId: string) => string | null): string | null {
  const match = /^\/api\/plugins\/([A-Za-z0-9_-]{1,64})(\/[^?#]*)/.exec(url);
  if (!match) return null;
  const [, pluginId, path] = match as unknown as [string, string, string];
  const route = offlineRoute(pluginId);
  return route !== null && path.startsWith(`${route}/`) ? pluginId : null;
}

interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const NODE_TIMERS: Timers = {
  set: (fn, ms) => {
    const handle = setTimeout(fn, ms);
    handle.unref?.();
    return handle;
  },
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Les réveils programmés, par compte : la plus proche échéance, une push à la fois. */
export class WaitWakes {
  private readonly due = new Map<string, { at: number; handle: unknown }>();
  private readonly lastSent = new Map<string, number>();

  constructor(
    private readonly send: (userId: string) => void,
    private readonly now: () => number = Date.now,
    private readonly timers: Timers = NODE_TIMERS,
  ) {}

  /** Le compte attend un titre que l'extension dit prêt dans `waitMs`. */
  note(userId: string, waitMs: number): void {
    const now = this.now();
    const sentAt = this.lastSent.get(userId);
    let at = now + waitMs + WAKE_MARGIN_MS;
    if (sentAt !== undefined) at = Math.max(at, sentAt + WAKE_MIN_GAP_MS);
    const current = this.due.get(userId);
    if (current !== undefined) {
      if (current.at <= at) return;
      this.timers.clear(current.handle);
    } else if (this.due.size >= MAX_USERS) return;
    const handle = this.timers.set(() => this.fire(userId), at - now);
    this.due.set(userId, { at, handle });
  }

  pendingFor(userId: string): number | null {
    return this.due.get(userId)?.at ?? null;
  }

  private fire(userId: string): void {
    this.due.delete(userId);
    this.lastSent.set(userId, this.now());
    if (this.lastSent.size > MAX_USERS) this.lastSent.clear();
    this.send(userId);
  }
}

function manifestOfflineRoute(pluginId: string): string | null {
  const manifest = readPluginManifest(pluginId);
  return readPluginMusicManifest(manifest?.music)?.offline ?? null;
}

export const extensionWaitWakes = new WaitWakes((userId) => {
  console.log("[offline-prepare] réveil d'un iPhone : un titre d'extension devait être prêt");
  void sendSilentToUser(userId, { type: PREPARED_PUSH_TYPE, itemId: "extension" }).catch(() => undefined);
});

/** Ce que le crochet regarde d'une réponse ; exporté pour le test. */
export function noteExtensionWait(
  request: FastifyRequest,
  reply: FastifyReply,
  wakes: WaitWakes = extensionWaitWakes,
  offlineRoute: (pluginId: string) => string | null = manifestOfflineRoute,
): void {
  if (reply.statusCode !== 503 || request.method !== "GET") return;
  // Le hors ligne appartient au compte de l'appareil : une session personnelle seulement.
  const user = (request as FastifyRequest & { user?: JellyfinUser }).user;
  if (!user || user.session !== "personal") return;
  const header = reply.getHeader("retry-after");
  const wait = retryAfterMs(503, typeof header === "number" ? String(header) : typeof header === "string" ? header : null, Date.now());
  if (wait === null || offlineRequestOf(request.url, offlineRoute) === null) return;
  wakes.note(user.userId, wait);
}

/** Posé une fois, au chargement des extensions : en processus comme isolées (relais), leurs réponses passent ici. */
export function watchExtensionWaits(app: FastifyInstance): void {
  app.addHook("onResponse", async (request, reply) => {
    try {
      noteExtensionWait(request, reply);
    } catch {
      // Un réveil manqué : l'iPhone relancera au premier plan.
    }
  });
}
