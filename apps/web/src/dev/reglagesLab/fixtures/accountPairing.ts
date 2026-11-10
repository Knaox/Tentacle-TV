/**
 * Le jumelage du faux serveur : les appareils jumelés (ceux de tous pour l'administration,
 * les siens pour chacun), la confirmation d'un code affiché par une TV, et le code de
 * provisionnement. Formes : `packages/api-client/src/hooks/usePairing.ts` (`PairedDevice`),
 * `components/admin/ProvisioningCodeSection.tsx` (`ProvisioningState`).
 */

import type { LabRoute } from "../labFetch";
import { LAB_USER } from "./base";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Une date d'il y a `ms` millisecondes, comme le serveur l'écrit. */
export const labAgo = (ms: number): string => new Date(Date.now() - ms).toISOString();

interface LabPairedDevice {
  id: string;
  name: string;
  username: string;
  jellyfinUserId: string;
  lastSeen: string;
  createdAt: string;
}

/** Les appareils jumelés du serveur : deux du compte du labo, deux d'autres comptes. */
const devices: LabPairedDevice[] = [
  { id: "dev-salon", name: "Apple TV du salon", username: LAB_USER.Name, jellyfinUserId: LAB_USER.Id, lastSeen: labAgo(40 * 60_000), createdAt: labAgo(96 * DAY) },
  { id: "dev-chambre", name: "LG OLED — chambre", username: LAB_USER.Name, jellyfinUserId: LAB_USER.Id, lastSeen: labAgo(3 * DAY), createdAt: labAgo(41 * DAY) },
  { id: "dev-shield", name: "Shield TV de Noé", username: "Noé", jellyfinUserId: "u-noe", lastSeen: labAgo(5 * HOUR), createdAt: labAgo(12 * DAY) },
  { id: "dev-bureau", name: "Android TV — bureau", username: "Léa", jellyfinUserId: "u-lea", lastSeen: labAgo(27 * DAY), createdAt: labAgo(203 * DAY) },
];

const idOf = (url: URL): string => decodeURIComponent(url.pathname.split("/").pop() ?? "");

function revoke(id: string): { success: boolean } {
  const index = devices.findIndex((device) => device.id === id);
  if (index >= 0) devices.splice(index, 1);
  return { success: true };
}

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const longCode = (): string => Array.from({ length: 12 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");

/** Le code de provisionnement : activé, avec son compte dédié et une échéance à venir. */
const provisioning = {
  code: "TV7KQ2M9XHPB",
  enabled: true,
  expiresAt: new Date(Date.now() + 21 * DAY).toISOString() as string | null,
  account: "tv-demo",
  publicUrl: "https://tentacle.example.org",
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export const pairingRoutes: readonly LabRoute[] = [
  { path: "/api/pair/devices", reply: () => devices },
  { path: "/api/pair/my-devices", reply: () => devices.filter((device) => device.jellyfinUserId === LAB_USER.Id) },
  { method: "DELETE", path: /^\/api\/pair\/(?:my-)?devices\/[^/]+$/, reply: ({ url }) => revoke(idOf(url)) },

  // La TV affiche un code de ce serveur ; le web le confirme : un appareil de plus.
  {
    method: "POST",
    path: "/api/pair/device/confirm",
    reply: () => {
      devices.unshift({
        id: `dev-${devices.length + 1}-${Date.now()}`, name: "Téléviseur du labo", username: LAB_USER.Name, jellyfinUserId: LAB_USER.Id,
        lastSeen: labAgo(0), createdAt: labAgo(0),
      });
      return { success: true, deviceName: "Téléviseur du labo" };
    },
  },
  { method: "POST", path: "/api/pair/device/generate", reply: { code: "K7M2", expiresIn: 300 } },
  { path: /^\/api\/pair\/device\/status\/[^/]+$/, reply: { status: "pending" } },
  { method: "POST", path: "/api/pair/generate", reply: () => ({ code: "K7M2", expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() }) },
  { path: /^\/api\/pair\/status\/[^/]+$/, reply: { status: "pending" } },
  { method: "POST", path: "/api/pair/claim", reply: { token: "lab-device-token", userId: LAB_USER.Id, username: LAB_USER.Name, serverUrl: "https://tentacle.example.org" } },
  { method: "POST", path: "/api/pair/tv-token", reply: { token: "lab-tv-token" } },
  { method: "POST", path: "/api/pair/self/revoke", reply: { revoked: true } },

  { path: "/api/admin/provisioning", reply: () => provisioning },
  {
    method: "PUT",
    path: "/api/admin/provisioning",
    reply: ({ body }) => {
      if (isRecord(body)) {
        provisioning.enabled = body.enabled === true;
        if (typeof body.expiresAt === "string") provisioning.expiresAt = body.expiresAt;
        if (typeof body.username === "string") provisioning.account = body.username;
      }
      return provisioning;
    },
  },
  {
    method: "POST",
    path: "/api/admin/provisioning/regenerate",
    reply: () => Object.assign(provisioning, { code: longCode(), enabled: false, expiresAt: null }),
  },
];
