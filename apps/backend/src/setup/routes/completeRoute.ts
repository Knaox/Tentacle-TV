import type { FastifyBaseLogger, FastifyPluginAsync } from "fastify";
import { setAppState, setConfigValue } from "../../services/configStore";
import { startBackgroundServices } from "../../services/backgroundServices";
import { injectCorsHosts } from "../../services/jellyfinCors";
import { buildAuthHeader, deviceIdForOpaque } from "../../services/jellyfinIdentity";
import { setSessionCookie } from "../../routes/authCookie";
import { signOut } from "../jellyfin/accounts";
import { clientUrlFor } from "../jellyfin/clientUrlFor";
import { jellyfinRequest } from "../jellyfin/guardedFetch";
import { SetupError } from "../setupErrors";
import { requireSetupSession } from "../setupGuard";
import { sealSetup } from "../setupLock";
import { completeSchema } from "../setupSchemas";
import { closeAllSetupSessions } from "../setupSession";
import { claimedAdminId, storedJellyfin, type StoredJellyfin } from "../setupStore";
import { discardSetupToken } from "../setupToken";
import type { SetupCompleteResponse } from "../setupWizardContract";

interface LoginResult {
  AccessToken?: unknown;
  ServerId?: unknown;
  User?: SetupCompleteResponse["User"] & { Policy?: { IsAdministrator?: unknown } };
}

/**
 * Les origines web de Tentacle, ajoutées aux `CorsHosts` de Jellyfin pour la
 * lecture directe depuis le navigateur. Jamais bloquant ; jamais l'origine
 * maison du bureau (`tentacle://`), que Jellyfin n'a pas à connaître.
 */
async function allowTentacleOrigin(stored: StoredJellyfin, origin: string | undefined, log: FastifyBaseLogger): Promise<void> {
  const candidate = origin || process.env.TENTACLE_PUBLIC_URL;
  if (!candidate || !/^https?:\/\//.test(candidate)) return;
  try {
    const result = await injectCorsHosts(stored.url, stored.apiKey, [candidate], log);
    if (result.added.length) log.info({ added: result.added }, "[Setup] origine ajoutée aux CorsHosts de Jellyfin");
  } catch (err) {
    log.warn({ err: { message: err instanceof Error ? err.message : String(err) } }, "[Setup] CorsHosts non modifiés");
  }
}

/**
 * POST /api/setup/complete — le compte administrateur de Jellyfin devient
 * celui de Tentacle, et l'installation se FERME : drapeau en base, fichier
 * verrou, code jeté, sessions de l'assistant fermées, tâches de fond lancées.
 * La réponse est celle d'une connexion (`/api/auth/login`) : le client web
 * arrive connecté.
 */
export const setupCompleteRoute: FastifyPluginAsync = async (app) => {
  app.post(
    "/complete",
    { preHandler: requireSetupSession, config: { rateLimit: { max: 10, timeWindow: 60_000 } } },
    async (request, reply): Promise<SetupCompleteResponse> => {
      const body = completeSchema.parse(request.body);
      const stored = storedJellyfin();
      if (!stored) throw new SetupError("jf_not_configured");
      // Le compte provisoire du Jellyfin voisin n'a pas encore pris le nom choisi.
      if (claimedAdminId()) throw new SetupError("jf_claim_pending");

      // Une session Jellyfin par (installation, appareil, compte), comme /api/auth/login.
      const deviceId = await deviceIdForOpaque("web", body.deviceId ?? body.username, body.username);
      const login = await jellyfinRequest(stored.url, "/Users/AuthenticateByName", {
        method: "POST",
        body: { Username: body.username, Pw: body.password },
        authorization: buildAuthHeader({ device: body.device ?? "Web", deviceId, client: body.client }),
        timeoutMs: 15_000,
      });
      if (login.status >= 500) throw new SetupError("jf_unreachable");
      if (login.status !== 200) throw new SetupError("jf_bad_credentials");
      const data = login.json as LoginResult | null;
      const user = data?.User;
      if (typeof data?.AccessToken !== "string" || typeof user?.Id !== "string" || typeof user.Name !== "string") {
        throw new SetupError("jf_not_jellyfin");
      }
      if (user.Policy?.IsAdministrator !== true) {
        await signOut(stored.url, data.AccessToken);
        throw new SetupError("jf_not_admin");
      }

      // L'adresse que les applications recevront pour Jellyfin (lecture directe) :
      // celle revue au récapitulatif, sinon celle que l'assistant propose.
      const clientUrl =
        body.jellyfinClientUrl?.replace(/\/+$/, "") ??
        clientUrlFor(request, stored.url);
      if (clientUrl) await setConfigValue("jellyfin_private_url", clientUrl);
      await setConfigValue("admin_jellyfin_id", user.Id);
      await setConfigValue("admin_username", user.Name);
      await setConfigValue("setup_completed", "true");
      setAppState("running");
      sealSetup();
      discardSetupToken();
      closeAllSetupSessions();
      startBackgroundServices();
      await allowTentacleOrigin(stored, request.headers.origin, request.log);

      setSessionCookie(reply, data.AccessToken);
      request.log.info({ userId: user.Id }, "[Setup] installation terminée");
      return {
        success: true,
        AccessToken: data.AccessToken,
        User: user,
        ServerId: typeof data.ServerId === "string" ? data.ServerId : "",
        DeviceId: deviceId,
      };
    },
  );
};
