/**
 * JELLYFIN vu de l'administration : la compatibilité de la version installée
 * (`/api/admin/jellyfin/compat`), les réglages conseillés (`/setup`) et la détection des
 * passages (`/segment-plugins`).
 *
 * - `healthy` : version éprouvée, tous les réglages faits, les trois greffons actifs ;
 * - `advice` : quatre réglages à faire (langue, vignettes, surveillance, annonce des ajouts)
 *   et deux greffons de passages manquants — les entrées « Jellyfin » et « passages » ;
 * - `broken` : la clé est refusée — Jellyfin ne se lit pas (`error: "rejected"`).
 *
 * Formes : `jellyfinCompat/setupContract.ts`, `compatReport.ts`, `segmentPlugins/` (shared).
 */

import type {
  CompatFeatureView, JellyfinCompatReport, JellyfinSetupReport, SegmentSetupRun, SetupCheck, SetupLevel, SetupPlugin, SetupState,
} from "@tentacle-tv/shared";
import type { LabRoute } from "../labFetch";
import { labAgo } from "./accountPairing";
import { JELLYFIN_VERSION, type AdminState } from "./adminServer";

const MINUTE = 60_000;
const DAY = 24 * 3_600_000;
const DASHBOARD_URL = "http://192.168.1.20:8096";
const PAGES = {
  libraries: "/web/#/dashboard/libraries",
  metadata: "/web/#/dashboard/libraries/metadata",
  transcoding: "/web/#/dashboard/playback/transcoding",
  plugins: "/web/#/dashboard/plugins",
} as const;

function check(id: SetupCheck["id"], level: SetupLevel, state: SetupState, page: string, more: Partial<SetupCheck> = {}): SetupCheck {
  return { id, level, state, libraries: null, current: null, missingTmdb: null, plugins: null, task: null, trailers: null, action: null, dashboardPath: page, ...more };
}

const perLibrary = (films: boolean, series: boolean, animes: boolean) => [
  { id: "lib-films", name: "Films", enabled: films },
  { id: "lib-series", name: "Séries", enabled: series },
  { id: "lib-animes", name: "Animés", enabled: animes },
];

function segmentPlugins(allActive: boolean): SetupPlugin[] {
  const repository = "https://intro-skipper.org/manifest.json";
  return [
    { name: "Intro Skipper", state: "active", official: false, homepage: "https://intro-skipper.org", repositoryUrl: repository },
    { name: "TheIntroDB", state: allActive ? "active" : "missing", official: false, homepage: "https://theintrodb.org", repositoryUrl: null },
    { name: "SkipMe.db", state: allActive ? "active" : "missing", official: false, homepage: "https://intro-skipper.org", repositoryUrl: repository },
  ];
}

function checks(todo: boolean): SetupCheck[] {
  const state: SetupState = todo ? "todo" : "done";
  return [
    check("metadataTmdb", "essential", "done", PAGES.libraries, { missingTmdb: todo ? 14 : 0 }),
    check("metadataLanguage", "recommended", state, PAGES.metadata, { current: todo ? null : "fr · FR", action: todo ? "setMetadataLanguage" : null }),
    check("trailers", "recommended", "done", PAGES.libraries, {
      trailers: { titles: 1284, withTmdb: 1270, withTrailer: todo ? 912 : 1173, sampled: false, tmdbBlocked: false, jellyseerr: true, refreshing: false, compatGaps: [] },
    }),
    check("trickplay", "recommended", state, PAGES.libraries, {
      libraries: todo ? perLibrary(true, false, false) : perLibrary(true, true, true),
      action: todo ? "enableTrickplay" : null,
      task: { state: "idle", progress: null, lastRunAt: labAgo(9 * 3_600_000), lastStatus: "Completed" },
    }),
    check("segmentsProvider", "recommended", state, PAGES.plugins, { plugins: segmentPlugins(!todo) }),
    check("realtimeMonitor", "recommended", state, PAGES.libraries, {
      libraries: todo ? perLibrary(true, true, false) : perLibrary(true, true, true),
      action: todo ? "enableRealtimeMonitor" : null,
    }),
    check("libraryUpdateDelay", "recommended", state, PAGES.libraries, { current: todo ? "30 s" : "5 s", action: todo ? "shortenLibraryUpdateDelay" : null }),
    check("hevcEncoding", "recommended", "done", PAGES.transcoding, { current: "on" }),
    check("hardwareAcceleration", "optional", "done", PAGES.transcoding, { current: "vaapi" }),
    check("chapterImages", "optional", "not-needed", PAGES.libraries),
  ];
}

function setupReport(state: AdminState): JellyfinSetupReport {
  const base = { checkedAt: labAgo(MINUTE), dashboardUrl: DASHBOARD_URL, restartPending: false };
  if (state === "broken") return { ...base, jellyfinVersion: null, error: "rejected", checks: [] };
  return { ...base, jellyfinVersion: JELLYFIN_VERSION, error: null, checks: checks(state === "advice") };
}

const AREAS = {
  auth: { fr: "Connexion", en: "Sign-in" },
  library: { fr: "Bibliothèque", en: "Library" },
  playback: { fr: "Lecture", en: "Playback" },
  admin: { fr: "Administration", en: "Administration" },
};

