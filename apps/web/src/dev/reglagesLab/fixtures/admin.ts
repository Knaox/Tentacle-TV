/**
 * L'ADMINISTRATION du faux serveur : tout `/api/admin/*`, `/api/plugins*` (hors
 * `/api/plugins/active`, au socle), `/api/invites*`, `/api/tickets/all`, `/api/health` et les
 * rappels masqués du compte (`/api/preferences/hints`).
 *
 * L'état de la vue (`labViews.ts` › `state`) règle la vue d'ensemble — la règle est
 * `buildAdminAttention` (shared) :
 * - `healthy` (le défaut) : rien à régler, aucune recommandation, serveur à jour ;
 * - `broken` : DEUX « À régler » — la clé d'administration refusée par Jellyfin, et une mise à
 *   jour obligatoire du serveur ; aucune recommandation (ce qui dépend de Jellyfin se tait) ;
 * - `advice` : aucun « À régler », cinq recommandations — lien public sans HTTPS, clé TMDB
 *   absente, réglages de Jellyfin, greffons de passages, lecture directe ;
 * - `empty` : un serveur tout neuf (un seul compte, aucune liste).
 *
 * Ici : les métadonnées, les bandes-annonces, le débit des transferts et les rappels ; le reste
 * dans `adminServer`, `adminLinks`, `adminJellyfin`, `adminPeople`, `adminActivity`, `adminPlugins`.
 */

import { DISMISSIBLE_HINTS, isDismissibleHint, type DismissedHintsResponse, type DismissibleHint } from "@tentacle-tv/shared";
import type { LabRoute } from "../labFetch";
import type { LabView } from "../labViews";
import { labAgo } from "./accountPairing";
import { activityRoutes } from "./adminActivity";
import { jellyfinRoutes } from "./adminJellyfin";
import { linkRoutes } from "./adminLinks";
import { peopleRoutes } from "./adminPeople";
import { pluginRoutes } from "./adminPlugins";
import { serverRoutes, type AdminState } from "./adminServer";
import { record, type LabRequest } from "./settingsShared";

const MINUTE = 60_000;

/** Les pays où TMDB connaît des plateformes, et leurs plateformes (aperçu avant d'enregistrer). */
const REGIONS = [
  { code: "FR", providers: 41 }, { code: "BE", providers: 33 }, { code: "CH", providers: 36 }, { code: "CA", providers: 58 },
  { code: "LU", providers: 12 }, { code: "DE", providers: 62 }, { code: "ES", providers: 47 }, { code: "IT", providers: 44 },
  { code: "GB", providers: 71 }, { code: "US", providers: 118 },
];
const PROVIDERS = ["Canal Ciné", "Lumière+", "Écran Libre", "Studio 9", "Bobine", "Arte Kino", "Médiathèque numérique"];

function metadataRoutes(state: AdminState): readonly LabRoute[] {
  const tmdb = state === "advice"
    ? { configured: false, source: null as "db" | null, last4: null as string | null }
    : { configured: true, source: "db" as "db" | null, last4: "9f3c" as string | null };
  let watchRegion = "FR";
  const trailers = { allocine: true };

  return [
    {
      path: "/api/admin/metadata",
      reply: () => ({ tmdb, watchRegion, fanout: { running: false, processed: 8, total: 8, failed: 0, finishedAt: labAgo(26 * MINUTE) } }),
    },
    {
      method: "PUT", path: "/api/admin/metadata",
      reply: ({ body }: LabRequest) => {
        const input = record(body);
        if (typeof input.watchRegion === "string") watchRegion = input.watchRegion;
        if (typeof input.tmdbApiKey === "string") {
          const key = input.tmdbApiKey.trim();
          Object.assign(tmdb, key ? { configured: true, source: "db", last4: key.slice(-4) } : { configured: false, source: null, last4: null });
        }
        return { ok: true };
      },
    },
    { method: "POST", path: "/api/admin/metadata/tmdb/test", reply: { result: "valid" } },
    { path: "/api/admin/metadata/regions", reply: () => ({ regions: tmdb.configured ? REGIONS : [] }) },
    {
      path: /^\/api\/admin\/metadata\/regions\/[A-Z]{2}$/,
      reply: ({ url }: LabRequest) => {
        const region = url.pathname.slice(-2);
        const count = 3 + (region.charCodeAt(0) + region.charCodeAt(1)) % 5;
        return { region, providers: PROVIDERS.slice(0, count).map((name, index) => ({ id: 100 + index, name, logoPath: null })) };
      },
    },
    {
      path: "/api/admin/trailers",
      reply: () => ({
        ...trailers, allocineAvailable: true, language: "fr",
        // Dailymotion en pause (trop de demandes) : elle se lève seule.
        sources: { youtube: { state: "normal" }, dailymotion: { state: "paused", until: Date.now() + 25 * MINUTE, reason: "limit" } },
      }),
    },
    {
      method: "PUT", path: "/api/admin/trailers",
      reply: ({ body }: LabRequest) => {
        if (typeof record(body).allocine === "boolean") trailers.allocine = record(body).allocine === true;
        return { ok: true };
      },
    },
  ];
}

/** Les plafonds de débit des transferts (octets par seconde ; `null` : illimité). */
function bandwidthRoutes(): readonly LabRoute[] {
  let caps: unknown = { external: 2_500_000, internal: null, internalIps: ["192.168.1.0/24"] };
  return [
    { path: "/api/admin/downloads/bandwidth", reply: () => caps },
    {
      method: "PUT", path: "/api/admin/downloads/bandwidth",
      reply: ({ body }: LabRequest) => {
        caps = body ?? caps;
        return caps;
      },
    },
  ];
}

/** Les rappels masqués du compte — aucun au départ : chaque recommandation se montre. */
function hintRoutes(): readonly LabRoute[] {
  const dismissed = new Set<DismissibleHint>();
  const marks: Partial<Record<DismissibleHint, string>> = {};
  const response = (): DismissedHintsResponse => ({
    dismissed: DISMISSIBLE_HINTS.filter((hint) => dismissed.has(hint)), marks: { ...marks }, known: [...DISMISSIBLE_HINTS],
  });
  return [
    { path: "/api/preferences/hints", reply: response },
    {
      method: "PUT", path: /^\/api\/preferences\/hints\/[^/]+$/,
      reply: ({ url, body }: LabRequest) => {
        const hint = decodeURIComponent(url.pathname.split("/").pop() ?? "");
        const input = record(body);
        if (isDismissibleHint(hint)) {
          delete marks[hint];
          if (input.dismissed === true) {
            dismissed.add(hint);
            if (typeof input.mark === "string") marks[hint] = input.mark;
          } else {
            dismissed.delete(hint);
          }
        }
        return response();
      },
    },
  ];
}

export function adminRoutes(view: LabView): readonly LabRoute[] {
  const state: AdminState = view.state ?? "healthy";
  return [
    ...serverRoutes(state), ...linkRoutes(state), ...jellyfinRoutes(state), ...peopleRoutes(state), ...activityRoutes(state),
    ...pluginRoutes(state), ...metadataRoutes(state), ...bandwidthRoutes(), ...hintRoutes(),
  ];
}
