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
 *    · si le device a son jeton Jellyfin propre → on l'utilise (compte correct) ;
 *    · sinon → clé admin + RÉÉCRITURE du report de lecture en écriture des
 *      données utilisateur (/UserItems/{itemId}/UserData?userId=), car
 *      /Sessions/Playing* avec la clé admin perdrait la progression.
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
  // Le jeton PROPRE de l'appareil, frappé pour lui au besoin — jamais celui
  // d'un autre appareil, du même compte ou non (cf. `resolvePairedDeviceToken`).
  const deviceToken = await resolvePairedDeviceToken(incomingToken, payload.userId);
  if (deviceToken) return { apiKey: deviceToken, usedDeviceToken: true };

  // Aucun token Jellyfin pour cet utilisateur : la position s'écrit directement
  // dans les données du compte (cf. playstate.ts — mesuré juste de 10.10 à 12.1).
  // Seule la session « en cours » du tableau de bord Jellyfin manque.
  if (adminKey) {
    const rewrite = buildPlaystateRewrite(payload.userId, wildcardPath, body) ?? undefined;
    if (rewrite) return { apiKey: adminKey, rewrite };
  }
  return { apiKey: adminKey ?? undefined };
}
