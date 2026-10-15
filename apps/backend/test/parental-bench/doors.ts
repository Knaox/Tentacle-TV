/**
 * Les PORTES d'un compte vers Tentacle : chaque client y entre autrement, et
 * chacune doit appliquer la même politique.
 *  - `personnelle` : le web, le bureau (jeton Jellyfin rendu par `/api/auth/login`) ;
 *  - `tv` : une Apple TV jumelée par le VRAI flux d'appareil (code, confirmation,
 *    jeton d'appareil — le proxy lui prête la clé d'administration) ;
 *  - `voir en tant que` : l'administrateur qui regarde par les yeux du compte.
 */

import { BENCH_PASSWORD } from "./catalog";

export interface Door {
  label: string;
  token: string;
}

export interface CallResult {
  status: number;
  text: string;
  json: unknown;
}

export async function call(base: string, token: string, method: string, path: string, body?: unknown): Promise<CallResult> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Emby-Token": token,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
}

export async function personalToken(base: string, username: string): Promise<string> {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: BENCH_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Connexion Tentacle de ${username} refusée (${res.status})`);
  return ((await res.json()) as { AccessToken: string }).AccessToken;
}

/** Le jumelage d'une TV, comme l'Apple TV le fait : code affiché, confirmé par le compte. */
export async function pairedTvToken(base: string, personal: string, deviceName: string): Promise<string> {
  const generated = await fetch(`${base}/api/pair/device/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceName }),
  }).then((r) => r.json() as Promise<{ code: string }>);
  const confirmed = await call(base, personal, "POST", "/api/pair/device/confirm", { code: generated.code });
  if (confirmed.status !== 200) throw new Error(`Jumelage refusé (${confirmed.status})`);
  const status = await fetch(`${base}/api/pair/device/status/${generated.code}`).then((r) => r.json() as Promise<{ status: string; token?: string }>);
  if (status.status !== "confirmed" || !status.token) throw new Error(`Jumelage non confirmé (${status.status})`);
  return status.token;
}

export async function viewAsToken(base: string, adminPersonal: string, userId: string): Promise<string> {
  const res = await call(base, adminPersonal, "POST", "/api/admin/impersonate", { userId });
  const token = (res.json as { token?: string } | null)?.token;
  if (!token) throw new Error(`« Voir en tant que » refusé (${res.status})`);
  return token;
}

export async function doorsFor(base: string, username: string, userId: string, adminPersonal: string): Promise<Door[]> {
  const personal = await personalToken(base, username);
  return [
    { label: `${username} · personnelle`, token: personal },
    { label: `${username} · TV jumelée`, token: await pairedTvToken(base, personal, `Apple TV du banc (${username})`) },
    { label: `${username} · voir en tant que`, token: await viewAsToken(base, adminPersonal, userId) },
  ];
}

/** L'invité nommé, où qu'il soit dans la vue de la Famille. */
function findGuest(node: unknown, name: string): string | undefined {
  if (Array.isArray(node)) return node.map((child) => findGuest(child, name)).find(Boolean);
  if (!node || typeof node !== "object") return undefined;
  const o = node as Record<string, unknown>;
  if (o.kind === "guest" && o.name === name && typeof o.userId === "string") return o.userId;
  return Object.values(o).map((child) => findGuest(child, name)).find(Boolean);
}

export interface GuestDoor extends Door {
  guestId: string;
}

/**
 * Un invité de la Famille de `owner`, contrôle parental posé (comme le compte
 * restreint), ouvert sur une Apple TV du propriétaire : jumelage, échange du
 * jeton (« profils seuls »), puis la session de PROFIL de l'invité.
 */
export async function guestProfileDoor(
  base: string,
  ownerPersonal: string,
  adminPersonal: string,
  parental: { maxParentalRating: number; blockUnratedItems: string[]; blockedTags: string[] },
): Promise<GuestDoor> {
  await call(base, adminPersonal, "PUT", "/api/admin/family", { families: true, guests: true });
  const family = await call(base, ownerPersonal, "GET", "/api/family");
  let guestId = findGuest(family.json, "Petit");
  if (!guestId) {
    const created = await call(base, ownerPersonal, "POST", "/api/family/guests", { name: "Petit", color: "teal" });
    guestId = (created.json as { userId?: string } | null)?.userId;
    if (!guestId) throw new Error(`Invité non créé (${created.status} ${created.text.slice(0, 200)})`);
  }
  const set = await call(base, ownerPersonal, "PUT", `/api/family/guests/${guestId}/parental`, { ...parental, maxParentalSubRating: null, accessSchedules: [] });
  if (set.status !== 200) throw new Error(`Contrôle parental de l'invité refusé (${set.status} ${set.text.slice(0, 200)})`);
  const tv = await pairedTvToken(base, ownerPersonal, "Apple TV du salon (banc)");
  const enrolled = await call(base, tv, "POST", "/api/family/tv/enroll", {});
  const pairing = (enrolled.json as { pairingToken?: string } | null)?.pairingToken;
  if (!pairing) throw new Error(`Échange du jeton de la TV refusé (${enrolled.status})`);
  const session = await call(base, pairing, "POST", "/api/family/tv/sessions", { profileId: guestId });
  const token = (session.json as { token?: string } | null)?.token;
  if (!token) throw new Error(`Session de profil de l'invité refusée (${session.status} ${session.text.slice(0, 200)})`);
  return { label: "Petit · profil d'invité (TV)", token, guestId };
}
