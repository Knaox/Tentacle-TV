/**
 * Les Jellyfin que le faux serveur « voit » pendant l'installation, et ce qu'on lit de celui
 * qu'on a choisi : ses dossiers, ses bibliothèques, ses réglages conseillés. Formes :
 * `packages/shared/src/setupWizard/setup{Discovery,Library}Contract.ts` et
 * `jellyfinCompat/setupContract.ts` (`JellyfinSetupReport`).
 */

import type {
  BrowseResult, DiscoveredJellyfin, ExistingLibrary, JellyfinProbeResult, JellyfinSetupReport, SegmentSetupRun, SetupCheck,
} from "@tentacle-tv/shared";

/** Le Jellyfin de la pile complète : neuf, verrouillé par Tentacle en attendant le compte choisi. */
export const STACK_JELLYFIN: DiscoveredJellyfin = {
  url: "http://jellyfin:8096",
  serverId: "5c1f0a7d93b24e6f8a1d2c3b4e5f6071",
  version: "10.11.4",
  serverName: "Jellyfin de la pile",
  blank: true,
  inStack: true,
  compatible: true,
  clientUrl: "http://192.0.2.10:8096",
  source: "stack",
};

/** Un Jellyfin du réseau, déjà configuré : on s'y connecte, rien n'y est créé. */
const LIVING_ROOM: DiscoveredJellyfin = {
  url: "http://192.0.2.40:8096",
  serverId: "a94e3d17c6b8402f9e5a1b7c8d6f2e30",
  version: "10.11.2",
  serverName: "Médiathèque du salon",
  blank: false,
  inStack: false,
  compatible: true,
  clientUrl: "http://192.0.2.40:8096",
  source: "udp",
};

/** Un vieux Jellyfin, trop ancien pour ce serveur : montré, jamais choisissable. */
const ATTIC_NAS: DiscoveredJellyfin = {
  url: "http://192.0.2.77:8096",
  serverId: "0d2b6f48e1a94c73b5d8f6a2c9e41b57",
  version: "10.8.13",
  serverName: "NAS du grenier",
  blank: false,
  inStack: false,
  compatible: false,
  clientUrl: "http://192.0.2.77:8096",
  source: "scan",
};

export const DISCOVERED: readonly DiscoveredJellyfin[] = [STACK_JELLYFIN, LIVING_ROOM, ATTIC_NAS];

/** La sonde d'une adresse : un Jellyfin connu, sinon (adresse saisie à la main) un Jellyfin déjà configuré à cette adresse. */
export function probeOf(url: string): JellyfinProbeResult {
  const clean = url.trim().replace(/\/+$/, "");
  const { source: _source, ...known } = DISCOVERED.find((server) => server.url === clean) ?? {
    ...LIVING_ROOM,
    url: clean,
    serverId: `manual-${clean}`,
    serverName: "Jellyfin",
    clientUrl: clean,
  };
  return known;
}

/** Les dossiers que voit Jellyfin (un conteneur : des chemins Linux). */
const TREE: Readonly<Record<string, readonly string[]>> = {
  "/": ["config", "cache", "media"],
  "/media": ["films", "series", "animes", "musique", "documentaires"],
  "/media/films": ["Sintel (2010)", "Big Buck Bunny (2008)", "Tears of Steel (2012)", "Cosmos Laundromat (2015)", "Spring (2019)"],
  "/media/series": ["Caminandes", "Agent 327"],
};

export function browse(path: string | null): BrowseResult {
  const at = path && path !== "/" ? path.replace(/\/+$/, "") : "/";
  const join = (name: string) => (at === "/" ? `/${name}` : `${at}/${name}`);
  const parent = at === "/" ? null : at.slice(0, at.lastIndexOf("/")) || "/";
  return {
    path: at === "/" ? null : at,
    parent: at === "/" ? null : parent,
    entries: (TREE[at] ?? []).map((name) => ({ name, path: join(name) })),
    style: "posix",
  };
}

