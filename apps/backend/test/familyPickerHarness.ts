/**
 * Le banc de « Qui regarde ? » sur le bureau : un vrai Fastify avec les vraies
 * routes (Famille, TV, bureau, administration, déjumelage, session —
 * connexion, déconnexion, rafraîchissement) et les portes témoins de
 * `familyHarness.ts` ; base en mémoire, faux Jellyfin. À importer APRÈS les
 * `vi.mock` du fichier de test (`familyMocks.ts`).
 */

import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import { requireAuth } from "../src/middleware/auth";
import { familyRoutes } from "../src/routes/family/familyRoutes";
import { familyPickerRoutes } from "../src/routes/family/familyPickerRoutes";
import { adminFamilyRoutes, familyTvRoutes } from "../src/routes/family/familyTvRoutes";
import { pairedDevicesRoutes } from "../src/routes/pairing/devices";
import { authRoutes } from "../src/routes/auth";
import { IDS, WITNESS_DOORS, bearer } from "./familyHarness";

export async function buildPickerApp(extra?: (app: FastifyInstance) => Promise<void>): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(cookie);
  if (extra) await extra(app);
  for (const path of WITNESS_DOORS) {
    app.get(path, { preHandler: [requireAuth] }, async (request) => ({ user: (request as unknown as { user: unknown }).user }));
  }
  await app.register(familyRoutes, { prefix: "/api/family" });
  await app.register(familyTvRoutes, { prefix: "/api/family" });
  await app.register(familyPickerRoutes, { prefix: "/api/family" });
  await app.register(adminFamilyRoutes, { prefix: "/api/admin" });
  await app.register(pairedDevicesRoutes, { prefix: "/api/pair" });
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.ready();
  return app;
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

export function sender(app: FastifyInstance) {
  return (method: Method, url: string, token: string, payload?: unknown) =>
    app.inject({ method, url, headers: bearer(token), ...(payload !== undefined && { payload: payload as object }) });
}

/** « Qui regarde ? » du bureau, avec ce jeton (la session personnelle, en principe). */
export function pickerProfiles(app: FastifyInstance, token: string, platform: "desktop" | "mobile" = "desktop") {
  return sender(app)("GET", `/api/family/picker/profiles?platform=${platform}`, token);
}

/** Choisit un profil sur le bureau de ce jeton. */
export function pick(
  app: FastifyInstance,
  token: string,
  body: { profileId: string; pin?: string; deviceName?: string; platform?: "desktop" | "mobile" },
) {
  return sender(app)("POST", "/api/family/picker/sessions", token, { platform: "desktop", ...body });
}

/** Ouvre une session de profil sur le bureau ; échoue si le serveur refuse. */
export async function pickSession(app: FastifyInstance, token: string, profileId: string, pin?: string): Promise<string> {
  const res = await pick(app, token, { profileId, ...(pin && { pin }) });
  if (res.statusCode !== 200 || res.json().personal !== false) throw new Error(`profil refusé : ${res.statusCode} ${res.body}`);
  return res.json().token as string;
}

/** Le verdict d'une porte témoin pour ce jeton : 200, ou la fin de la session de profil. */
export async function door(app: FastifyInstance, token: string): Promise<{ status: number; ended: boolean; user?: Record<string, unknown> }> {
  const res = await sender(app)("GET", "/api/protected", token);
  const body = res.json() as { profileEnded?: boolean; user?: Record<string, unknown> };
  return { status: res.statusCode, ended: body.profileEnded === true, user: body.user };
}

/** La famille de Damien : Léa membre (invitation acceptée), Zoé invitée. */
export async function seedFamily(app: FastifyInstance, tokens: { damien: string; lea: string }): Promise<{ zoe: string }> {
  const send = sender(app);
  const id = (await send("POST", "/api/family/invitations", tokens.damien, { userId: IDS.lea })).json().id;
  const accepted = await send("POST", "/api/family/invitations/accept", tokens.lea, { id });
  if (accepted.statusCode !== 200) throw new Error(`invitation refusée : ${accepted.body}`);
  const zoe = (await send("POST", "/api/family/guests", tokens.damien, { name: "Zoé", color: "teal" })).json().userId as string;
  return { zoe };
}
