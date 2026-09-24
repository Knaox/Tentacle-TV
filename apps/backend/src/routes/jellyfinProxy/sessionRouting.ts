import { getJellyfinApiKey } from "../../services/configStore";
import { verifyDeviceToken, verifyImpersonationToken } from "../../services/jwt";
import { hasPrisma } from "../../services/db";
import { resolvePairedDeviceToken } from "../../services/deviceTokenHealth";
import { buildPlaystateRewrite, type PlaystateRewrite } from "./playstate";

/** Resolve how to forward a request to Jellyfin :
 *  - Anonymous / native token → no override, pass-through whatever client sent.
 *  - Impersonation JWT (admin "voir en tant que") → admin API key ; les requêtes
 *    user-data ciblent /Users/{userId}/* explicitement, la clé admin suffit.
 *  - Device JWT, route de session :
 *    · si le device a un token Jellyfin stocké → on l'utilise (compte correct) ;
 *    · sinon → clé admin + RÉÉCRITURE du report de lecture vers l'endpoint scopé
 *      userId (/Users/{userId}/PlayingItems/*), car /Sessions/Playing* avec la
 *      clé admin enregistrerait la progression sur le compte admin.
 *  - Device JWT, autre route → admin API key (user-data ciblé par /Users/{id}). */
export async function resolveSessionRouting(
  incomingToken: string | undefined,
  wildcardPath: string,
  body: unknown,
): Promise<{ apiKey?: string; rewrite?: PlaystateRewrite; usedDeviceToken?: boolean }> {
  if (!incomingToken) return {};
  const payload = await verifyDeviceToken(incomingToken);
  if (!payload) {
    const impersonation = await verifyImpersonationToken(incomingToken);
    return impersonation ? { apiKey: getJellyfinApiKey() ?? undefined } : {};
  }

  const adminKey = getJellyfinApiKey();
  const isSessionRoute = /^(Sessions\/Playing|Videos\/ActiveEncodings)/.test(wildcardPath);
  if (!isSessionRoute || !hasPrisma()) {
    return { apiKey: adminKey ?? undefined };
  }

  // Routes de session (playstate / active encodings) : on attribue à
  // l'utilisateur via SON token Jellyfin stocké.
  //
  // IMPORTANT (Jellyfin 10.11) : les endpoints legacy `/Users/{userId}/PlayingItems/*`
  // sont `[Obsolete]` et IGNORENT l'userId de l'URL — ils attribuent la lecture
  // au compte du TOKEN porteur. La réécriture clé-admin enregistrait donc la
  // progression sur le compte ADMIN, jamais sur l'utilisateur (état de visionnage
  // jamais mis à jour côté client jumelé). Seul le vrai token Jellyfin du device
  // attribue correctement → on le PRÉFÈRE désormais.
  //
  // Le jeton n'est retenu que s'il appartient au compte de l'appareil — un
  // jeton étranger écrivait la progression sur l'autre compte, en silence
  // (cf. `resolvePairedDeviceToken`). À défaut, celui d'un appareil frère du
  // MÊME compte : plusieurs appareils d'un même utilisateur partagent alors ce
  // token (OK pour l'état de visionnage ; sessions Jellyfin fusionnées).
  const { token: deviceToken } = await resolvePairedDeviceToken(incomingToken, payload.userId);
  if (deviceToken) return { apiKey: deviceToken, usedDeviceToken: true };

  // Aucun token Jellyfin pour cet utilisateur : repli best-effort sur la réécriture user-scopée.
  // N'attribue correctement que sur d'anciens Jellyfin (où l'userId d'URL est honoré) ; sinon la
  // télémétrie est perdue (mais aucune attribution erronée bloquante).
  if (adminKey) {
    const rewrite = buildPlaystateRewrite(payload.userId, wildcardPath, body) ?? undefined;
    if (rewrite) return { apiKey: adminKey, rewrite };
  }
  return { apiKey: adminKey ?? undefined };
}
