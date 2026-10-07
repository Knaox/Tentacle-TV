import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requirePersonalAdmin } from "../middleware/auth";
import { getDirectStreamingConfig, getPublicUrl } from "../services/configStore";
import { readDeployment } from "../setup/deployment";
import type { RemoteAccessState } from "./remoteAccessContract";
import { readLastCheck, readRemoteAccessSettings, saveRemoteAccessSettings } from "./remoteAccessSettings";
import { detectPublicIp } from "./publicIp";
import { activeJellyfinPublicUrl, checkServiceUrl, hostPort, jellyfinLanPort, runRemoteCheck } from "./remoteCheck";

/**
 * L'accès à distance (`/api/admin/remote-access`) — enregistré depuis
 * `adminRoutes`, et en plus réservé à un administrateur en SESSION
 * PERSONNELLE : une TV jumelée par un administrateur n'ouvre rien sur
 * Internet. Contrat : `packages/shared/src/remoteAccess/remoteAccessContract.ts`.
 */

/** Une adresse http(s) du réseau local, ou rien. */
const localUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (value === "") return true;
    try {
      const url = new URL(value);
      return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "" && !url.username && !url.password;
    } catch {
      return false;
    }
  })
  .transform((value) => (value === "" ? null : value.replace(/\/+$/, "")));

const patchSchema = z
  .object({
    enabled: z.boolean().optional(),
    proxy: z.enum(["caddy", "traefik", "other", "none"]).optional(),
    localUrl: z.union([localUrl, z.null()]).optional(),
    routerId: z.string().regex(/^[a-z0-9-]{1,32}$/).nullable().optional(),
  })
  .strict();

function buildState(): RemoteAccessState {
  const deployment = readDeployment();
  const direct = getDirectStreamingConfig();
  return {
    settings: readRemoteAccessSettings(),
    publicUrl: getPublicUrl(),
    jellyfinPublicUrl: activeJellyfinPublicUrl(),
    hostPort: hostPort(),
    jellyfinHostPort: jellyfinLanPort(),
    directPlay: { enabled: direct.enabled, privateUrl: direct.privateUrl, publicUrl: direct.publicUrl },
    deployment: deployment.deployment,
    stack: deployment.stack,
    checkServiceUrl: checkServiceUrl(),
    lastCheck: readLastCheck(),
  };
}

export const remoteAccessRoutes: FastifyPluginAsync = async (app) => {
  app.get("/remote-access", { preHandler: requirePersonalAdmin }, async () => buildState());

  app.put("/remote-access", { preHandler: requirePersonalAdmin }, async (request, reply) => {
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_input" });
    await saveRemoteAccessSettings(parsed.data);
    return buildState();
  });

  /** L'adresse publique, détectée (capacité `admin.remoteExposure`) — au plus une demande toutes les dix minutes. */
  app.get("/remote-access/public-ip", { preHandler: requirePersonalAdmin, config: { rateLimit: { max: 30, timeWindow: 60_000 } } }, async () => detectPublicIp());

  // Chaque test sollicite le service public : peu, et pas en rafale.
  app.post(
    "/remote-access/check",
    { preHandler: requirePersonalAdmin, config: { rateLimit: { max: 6, timeWindow: 10 * 60_000 } } },
    async () => runRemoteCheck(),
  );
};
