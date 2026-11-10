/**
 * Les EXTENSIONS vues de l'administration (`/api/plugins`, hors `/api/plugins/active` du
 * socle) : cinq installées — dont une avec une mise à jour publiée et une désactivée —, un
 * catalogue de sept, deux sources. État en mémoire : activer, mettre à jour, désinstaller,
 * couper une source se relisent. Aucune extension n'est refusée ni n'attend de redémarrage :
 * la vue d'ensemble « tout va bien » reste vraie.
 * Formes : `components/admin-plugins/types.ts`.
 */

import type { LabRoute } from "../labFetch";
import { labAgo } from "./accountPairing";
import type { AdminState } from "./adminServer";
import { record, type LabRequest } from "./settingsShared";

const DAY = 24 * 3_600_000;
const OFFICIAL = "src-official";
const MIRROR = "src-atelier";

interface LabPlugin {
  id: string;
  pluginId: string;
  name: string;
  version: string;
  sourceId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  installedAt: string;
  hasBundle: boolean;
  navItems: Array<{ path: string; icon: string; platforms: string[]; admin?: boolean; labels?: Record<string, string> }>;
  serverModule: { state: "none" | "running" | "failed" | "idle" };
  restartRequired: boolean;
  restartsOn: { update: boolean; uninstall: boolean };
}

interface LabCatalogEntry {
  pluginId: string;
  name: string;
  version: string;
  description: string;
  author: string;
  sourceId: string;
  category: string;
  tags: string[];
  changelog: string;
  releasedAgo: number;
}

const CATALOG: readonly LabCatalogEntry[] = [
  {
    pluginId: "seer", name: "Vigie", version: "1.26.0", author: "Tentacle TV", sourceId: OFFICIAL, category: "requests", tags: ["demandes", "découverte"],
    description: "Demander un film ou une série absents de la bibliothèque, et suivre leur arrivée.",
    changelog: "### FR\n- Les saisons manquantes d'une série se demandent depuis la recherche.\n- « Mes demandes » suit l'avancement en direct.\n\n### EN\n- Missing seasons can be requested from search.\n- “My requests” follows progress live.",
    releasedAgo: 4,
  },
  {
    pluginId: "octave", name: "Octave", version: "0.9.4", author: "Tentacle TV", sourceId: OFFICIAL, category: "music", tags: ["musique", "hors ligne"],
    description: "La musique de la bibliothèque : albums, playlists, paroles et écoute hors ligne.",
    changelog: "### FR\n- Les playlists se gardent hors ligne.\n\n### EN\n- Playlists can be kept offline.",
    releasedAgo: 18,
  },
  {
    pluginId: "calendar", name: "Calendrier des sorties", version: "2.3.1", author: "Atelier Lumen", sourceId: MIRROR, category: "discovery", tags: ["séries", "agenda"],
    description: "Les prochains épisodes des séries suivies, semaine par semaine.",
    changelog: "### FR\n- Vue « ce soir ».\n\n### EN\n- “Tonight” view.",
    releasedAgo: 41,
  },
  {
    pluginId: "stats", name: "Statistiques", version: "1.4.0", author: "Atelier Lumen", sourceId: MIRROR, category: "tools", tags: ["tableau de bord"],
    description: "Le temps de visionnage par compte, par bibliothèque et par appareil.",
    changelog: "### FR\n- Export CSV.\n\n### EN\n- CSV export.",
    releasedAgo: 77,
  },
  {
    pluginId: "subtitles", name: "Sous-titres à la demande", version: "0.7.2", author: "Collectif Bobine", sourceId: MIRROR, category: "tools", tags: ["sous-titres"],
    description: "Chercher et ajouter des sous-titres depuis la fiche d'un titre.",
    changelog: "### FR\n- Recherche par empreinte du fichier.\n\n### EN\n- Search by file hash.",
    releasedAgo: 9,
  },
  {
    pluginId: "collections", name: "Collections automatiques", version: "1.1.0", author: "Collectif Bobine", sourceId: MIRROR, category: "library", tags: ["sagas", "bibliothèque"],
    description: "Regroupe les sagas et les univers en collections, sans rien toucher aux fichiers.",
    changelog: "### FR\n- Première version.\n\n### EN\n- First release.",
    releasedAgo: 120,
  },
  {
    pluginId: "notify", name: "Notifications", version: "3.0.0", author: "Tentacle TV", sourceId: OFFICIAL, category: "tools", tags: ["alertes"],
    description: "Prévient par courriel ou par webhook quand un titre demandé est arrivé.",
    changelog: "### FR\n- Modèles de message.\n\n### EN\n- Message templates.",
    releasedAgo: 2,
  },
];

function plugin(pluginId: string, version: string, installedAgo: number, more: Partial<LabPlugin> = {}): LabPlugin {
  const entry = CATALOG.find((candidate) => candidate.pluginId === pluginId);
  return {
    id: `pl-${pluginId}`, pluginId, name: entry?.name ?? pluginId, version, sourceId: entry?.sourceId ?? OFFICIAL, enabled: true,
    config: { enabled: true }, installedAt: labAgo(installedAgo * DAY), hasBundle: true, navItems: [],
    serverModule: { state: "running" }, restartRequired: false, restartsOn: { update: true, uninstall: true }, ...more,
  };
}

