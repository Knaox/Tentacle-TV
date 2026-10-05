import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { isIP } from "net";
import { CHECK_PATH, CHECK_PROTOCOL_VERSION, type CheckErrorCode, type CheckResponse } from "./checkProtocol";
import type { Config } from "./config";
import { ChallengeLedger, isPublicAddress, RateLimiter, rateKey } from "./guards";
import { probeTarget, type ProbeOptions } from "./probe";
import { checkRequestSchema } from "./requestSchema";
import { buildBlockList, sourceIpOf } from "./sourceIp";

/**
 * Le service de test d'ouverture : `POST /v1/check` et `GET /healthz`.
 *
 * Aucune adresse dans les journaux : la requête n'y laisse que sa méthode,
 * son chemin et son statut. Les refus ne disent qu'un code.
 */
export interface ServerDeps {
  config: Config;
  probe?: typeof probeTarget;
  probeOptions?: Partial<ProbeOptions>;
  logger?: FastifyServerOptions["logger"];
  now?: () => number;
}

const LOGGER: FastifyServerOptions["logger"] = {
  level: "info",
  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
};

export function buildServer(deps: ServerDeps): FastifyInstance {
  const { config } = deps;
  const now = deps.now ?? Date.now;
  const probe = deps.probe ?? probeTarget;
  const trusted = buildBlockList(config.trustedProxies);
  const limiter = new RateLimiter(config.checksPerWindow, config.windowMs);
  const ledger = new ChallengeLedger();
  let inFlight = 0;

  const app = Fastify({ bodyLimit: 4096, trustProxy: false, logger: deps.logger ?? LOGGER });
  const refuse = (code: CheckErrorCode) => ({ error: code });

  app.setErrorHandler((error, _request, reply) => {
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status >= 400 && status < 500) return reply.code(400).send(refuse("invalid_input"));
    return reply.code(500).send(refuse("internal"));
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: "not_found" }));

  app.get("/healthz", async () => ({ ok: true }));

  app.post(CHECK_PATH, async (request, reply) => {
    const sourceIp = sourceIpOf(request.raw.socket.remoteAddress, request.headers["x-forwarded-for"], trusted);
    if (!sourceIp) return reply.code(400).send(refuse("invalid_input"));
    if (!config.allowNonPublicSources && !isPublicAddress(sourceIp)) return reply.code(403).send(refuse("source_not_public"));

    const parsed = checkRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(refuse("invalid_input"));
    if (inFlight >= config.maxInFlight || !limiter.take(rateKey(sourceIp), now())) return reply.code(429).send(refuse("rate_limited"));
    if (!ledger.claim(parsed.data.challenge.id, now())) return reply.code(409).send(refuse("challenge_replayed"));

    const family = isIP(sourceIp) === 6 ? 6 : 4;
    inFlight += 1;
    try {
      const results = await Promise.all(
        parsed.data.targets.map((target) =>
          probe(
            { sourceIp, family, target, challenge: parsed.data.challenge, jellyfinId: parsed.data.jellyfinId },
            { timeoutMs: config.probeTimeoutMs, ...deps.probeOptions },
          ),
        ),
      );
      const response: CheckResponse = { protocol: CHECK_PROTOCOL_VERSION, sourceIp, family, results };
      return response;
    } finally {
      inFlight -= 1;
    }
  });

  return app;
}
