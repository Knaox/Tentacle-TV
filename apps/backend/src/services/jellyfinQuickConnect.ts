import { getJellyfinApiKey, getJellyfinUrl } from "./configStore";
import { jellyfinAuthHeaders } from "./jellyfinAuth";
import { buildAuthHeader } from "./jellyfinIdentity";

/**
 * Un jeton Jellyfin PROPRE pour une TV jumelée, sans mot de passe : Quick
 * Connect, autorisé par la clé d'administration.
 *
 * Une TV ne s'authentifie jamais auprès de Jellyfin. Elle recevait la COPIE du
 * jeton d'un autre appareil du compte (le téléphone qui confirmait le
 * jumelage, un appareil frère) : impossible à révoquer sans déconnecter cet
 * autre appareil, et toujours valide chez Jellyfin après le déjumelage.
 *
 * Quick Connect crée, lui, un jeton lié à l'appareil qui l'a demandé — lu dans
 * les sources de Jellyfin 10.10, 10.11 et 12 (`QuickConnectManager`) :
 * 1. `POST /QuickConnect/Initiate`, anonyme, avec l'identité de la TV
 *    (Client, Device, DeviceId, Version) — Jellyfin rend un code et un secret ;
 * 2. `POST /QuickConnect/Authorize?code=…&userId=…` avec la clé d'API — une
 *    clé d'API a le rôle administrateur, qui peut autoriser pour un autre
 *    compte (`RequestHelpers.GetUserId`). Jellyfin crée là le jeton, pour ce
 *    compte et CE DeviceId (`AuthenticateDirect`), et remplace celui qu'avait
 *    ce même couple ;
 * 3. `POST /Users/AuthenticateWithQuickConnect` avec le secret rend le jeton.
 *
 * Le DeviceId est celui que le serveur dérive pour la TV (`deviceAuth.ts`) :
 * unique, infalsifiable, et déjà celui qu'elle présente. Supprimer cet
 * appareil chez Jellyfin (`DELETE /Devices`) détruit le jeton et ferme ses
 * sessions — c'est la révocation complète.
 *
 * Quick Connect coupé (réglage du serveur, actif par défaut) : la TV n'a pas
 * de jeton Jellyfin et tout passe par le proxy.
 */

/** Le nom d'application que Jellyfin montre pour une TV jumelée — le même que
 *  le canal de session présente pour elle (`deviceAuth.pairedIdentity`). */
export const PAIRED_CLIENT = "Tentacle TV - TV";

const TIMEOUT_MS = 5_000;

export type MintOutcome =
  | { ok: true; accessToken: string }
  /** `authorized` : Jellyfin a déjà créé le jeton — l'appareil existe chez lui,
   *  et doit en disparaître si personne ne le garde. */
  | { ok: false; reason: "disabled" | "refused" | "unreachable"; authorized: boolean };

interface Step {
  status: number | null;
  json: unknown;
}

async function call(url: string, init: RequestInit): Promise<Step> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const json = res.ok ? await res.json().catch(() => null) : null;
    return { status: res.status, json };
  } catch {
    return { status: null, json: null };
  }
}

function failure(step: Step, authorized: boolean): MintOutcome {
  if (step.status === null || step.status >= 500) return { ok: false, reason: "unreachable", authorized };
  // Jellyfin répond « Quick connect is disabled » en 401 à chacune des étapes.
  if (step.status === 401) return { ok: false, reason: "disabled", authorized };
  return { ok: false, reason: "refused", authorized };
}

export async function mintJellyfinToken(input: {
  userId: string;
  deviceId: string;
  deviceName: string;
}): Promise<MintOutcome> {
  const base = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!base || !apiKey) return { ok: false, reason: "unreachable", authorized: false };
  const identity = buildAuthHeader({ client: PAIRED_CLIENT, device: input.deviceName, deviceId: input.deviceId });

  const initiate = await call(`${base}/QuickConnect/Initiate`, { method: "POST", headers: { Authorization: identity } });
  const request = initiate.json as { Secret?: unknown; Code?: unknown } | null;
  if (initiate.status !== 200 || typeof request?.Secret !== "string" || typeof request.Code !== "string") {
    return failure(initiate, false);
  }

  const query = new URLSearchParams({ code: request.Code, userId: input.userId });
  const authorize = await call(`${base}/QuickConnect/Authorize?${query.toString()}`, {
    method: "POST",
    headers: jellyfinAuthHeaders(apiKey),
  });
  // Sans réponse, Jellyfin a pu autoriser quand même : l'appareil existe peut-être.
  const unknown = authorize.status === null || authorize.status >= 500;
  if (authorize.status !== 200 || authorize.json !== true) return failure(authorize, unknown);

  const auth = await call(`${base}/Users/AuthenticateWithQuickConnect`, {
    method: "POST",
    headers: { Authorization: identity, "Content-Type": "application/json" },
    body: JSON.stringify({ Secret: request.Secret }),
  });
  const result = auth.json as { AccessToken?: unknown } | null;
  if (auth.status !== 200 || typeof result?.AccessToken !== "string" || !result.AccessToken) {
    return failure(auth, true);
  }
  return { ok: true, accessToken: result.AccessToken };
}

/**
 * Fait disparaître un appareil de Jellyfin : son jeton, et ses sessions
 * (`SessionManager.Logout`). `absent` : il n'y est plus — 404 en 10.x, 400 en
 * 12 pour un identifiant inconnu, confirmé par `GET /Devices/Info`.
 */
export async function deleteJellyfinDevice(deviceId: string): Promise<"deleted" | "absent" | "retry"> {
  const base = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!base || !apiKey) return "retry";
  const query = new URLSearchParams({ id: deviceId }).toString();
  const removed = await call(`${base}/Devices?${query}`, { method: "DELETE", headers: jellyfinAuthHeaders(apiKey) });
  if (removed.status === 204 || removed.status === 200) return "deleted";
  if (removed.status !== 404 && removed.status !== 400) return "retry";
  const info = await call(`${base}/Devices/Info?${query}`, { method: "GET", headers: jellyfinAuthHeaders(apiKey) });
  return info.status === 404 ? "absent" : "retry";
}
