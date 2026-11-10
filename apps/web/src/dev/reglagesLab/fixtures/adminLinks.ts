/**
 * Les ADRESSES du serveur et l'accès à distance : le lien public, la lecture directe, le
 * rapport sondé de la vue d'ensemble (`/api/admin/server-links`), l'état de l'accès à distance
 * et son test d'ouverture. État en mémoire : un enregistrement se relit.
 *
 * - `healthy` : lien public en HTTPS, lecture directe réglée (adresse locale + publique), tout
 *   sondé avec succès, dernier test d'ouverture réussi ;
 * - `advice` : lien public en http:// sur une adresse nue (« pas de HTTPS »), lecture directe
 *   coupée, aucun test fait.
 *
 * Les adresses LOCALES sont en 192.168.1.x : la règle des liens (`serverLinksVerdict.ts`) ne
 * reconnaît un réseau local qu'à une adresse privée — une adresse de documentation y serait
 * jugée « publique ». Formes : `serverLinksContract.ts`, `remoteAccessContract.ts` (shared).
 */

import type { PublicIpReport, RemoteAccessState, RemoteCheckReport, ServerLinksReport } from "@tentacle-tv/shared";
import type { LabRoute } from "../labFetch";
import { labAgo } from "./accountPairing";
import { JELLYFIN_INTERNAL_URL, JELLYFIN_VERSION, type AdminState } from "./adminServer";
import { record, type LabRequest } from "./settingsShared";

const MINUTE = 60_000;
const PUBLIC_IP = "203.0.113.20";
const LAN_TENTACLE = "http://192.168.1.20:3000";
const LAN_JELLYFIN = "http://192.168.1.20:8096";
const ORIGINS = ["https://tentacle.example.org", LAN_TENTACLE, "tentacle://app"];

interface Addresses {
  publicUrl: string;
  direct: { enabled: boolean; publicUrl: string; privateUrl: string };
}

function seed(state: AdminState): Addresses {
  return state === "advice"
    ? { publicUrl: `http://${PUBLIC_IP}:3000`, direct: { enabled: false, publicUrl: "", privateUrl: "" } }
    : { publicUrl: "https://tentacle.example.org", direct: { enabled: true, publicUrl: "https://jellyfin.example.org", privateUrl: LAN_JELLYFIN } };
}

const text = (value: unknown): string | null => (typeof value === "string" ? value.trim() : null);
const okProbe = (jellyfin: boolean) => ({ result: "ok" as const, httpStatus: 200, version: jellyfin ? JELLYFIN_VERSION : null, cors: jellyfin ? true : null, detail: null });

function linksReport(a: Addresses): ServerLinksReport {
  return {
    checkedAt: labAgo(MINUTE),
    tentacle: { url: a.publicUrl || null, source: a.publicUrl ? "config" : null, probe: a.publicUrl ? okProbe(false) : null },
    direct: {
      enabled: a.direct.enabled,
      publicUrl: a.direct.publicUrl || null,
      privateUrl: a.direct.privateUrl || null,
      publicProbe: a.direct.publicUrl ? okProbe(true) : null,
      privateProbe: a.direct.privateUrl ? okProbe(true) : null,
    },
    legacyClientsRelayed: false,
    jellyfinUrl: JELLYFIN_INTERNAL_URL,
  };
}

/** Le test mené depuis l'extérieur : les deux services ouverts en IPv4, l'IPv6 non testable d'ici. */
function checkReport(): RemoteCheckReport {
  const item = (service: "tentacle" | "jellyfin", host: string, family: 4 | 6): RemoteCheckReport["items"][number] => ({
    service, scheme: "https", port: 443, host, family,
    verdict: family === 4 ? "open" : "not_testable",
    httpStatus: family === 4 ? 200 : null,
    certificateExpires: family === 4 ? new Date(Date.now() + 61 * 24 * 3_600_000).toISOString() : null,
  });
  return {
    checkedAt: labAgo(0),
    outcome: "done",
    publicIp: { v4: PUBLIC_IP, v6: null },
    items: [
      item("tentacle", "tentacle.example.org", 4), item("tentacle", "tentacle.example.org", 6),
      item("jellyfin", "jellyfin.example.org", 4), item("jellyfin", "jellyfin.example.org", 6),
    ],
  };
}