/** Les bibliothèques d'un Jellyfin déjà configuré. */
export const EXISTING_LIBRARIES: readonly ExistingLibrary[] = [
  { name: "Films", type: "movies", paths: ["/srv/medias/films"] },
  { name: "Séries", type: "tvshows", paths: ["/srv/medias/series"] },
  { name: "Animés", type: "tvshows", paths: ["/srv/medias/animes"] },
  { name: "Musique", type: "music", paths: ["/srv/medias/musique"] },
];

const NOTHING = { libraries: null, current: null, missingTmdb: null, plugins: null, task: null, trailers: null, action: null } as const;
const DASHBOARD = {
  libraries: "/web/#/dashboard/libraries",
  metadata: "/web/#/dashboard/libraries/metadata",
  transcoding: "/web/#/dashboard/playback/transcoding",
  plugins: "/web/#/dashboard/plugins",
} as const;

const perLibrary = (films: boolean, series: boolean, animes: boolean) => [
  { id: "lib-films", name: "Films", enabled: films },
  { id: "lib-series", name: "Séries", enabled: series },
  { id: "lib-animes", name: "Animés", enabled: animes },
];

/** Les réglages du Jellyfin déjà configuré : de quoi remplir l'écran « Réglages conseillés ». */
const CHECKS: SetupCheck[] = [
  { ...NOTHING, id: "metadataTmdb", level: "essential", state: "done", missingTmdb: 3, dashboardPath: DASHBOARD.libraries },
  // Réglée autrement par l'administrateur : montrée, jamais cochée d'office.
  { ...NOTHING, id: "metadataLanguage", level: "recommended", state: "done", current: "en · US", action: "setMetadataLanguage", dashboardPath: DASHBOARD.metadata },
  { ...NOTHING, id: "trickplay", level: "recommended", state: "todo", libraries: perLibrary(true, false, false), action: "enableTrickplay", dashboardPath: DASHBOARD.libraries },
  {
    ...NOTHING, id: "segmentsProvider", level: "recommended", state: "todo", dashboardPath: DASHBOARD.plugins,
    plugins: [
      { name: "Intro Skipper", state: "active", official: false, homepage: "https://intro-skipper.org", repositoryUrl: "https://intro-skipper.org/manifest.json" },
      { name: "TheIntroDB", state: "missing", official: false, homepage: "https://theintrodb.org", repositoryUrl: null },
      { name: "SkipMe.db", state: "missing", official: false, homepage: "https://intro-skipper.org", repositoryUrl: "https://intro-skipper.org/manifest.json" },
    ],
  },
  { ...NOTHING, id: "realtimeMonitor", level: "recommended", state: "todo", libraries: perLibrary(true, true, false), action: "enableRealtimeMonitor", dashboardPath: DASHBOARD.libraries },
  { ...NOTHING, id: "libraryUpdateDelay", level: "recommended", state: "todo", current: "30 s", action: "shortenLibraryUpdateDelay", dashboardPath: DASHBOARD.libraries },
  { ...NOTHING, id: "hevcEncoding", level: "recommended", state: "todo", current: "off", action: "enableHevcEncoding", dashboardPath: DASHBOARD.transcoding },
  { ...NOTHING, id: "hardwareAcceleration", level: "optional", state: "done", current: "vaapi", dashboardPath: DASHBOARD.transcoding },
  { ...NOTHING, id: "chapterImages", level: "optional", state: "not-needed", dashboardPath: DASHBOARD.libraries },
];

export function recommendedReport(): JellyfinSetupReport {
  return {
    checkedAt: new Date().toISOString(),
    jellyfinVersion: LIVING_ROOM.version,
    dashboardUrl: LIVING_ROOM.url,
    restartPending: false,
    error: null,
    checks: CHECKS,
  };
}

/** La détection des passages : un passage déjà fini (les trois greffons en place, Jellyfin redémarré). */
export function segmentRun(): SegmentSetupRun {
  const now = Date.now();
  return {
    phase: "done",
    running: false,
    startedAt: new Date(now - 48_000).toISOString(),
    finishedAt: new Date(now).toISOString(),
    plugins: [
      { key: "introSkipper", outcome: "present" },
      { key: "theIntroDb", outcome: "installed" },
      { key: "skipMeDb", outcome: "installed" },
    ],
    restart: "done",
    configured: true,
    error: null,
  };
}
