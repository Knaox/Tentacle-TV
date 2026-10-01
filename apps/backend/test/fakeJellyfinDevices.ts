/**
 * Un FAUX Jellyfin pour les jetons propres des TV : Quick Connect et la liste
 * des appareils, tels que les sources de Jellyfin 10.10 à 12 les décrivent.
 *
 * - `POST /QuickConnect/Initiate` (anonyme, identité de l'appareil) → code + secret ;
 * - `POST /QuickConnect/Authorize?code&userId` (clé d'API) → crée LE jeton du
 *   couple (compte, DeviceId), en remplaçant le précédent ;
 * - `POST /Users/AuthenticateWithQuickConnect` → le jeton ;
 * - `DELETE /Devices?id` → supprime l'appareil (jeton compris) ; inconnu :
 *   404, ou 400 comme Jellyfin 12 (`deleteStatus`) ;
 * - `GET /Devices/Info?id`, `GET /Users/Me` (le jeton → son compte).
 *
 * S'installe sur le `fetch` global (le module de frappe s'en sert).
 */

import { modernJellyfinToken } from "./jellyfinFakeAuth";
import { parseMediaBrowserAuth } from "../src/services/jellyfinAuth";

export const ADMIN_KEY = "cle-admin";

export interface FakeJellyfin {
  quickConnect: boolean;
  /** Statut d'un DELETE sur un appareil inconnu (10.x : 404, 12 : 400). */
  deleteStatus: 400 | 404;
  /** Panne simulée d'une étape (« initiate », « authorize », « authenticate », « delete »). */
  failing: Set<string>;
  /** DeviceId → appareil. */
  devices: Map<string, { userId: string; token: string }>;
  calls: string[];
}

export function createFakeJellyfin(): FakeJellyfin {
  return { quickConnect: true, deleteStatus: 404, failing: new Set(), devices: new Map(), calls: [] };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export function fakeJellyfinFetch(jf: FakeJellyfin) {
  const pending = new Map<string, { secret: string; deviceId: string; token: string | null }>();
  let serial = 0;
  return async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const step = `${method} ${url.pathname}`;
    jf.calls.push(step);
    const token = modernJellyfinToken(init?.headers);
    const fail = (name: string) => jf.failing.has(name);

    if (step === "POST /QuickConnect/Initiate") {
      if (fail("initiate")) return new Response("", { status: 503 });
      if (!jf.quickConnect) return new Response("Quick connect is disabled", { status: 401 });
      const identity = parseMediaBrowserAuth(new Headers(init?.headers).get("authorization")) ?? {};
      if (!identity.DeviceId) return new Response("", { status: 400 });
      serial += 1;
      const code = String(100000 + serial);
      pending.set(code, { secret: `secret-${serial}`, deviceId: identity.DeviceId, token: null });
      return json({ Secret: `secret-${serial}`, Code: code });
    }
    if (step === "POST /QuickConnect/Authorize") {
      if (token !== ADMIN_KEY) return new Response("", { status: 401 });
      if (!jf.quickConnect) return new Response("Quick connect is disabled", { status: 401 });
      const request = pending.get(url.searchParams.get("code") ?? "");
      if (!request) return new Response("", { status: 404 });
      request.token = `jf-token-${serial}-${request.deviceId}`;
      // Un seul jeton par couple (compte, appareil) : le précédent est déconnecté.
      jf.devices.set(request.deviceId, { userId: url.searchParams.get("userId") ?? "", token: request.token });
      if (fail("authorize")) return new Response("", { status: 503 });
      return json(true);
    }
    if (step === "POST /Users/AuthenticateWithQuickConnect") {
      if (fail("authenticate")) return new Response("", { status: 500 });
      const { Secret } = JSON.parse(String(init?.body ?? "{}")) as { Secret?: string };
      const request = [...pending.values()].find((r) => r.secret === Secret && r.token);
      return request ? json({ AccessToken: request.token }) : new Response("", { status: 404 });
    }
    if (step === "DELETE /Devices" || step === "GET /Devices/Info") {
      if (token !== ADMIN_KEY) return new Response("", { status: 401 });
      if (method === "DELETE" && fail("delete")) return new Response("", { status: 503 });
      const id = url.searchParams.get("id") ?? "";
      if (!jf.devices.has(id)) return new Response("", { status: method === "DELETE" ? jf.deleteStatus : 404 });
      if (method === "GET") return json({ Id: id });
      jf.devices.delete(id);
      return new Response(null, { status: 204 });
    }
    if (step === "GET /Users/Me") {
      const owner = [...jf.devices.values()].find((d) => d.token === token);
      return owner ? json({ Id: owner.userId, Name: "x" }) : new Response("", { status: 401 });
    }
    return new Response("", { status: 404 });
  };
}
