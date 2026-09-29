/**
 * Ce que partagent les suites : le VRAI `JellyfinClient` de l'api-client,
 * branché sur le proxy du vrai backend comme dans les applications, et les
 * appels directs au backend ou à Jellyfin.
 */

import { expect } from "vitest";
import { JellyfinClient } from "../../../../../packages/api-client/src/jellyfin";
import type { StorageAdapter } from "../../../../../packages/api-client/src/storage";
import { loadContext, type CompatContext } from "../context";

export const ctx = (): CompatContext => loadContext();

class MemoryStorage implements StorageAdapter {
  private data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

let seq = 0;

/** Un client comme celui des applications : base = proxy Tentacle, jeton de l'utilisateur. */
export function tentacleClient(token: string, device = "Compat"): JellyfinClient {
  const client = new JellyfinClient(
    `${ctx().backend.url}/api/jellyfin`,
    new MemoryStorage(),
    { randomUUID: () => `compat-${device}-${++seq}` },
    device,
    "Tentacle TV - Compat",
    "1.99.0",
  );
  client.setAccessToken(token);
  return client;
}

/** Les en-têtes d'une application Tentacle DÉJÀ installée (antérieure à Jellyfin 12). */
export function installedAppHeaders(token: string): Record<string, string> {
  return {
    "X-Emby-Token": token,
    "X-Emby-Authorization": `MediaBrowser Client="Tentacle TV - Mobile", Device="Tentacle-iOS", DeviceId="compat-installed", Version="1.8.1", Token="${token}"`,
  };
}

/** Une requête au proxy `/api/jellyfin/…` du backend. */
export function proxy(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${ctx().backend.url}/api/jellyfin/${path.replace(/^\//, "")}`, init);
}

/** Une route du backend (`/api/…`), au nom d'un compte (Bearer). */
export function backendApi(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${ctx().backend.url}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) },
  });
}

/** Une requête DIRECTE à Jellyfin (préparation, vérification d'un état). */
export function jellyfin(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${ctx().jellyfin.url}${path}`, {
    ...init,
    headers: { Authorization: `MediaBrowser Token="${token}"`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) },
  });
}

export async function okJson<T>(res: Response | Promise<Response>, what: string): Promise<T> {
  const r = await res;
  if (!r.ok) throw new Error(`${what} : HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as T;
}

export function expectStatus(res: Response, ...expected: number[]): void {
  expect(expected, `HTTP ${res.status} sur ${res.url}`).toContain(res.status);
}

/** Lit le corps entier (flux, image, segment) et en rend la taille. */
export async function bodySize(res: Response): Promise<number> {
  return (await res.arrayBuffer()).byteLength;
}

export interface ItemsPage<T = Record<string, unknown>> {
  Items: T[];
  TotalRecordCount?: number;
}
