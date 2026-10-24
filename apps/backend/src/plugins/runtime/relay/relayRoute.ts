import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { request as httpRequest, type IncomingMessage } from "http";
import { randomUUID } from "crypto";
import type { Readable } from "stream";
import { requireAuth, type JellyfinUser } from "../../../middleware/auth";
import { isValidPluginId } from "../../../services/pluginManager";
import { RELAY_HEADERS, type PluginRuntimeManifest } from "../pluginServerRuntime";
import { isPublicRoute } from "../runtimeManifest";
import { splitQueryAuth } from "./relayQueryAuth";
import { clientResponseHeaders, guestRequestHeaders, relayLocale, relaySessionOf } from "./relayHeaders";

/**
 * Le relais `/api/plugins/<id>/*` vers la socket de l'invité. Après
 * `requireAuth` — Famille et accès du compte compris —, sauf les routes que le
 * manifeste déclare publiques (webhooks : l'invité les authentifie lui-même).
 * Le corps et la réponse passent en FLUX dans les deux sens (`Range`
 * transmis : une lecture audio n'est jamais mise en mémoire), et un client qui
 * s'en va coupe la requête vers l'invité.
 *
 * Ses routes ne se déclarent qu'une fois : une extension activée après le
 * démarrage, ou coupée, se relaie ou cesse de l'être sans redémarrer le serveur.
 * Une extension NON isolée (Vigie, chargée dans le processus) garde ses routes
 * statiques, qui passent avant ce relais ; une route qu'elle n'a pas tombe ici
 * et reçoit le 404 ordinaire.
 */

export interface RelayTarget {
  manifest: PluginRuntimeManifest;
  /** La socket de l'invité une fois prêt, `null` s'il ne l'est pas à temps (arrêté, en relance). */
  ready: () => Promise<string | null>;
}

export interface RelayDeps {
  /** L'extension ISOLÉE activée et son invité, ou `null` (pas isolée, coupée : 404 ordinaire). */
  lookup: (pluginId: string) => RelayTarget | null;
  serverLocale: () => string;
  /** Le droit du compte sur l'extension (`accountRights.ts`) : sans lui, 403 et l'invité n'est pas contacté. */
  mayUse: (pluginId: string, user: JellyfinUser) => Promise<boolean>;
  /** La porte des routes non publiques ; `requireAuth` du cœur (remplacée dans les tests seulement). */
  authenticate?: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
  /** La poignée de l'appareil appelant pour les requêtes déléguées (`clientFetchRuntime.ts`), ou `null`. */
  clientHandle?: (pluginId: string, manifest: PluginRuntimeManifest, request: FastifyRequest) => string | null;
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
/** Une réponse qui ne coule plus (rien reçu de l'invité) au-delà : coupée. */
const IDLE_MS = 120_000;

async function relay(deps: RelayDeps, request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
  const { pluginId } = request.params as { pluginId: string };
  const found = isValidPluginId(pluginId) ? deps.lookup(pluginId) : null;
  if (!found) return reply.callNotFound();
  const prefix = `/api/plugins/${pluginId}`;
  // `?api_key=` : GET seulement, retiré avant l'invité (relayQueryAuth.ts).
  const queryAuth = splitQueryAuth(request.url.slice(prefix.length) || "/");
  if (queryAuth.present && request.method !== "GET") return reply.status(401).send({ message: "Unauthorized" });
  const target = queryAuth.target;
  const route = target.split("?")[0];

  const isPublic = isPublicRoute(found.manifest, route);
  if (!isPublic) {
    // Le jeton explicite de la requête l'emporte sur un Bearer ; le cookie est départagé par `requireAuth`.
    if (queryAuth.token) request.headers.authorization = `Bearer ${queryAuth.token}`;
    await (deps.authenticate ?? requireAuth)(request, reply);
    if (reply.sent) return reply;
    const authed = (request as FastifyRequest & { user?: JellyfinUser }).user;
    if (!authed || !(await deps.mayUse(pluginId, authed))) return reply.status(403).send({ error: "forbidden" });
  }
  const socket = await found.ready();
  if (!socket) return reply.status(503).send({ error: "plugin_unavailable" });

  const user = isPublic ? null : ((request as FastifyRequest & { user?: JellyfinUser }).user ?? null);
  const caller = user
    ? { userId: user.userId, userName: user.username, isAdmin: user.isAdmin, session: relaySessionOf(user.session) }
    : null;
  const headers = guestRequestHeaders(
    request.headers,
    caller,
    relayLocale(request.headers["accept-language"], deps.serverLocale()),
    randomUUID(),
  );
  const handle = user ? (deps.clientHandle?.(pluginId, found.manifest, request) ?? null) : null;
  if (handle) headers[RELAY_HEADERS.client] = handle;

  return new Promise<unknown>((done) => {
    const upstream = httpRequest({ socketPath: socket, method: request.method, path: target, headers });
    const abort = () => upstream.destroy();
    // Le client parti avant la fin de la réponse : la requête vers l'invité tombe avec lui.
    // (Jamais la `close` de la REQUÊTE : elle part dès que son corps est lu.)
    reply.raw.once("close", () => {
      if (!reply.raw.writableFinished) abort();
    });
    upstream.setTimeout(IDLE_MS, abort);
    upstream.once("response", (res: IncomingMessage) => {
      res.setTimeout(IDLE_MS, () => res.destroy());
      reply.status(res.statusCode ?? 502).headers(clientResponseHeaders(res.headers));
      done(reply.send(res));
    });
    upstream.once("error", () => {
      if (!reply.sent) done(reply.status(502).send({ error: "plugin_unreachable" }));
      else done(reply);
    });
    const body = request.body as Readable | undefined;
    if (body && typeof body.pipe === "function") body.pipe(upstream);
    else upstream.end();
  });
}

export async function registerPluginRelay(app: FastifyInstance, deps: RelayDeps): Promise<void> {
  await app.register(async (scope) => {
    // Le corps reste un FLUX : aucun analyseur ne le lit avant l'invité.
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser("*", (_request, payload, done) => done(null, payload));
    scope.route({
      method: [...METHODS],
      url: "/api/plugins/:pluginId/*",
      config: { compress: false },
      bodyLimit: 32 * 1024 * 1024,
      handler: (request, reply) => relay(deps, request, reply),
    });
  });
}
