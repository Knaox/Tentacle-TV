/**
 * Le banc des routes de la Famille : un vrai Fastify avec les vraies routes
 * (Famille, TV, administration, déjumelage, rafraîchissement) et quelques
 * portes témoins derrière `requireAuth` ; base en mémoire, faux Jellyfin.
 * À importer APRÈS les `vi.mock` du fichier de test (`familyMocks.ts`).
 */

import crypto from "crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { requireAuth } from "../src/middleware/auth";
import { familyRoutes } from "../src/routes/family/familyRoutes";
import { adminFamilyRoutes, familyTvRoutes } from "../src/routes/family/familyTvRoutes";
import { pairedDevicesRoutes } from "../src/routes/pairing/devices";
import { authRefreshRoutes } from "../src/routes/authRefresh";
import { resetPairedDeviceStatusForTests } from "../src/services/pairedDeviceStatus";
import { invalidateJellyfinUsers } from "../src/services/watchTogether/usersCache";
import { forgetFamilyGuests } from "../src/services/family/familyGuestMarkers";
import { forgetReviewAccount } from "../src/services/family/familyConfig";
import { resetOwnJellyfinTokenForTests } from "../src/services/deviceJellyfinToken";
import { resetTokenOwnerCacheForTests } from "../src/services/deviceTokenHealth";
import { hashToken, signDeviceToken } from "../src/services/jwt";
import { addUser } from "./fakeJellyfinUsers";
import type { HarnessState } from "./familyMocks";

/** Des portes témoins : ce qu'une session de profil atteint, ou non. */
export const WITNESS_DOORS = [
  "/api/protected",
  "/api/push/register",
  "/api/downloads/capabilities",
  "/api/watch-together/group",
  "/api/tickets/mine",
  "/api/plugins/seer/requests",
];

export async function buildFamilyApp(extra?: (app: FastifyInstance) => Promise<void>): Promise<FastifyInstance> {
  const app = Fastify();
  if (extra) await extra(app);
  for (const path of WITNESS_DOORS) {
    app.get(path, { preHandler: [requireAuth] }, async (request) => ({ user: (request as unknown as { user: unknown }).user }));
  }
  await app.register(familyRoutes, { prefix: "/api/family" });
  await app.register(familyTvRoutes, { prefix: "/api/family" });
  await app.register(adminFamilyRoutes, { prefix: "/api/admin" });
  await app.register(pairedDevicesRoutes, { prefix: "/api/pair" });
  await app.register(authRefreshRoutes, { prefix: "/api/auth" });
  await app.ready();
  return app;
}

export function resetCaches(): void {
  resetPairedDeviceStatusForTests();
  invalidateJellyfinUsers();
  forgetFamilyGuests();
  forgetReviewAccount();
  resetOwnJellyfinTokenForTests();
  resetTokenOwnerCacheForTests();
}

/** Les comptes du banc (identifiants Jellyfin : 32 hexadécimaux). */
export const IDS = {
  damien: "d".repeat(32),
  lea: "1e".repeat(16),
  hugo: "4a".repeat(16),
  cache: "ca".repeat(16),
  coupe: "c0".repeat(16),
  demo: "de".repeat(16),
};

/** Les comptes, et le jeton de la session personnelle de chacun. */
export function seedUsers(state: HarnessState): Record<keyof typeof IDS, string> {
  return {
    damien: addUser(state.jf, { id: IDS.damien, name: "Damien", policy: { IsAdministrator: true, MaxParentalRating: 12, BlockedTags: ["horreur"] } }),
    lea: addUser(state.jf, { id: IDS.lea, name: "Léa" }),
    hugo: addUser(state.jf, { id: IDS.hugo, name: "Hugo" }),
    cache: addUser(state.jf, { id: IDS.cache, name: "Caché", policy: { IsHidden: true } }),
    coupe: addUser(state.jf, { id: IDS.coupe, name: "Coupé", policy: { IsDisabled: true } }),
    demo: addUser(state.jf, { id: IDS.demo, name: "Demo" }),
  };
}

/** Une TV jumelée à l'ancienne par ce compte : son jeton d'appareil. */
export async function pairTv(state: HarnessState, userId: string, username: string, name = "Apple TV"): Promise<string> {
  const token = await signDeviceToken({ userId, username, isAdmin: false, deviceId: crypto.randomUUID() });
  await state.db.client.pairedDevice.create({ data: { tokenHash: hashToken(token), jellyfinUserId: userId, username, name } });
  return token;
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

/** La TV passe aux profils : son jeton de jumelage « profils seuls ». */
export async function enroll(app: FastifyInstance, legacyToken: string): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/api/family/tv/enroll", headers: bearer(legacyToken) });
  if (res.statusCode !== 200) throw new Error(`échange refusé : ${res.statusCode} ${res.body}`);
  return (res.json() as { pairingToken: string }).pairingToken;
}

/** Ouvre une session de profil ; rend la réponse brute. */
export function openProfile(app: FastifyInstance, pairingToken: string, body: Record<string, unknown>) {
  return app.inject({ method: "POST", url: "/api/family/tv/sessions", headers: bearer(pairingToken), payload: body });
}