function feature(id: string, area: keyof typeof AREAS, critical: boolean, fr: string, en: string, endpoints: string[]): CompatFeatureView {
  return {
    id, area, critical, label: { fr, en }, state: "ok", note: null, since: null, endpoints,
    probe: endpoints.length > 0 ? { state: "present", missing: [] } : null,
  };
}

const FEATURES: CompatFeatureView[] = [
  feature("auth.login", "auth", true, "Connexion par mot de passe", "Password sign-in", ["POST /Users/AuthenticateByName"]),
  feature("auth.quickConnect", "auth", false, "Quick Connect", "Quick Connect", ["POST /QuickConnect/Initiate"]),
  feature("library.browse", "library", true, "Parcourir les bibliothèques", "Browse libraries", ["GET /Items", "GET /UserViews"]),
  feature("library.search", "library", false, "Recherche", "Search", ["GET /Items"]),
  feature("library.liveAdds", "library", false, "Ajouts en direct", "Live additions", []),
  feature("playback.directPlay", "playback", true, "Lecture directe", "Direct play", ["POST /Items/{itemId}/PlaybackInfo"]),
  feature("playback.transcoding", "playback", true, "Transcodage HLS", "HLS transcoding", ["GET /Videos/{itemId}/master.m3u8"]),
  feature("playback.trickplay", "playback", false, "Vignettes de la barre de lecture", "Trickplay thumbnails", ["GET /Videos/{itemId}/Trickplay/{width}/tiles.m3u8"]),
  feature("playback.segments", "playback", false, "Passages (intro, générique)", "Media segments", ["GET /MediaSegments/{itemId}"]),
  feature("admin.users", "admin", true, "Comptes et droits", "Accounts and rights", ["GET /Users", "POST /Users/{userId}/Policy"]),
  feature("admin.sessions", "admin", false, "Sessions en direct", "Live sessions", ["GET /Sessions"]),
];

function compatReport(state: AdminState): JellyfinCompatReport {
  const manifest = {
    revision: 42, generatedAt: labAgo(12 * DAY), source: "embedded" as const, remoteCheckedAt: labAgo(5 * 3_600_000), remoteError: null,
    testedVersions: ["10.10.7", "10.11.5", "10.11.6", "12.1.0"], areas: AREAS,
  };
  const head = { checkedAt: labAgo(MINUTE), tentacleServer: "1.41.0", manifest, latestError: null };
  if (state === "broken") return { ...head, installed: null, installedError: "rejected", latest: null };
  const view = {
    version: JELLYFIN_VERSION, status: "compatible" as const, reason: "tested" as const,
    basis: { version: JELLYFIN_VERSION, verdict: "ok" as const, ranAt: labAgo(12 * DAY), tentacleServer: "1.41.0" },
    line: "10.11", minTentacle: null, tentacleTooOld: false, features: FEATURES,
  };
  return {
    ...head,
    installed: { ...view, serverName: "Médiathèque de la maison", probes: "ok" },
    installedError: null,
    latest: {
      ...view, tag: `v${JELLYFIN_VERSION}`, publishedAt: labAgo(33 * DAY),
      url: `https://github.com/jellyfin/jellyfin/releases/tag/v${JELLYFIN_VERSION}`, newer: false, checkedAt: labAgo(5 * 3_600_000),
    },
  };
}

/** Le dernier passage de « Installer / réparer » : fini (tout en place), ou jamais lancé. */
function segmentRun(state: AdminState, ranNow = false): SegmentSetupRun {
  const never = state === "advice" && !ranNow;
  return {
    phase: never ? "idle" : "done",
    running: false,
    startedAt: never ? null : labAgo(ranNow ? 40_000 : 20 * DAY),
    finishedAt: never ? null : labAgo(ranNow ? 0 : 20 * DAY - 52_000),
    plugins: [
      { key: "introSkipper", outcome: never ? null : "present" },
      { key: "theIntroDb", outcome: never ? null : "installed" },
      { key: "skipMeDb", outcome: never ? null : "installed" },
    ],
    restart: never ? null : "done",
    configured: never ? null : true,
    error: null,
  };
}

export function jellyfinRoutes(state: AdminState): readonly LabRoute[] {
  // Un geste appliqué ou un passage réussi : les réglages relus sont faits.
  let fixed = false;
  const current = (): AdminState => (fixed && state === "advice" ? "healthy" : state);
  return [
    { path: "/api/admin/jellyfin/compat", reply: () => compatReport(state) },
    { path: "/api/admin/jellyfin/setup", reply: () => setupReport(current()) },
    {
      method: "POST", path: "/api/admin/jellyfin/setup/apply",
      reply: () => {
        fixed = true;
        return { changed: 1, report: setupReport(current()) };
      },
    },
    { method: "POST", path: "/api/admin/jellyfin/compat/refresh", reply: () => compatReport(state) },
    { path: "/api/admin/jellyfin/segment-plugins", reply: () => segmentRun(state, fixed) },
    {
      method: "POST", path: "/api/admin/jellyfin/segment-plugins",
      reply: () => {
        fixed = true;
        return segmentRun(state, true);
      },
    },
  ];
}
