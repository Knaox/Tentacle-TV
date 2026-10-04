/**
 * Un FAUX Jellyfin pour la Famille : les comptes (liste, lecture, création,
 * mot de passe, politique, suppression) par la clé d'API, les jetons des
 * sessions personnelles (`/Users/Me`), et — par délégation — Quick Connect
 * et les appareils (`fakeJellyfinDevices.ts`).
 *
 * Comme Jellyfin : `POST /Users/{id}/Policy` REMPLACE la politique ; un nom
 * déjà pris refuse la création (400) ; supprimer un compte emporte ses appareils.
 */

import crypto from "crypto";
import { ADMIN_KEY, createFakeJellyfin, fakeJellyfinFetch, type FakeJellyfin } from "./fakeJellyfinDevices";
import { modernJellyfinToken } from "./jellyfinFakeAuth";

export interface FakeUser {
  Id: string;
  Name: string;
  Policy: Record<string, unknown>;
  PrimaryImageTag?: string;
  password?: string;
}

export interface FakeJellyfinUsers extends FakeJellyfin {
  users: Map<string, FakeUser>;
  /** Jeton d'une session personnelle (web, bureau, mobile) → compte. */
  personalTokens: Map<string, string>;
  /** `POST /Users/New` refusé (panne simulée). */
  refuseCreation: boolean;
  /** `DELETE /Users/{id}` refusé (panne simulée) : le compte reste. */
  refuseDeletion: boolean;
}

export function defaultPolicy(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    IsAdministrator: false,
    IsHidden: false,
    IsDisabled: false,
    EnableContentDownloading: true,
    EnableContentDeletion: false,
    EnableAllFolders: true,
    EnabledFolders: [],
    MaxParentalRating: null,
    BlockedTags: [],
    AllowedTags: [],
    EnableRemoteAccess: true,
    AuthenticationProviderId: "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider",
    PasswordResetProviderId: "Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider",
    ...over,
  };
}

export function createFakeJellyfinUsers(): FakeJellyfinUsers {
  return { ...createFakeJellyfin(), users: new Map(), personalTokens: new Map(), refuseCreation: false, refuseDeletion: false };
}

/** Ajoute un compte ; rend le jeton de sa session personnelle. */
export function addUser(jf: FakeJellyfinUsers, user: { id: string; name: string; policy?: Record<string, unknown> }): string {
  jf.users.set(user.id, { Id: user.id, Name: user.name, Policy: defaultPolicy(user.policy) });
  const token = `jf-${user.id}`;
  jf.personalTokens.set(token, user.id);
  return token;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export function fakeJellyfinUsersFetch(jf: FakeJellyfinUsers) {
  const devices = fakeJellyfinFetch(jf);
  return async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const token = modernJellyfinToken(init?.headers);
    const path = url.pathname;
    const admin = token === ADMIN_KEY;

    if (method === "GET" && path === "/Users/Me") {
      const personal = jf.personalTokens.get(token ?? "");
      const user = personal ? jf.users.get(personal) : undefined;
      if (user) return json({ Id: user.Id, Name: user.Name, Policy: user.Policy });
      return devices(input, init);
    }
    if (!path.startsWith("/Users")) return devices(input, init);
    if (path === "/Users/AuthenticateWithQuickConnect") return devices(input, init);
    if (!admin) return new Response("", { status: 401 });
    jf.calls.push(`${method} ${path}`);

    if (method === "GET" && path === "/Users") return json([...jf.users.values()]);
    if (method === "POST" && path === "/Users/New") {
      if (jf.refuseCreation) return new Response("", { status: 500 });
      const body = JSON.parse(String(init?.body ?? "{}")) as { Name?: string; Password?: string };
      const name = body.Name ?? "";
      if ([...jf.users.values()].some((u) => u.Name.toLowerCase() === name.toLowerCase())) return new Response("exists", { status: 400 });
      const user: FakeUser = { Id: crypto.randomBytes(16).toString("hex"), Name: name, Policy: defaultPolicy(), password: body.Password };
      jf.users.set(user.Id, user);
      return json(user);
    }
    if (method === "POST" && path === "/Users/Password") {
      const user = jf.users.get(url.searchParams.get("userId") ?? "");
      if (!user) return new Response("", { status: 404 });
      user.password = (JSON.parse(String(init?.body ?? "{}")) as { NewPw?: string }).NewPw;
      return new Response(null, { status: 204 });
    }
    const match = /^\/Users\/([^/]+)(\/Policy)?$/.exec(path);
    const user = match ? jf.users.get(match[1]) : undefined;
    if (!match || !user) return new Response("", { status: 404 });
    if (method === "GET" && !match[2]) return json(user);
    if (method === "POST" && match[2]) {
      user.Policy = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return new Response(null, { status: 204 });
    }
    if (method === "DELETE" && !match[2]) {
      if (jf.refuseDeletion) return new Response("", { status: 500 });
      jf.users.delete(user.Id);
      for (const [deviceId, device] of jf.devices) if (device.userId === user.Id) jf.devices.delete(deviceId);
      return new Response(null, { status: 204 });
    }
    return new Response("", { status: 405 });
  };
}