function seedInstalled(): LabPlugin[] {
  return [
    // Une mise à jour est publiée (1.26.0 au catalogue).
    plugin("seer", "1.25.0", 96, {
      navItems: [
        { path: "/plugins/seer", icon: "compass", platforms: ["web", "desktop", "mobile"], labels: { fr: "Vigie", en: "Vigie" } },
        { path: "/admin/plugins/seer", icon: "compass", platforms: ["web", "desktop"], admin: true, labels: { fr: "Vigie", en: "Vigie" } },
      ],
    }),
    plugin("octave", "0.9.4", 58, { navItems: [{ path: "/music", icon: "music", platforms: ["web", "desktop", "mobile"], labels: { fr: "Octave", en: "Octave" } }] }),
    plugin("calendar", "2.3.1", 40, { serverModule: { state: "none" }, restartsOn: { update: false, uninstall: false } }),
    // Désactivée : son module serveur est présent, pas chargé.
    plugin("stats", "1.4.0", 30, { enabled: false, config: {}, serverModule: { state: "idle" } }),
    plugin("subtitles", "0.7.2", 6),
  ];
}

const SOURCES = [
  { id: OFFICIAL, name: "Tentacle TV — officiel", url: "https://plugins.example.org/registry.json", official: true, enabled: true, plugins: 3 },
  { id: MIRROR, name: "Atelier Lumen", url: "https://atelier-lumen.example.org/tentacle/registry.json", official: false, enabled: true, plugins: 4 },
];

const idOf = (url: URL, index: number): string => decodeURIComponent(url.pathname.split("/")[index] ?? "");

export function pluginRoutes(state: AdminState): readonly LabRoute[] {
  const installed = state === "empty" ? [] : seedInstalled();
  const sources = SOURCES.map((source) => ({ ...source }));
  const byId = (id: string) => installed.find((entry) => entry.id === id || entry.pluginId === id);

  const marketplace = () => CATALOG.map(({ releasedAgo, ...entry }) => {
    const mine = installed.find((candidate) => candidate.pluginId === entry.pluginId);
    const source = sources.find((candidate) => candidate.id === entry.sourceId);
    return {
      ...entry,
      sourceName: source?.name ?? "",
      official: source?.official ?? false,
      installed: mine !== undefined,
      installedId: mine?.id,
      installedVersion: mine?.version,
      updateAvailable: mine !== undefined && mine.version !== entry.version,
      platforms: ["web", "desktop", "mobile"],
      releaseDate: labAgo(releasedAgo * DAY),
      minAppVersion: "1.25.0",
      incompatible: false,
    };
  });
  const sourceView = () => sources.map(({ plugins, ...source }) => ({
    ...source,
    registry: { checkedAt: labAgo(25 * 60_000), fetchedAt: labAgo(25 * 60_000), pluginCount: plugins },
  }));

  return [
    { path: "/api/plugins", reply: () => installed },
    { path: "/api/plugins/marketplace", reply: marketplace },
    { path: "/api/plugins/sources", reply: sourceView },
    { method: "POST", path: "/api/plugins/sources/refresh", reply: () => ({ refreshed: sources.length, plugins: CATALOG.length, failed: 0, sources: sourceView() }) },
    {
      method: "POST", path: "/api/plugins/sources",
      reply: ({ body }: LabRequest) => {
        const input = record(body);
        const made = {
          id: `src-${sources.length + 1}`, name: typeof input.name === "string" && input.name ? input.name : "Nouvelle source",
          url: typeof input.url === "string" ? input.url : "https://example.org/registry.json", official: false, enabled: true, plugins: 0,
        };
        sources.push(made);
        return { id: made.id, name: made.name, url: made.url, official: false, enabled: true };
      },
    },
    {
      method: "PUT", path: /^\/api\/plugins\/sources\/[^/]+\/toggle$/,
      reply: ({ url }: LabRequest) => {
        const source = sources.find((entry) => entry.id === idOf(url, 4));
        if (source) source.enabled = !source.enabled;
        return { success: true };
      },
    },
    {
      method: "DELETE", path: /^\/api\/plugins\/sources\/[^/]+$/,
      reply: ({ url }: LabRequest) => {
        const index = sources.findIndex((entry) => entry.id === idOf(url, 4));
        if (index >= 0) sources.splice(index, 1);
        return { success: true };
      },
    },
    {
      method: "POST", path: "/api/plugins/install",
      reply: ({ body }: LabRequest) => {
        const wanted = record(body).pluginId;
        const entry = CATALOG.find((candidate) => candidate.pluginId === wanted) ?? CATALOG[CATALOG.length - 1];
        const made = plugin(entry.pluginId, entry.version, 0);
        if (!byId(made.id)) installed.push(made);
        return { ...made, restartScheduled: false };
      },
    },
    { method: "POST", path: "/api/plugins/restart", reply: { restartScheduled: false } },
    {
      method: "POST", path: /^\/api\/plugins\/[^/]+\/update$/,
      reply: ({ url }: LabRequest) => {
        const target = byId(idOf(url, 3));
        const entry = CATALOG.find((candidate) => candidate.pluginId === target?.pluginId);
        if (target && entry) target.version = entry.version;
        return { restartScheduled: false };
      },
    },
    {
      method: "PUT", path: /^\/api\/plugins\/[^/]+\/toggle$/,
      reply: ({ url }: LabRequest) => {
        const target = byId(idOf(url, 3));
        if (!target) return { success: false };
        target.enabled = !target.enabled;
        if (target.serverModule.state !== "none") target.serverModule = { state: target.enabled ? "running" : "idle" };
        return target;
      },
    },
    { method: "PUT", path: /^\/api\/plugins\/[^/]+\/tools\/[^/]+$/, reply: { success: true } },
    {
      method: "DELETE", path: /^\/api\/plugins\/[^/]+$/,
      reply: ({ url }: LabRequest) => {
        const index = installed.findIndex((entry) => entry.id === idOf(url, 3));
        if (index >= 0) installed.splice(index, 1);
        return { restartScheduled: false };
      },
    },
  ];
}