export function linkRoutes(state: AdminState): readonly LabRoute[] {
  const addresses = seed(state);
  const settings: RemoteAccessState["settings"] = {
    enabled: true, proxy: state === "advice" ? "none" : "caddy", localUrl: LAN_TENTACLE, routerId: null,
  };
  let lastCheck: RemoteCheckReport | null = state === "advice" ? null : { ...checkReport(), checkedAt: labAgo(3 * 3_600_000) };

  const remoteAccess = (): RemoteAccessState => ({
    settings: { ...settings, enabled: addresses.publicUrl !== "" || addresses.direct.publicUrl !== "" },
    publicUrl: addresses.publicUrl || null,
    jellyfinPublicUrl: addresses.direct.publicUrl || null,
    hostPort: 3000,
    jellyfinHostPort: 8096,
    directPlay: { enabled: addresses.direct.enabled, privateUrl: addresses.direct.privateUrl || null, publicUrl: addresses.direct.publicUrl || null },
    deployment: "docker",
    stack: "full",
    checkServiceUrl: "https://check.example.org",
    lastCheck,
    derivedLocalUrl: LAN_TENTACLE,
    jellyfinCors: { status: "ready", origins: ORIGINS, added: [] },
  });

  const publicIp: PublicIpReport = {
    outcome: "found", v4: PUBLIC_IP, v6: null, source: lastCheck ? "check" : "echo", detectedAt: labAgo(8 * MINUTE), checkService: "online",
  };

  return [
    { path: "/api/admin/server-links", reply: () => linksReport(addresses) },
    { path: "/api/admin/public-url", reply: () => ({ publicUrl: addresses.publicUrl, effectiveUrl: addresses.publicUrl, envFallback: "" }) },
    {
      method: "PUT", path: "/api/admin/public-url",
      reply: ({ body }: LabRequest) => {
        addresses.publicUrl = text(record(body).publicUrl) ?? addresses.publicUrl;
        return { success: true };
      },
    },
    { path: "/api/admin/direct-streaming", reply: () => ({ ...addresses.direct }) },
    {
      method: "PUT", path: "/api/admin/direct-streaming",
      reply: ({ body }: LabRequest) => {
        const input = record(body);
        addresses.direct = {
          enabled: input.enabled === true,
          // `publicUrl: null` efface l'adresse publique ; absente, elle reste.
          publicUrl: input.publicUrl === null ? "" : (text(input.publicUrl) ?? addresses.direct.publicUrl),
          privateUrl: text(input.privateUrl) ?? addresses.direct.privateUrl,
        };
        return { success: true };
      },
    },
    {
      method: "POST", path: "/api/admin/test-direct-streaming",
      reply: ({ body }: LabRequest) => {
        const input = record(body);
        const probe = (url: unknown) => (text(url) ? { ok: true, version: JELLYFIN_VERSION, error: null, corsOk: true, sameOrigin: false } : null);
        return { public: probe(input.publicUrl), private: probe(input.privateUrl), cors: { status: "ready", origins: ORIGINS, added: [] } };
      },
    },
    { path: "/api/admin/remote-access", reply: remoteAccess },
    {
      method: "PUT", path: "/api/admin/remote-access",
      reply: ({ body }: LabRequest) => {
        const input = record(body);
        if (input.proxy === "caddy" || input.proxy === "traefik" || input.proxy === "other" || input.proxy === "none") settings.proxy = input.proxy;
        if (typeof input.localUrl === "string" || input.localUrl === null) settings.localUrl = input.localUrl;
        if (typeof input.routerId === "string" || input.routerId === null) settings.routerId = input.routerId;
        return remoteAccess();
      },
    },
    {
      method: "POST", path: "/api/admin/remote-access/check",
      reply: () => {
        lastCheck = checkReport();
        return lastCheck;
      },
    },
    { path: "/api/admin/remote-access/public-ip", reply: publicIp },
  ];
}
