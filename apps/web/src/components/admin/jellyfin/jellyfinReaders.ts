import type {
  CompatBasis,
  CompatFeatureView,
  CompatStatus,
  CompatVersionView,
  FeatureProbe,
  InstalledJellyfin,
  JellyfinCompatReport,
  JellyfinSetupReport,
  LatestJellyfin,
  LocalizedText,
  SetupCheck,
  SetupCheckId,
  SetupTrailers,
} from "@tentacle-tv/shared";

/**
 * Les réponses de `/api/admin/jellyfin/compat` et `/setup`, relues avant
 * d'être montrées. L'application de bureau embarque ces pages et parle à des
 * serveurs de toutes versions : une forme inattendue vaut « illisible » (la
 * carte le dit), jamais une page qui tombe. Sans `fetch` : ce module se teste
 * seul.
 */

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const isText = (value: unknown): value is LocalizedText => isRecord(value) && typeof value.fr === "string" && typeof value.en === "string";

const STATUSES: readonly CompatStatus[] = ["compatible", "partial", "presumed", "untested", "incompatible"];
const CHECK_IDS: readonly SetupCheckId[] = [
  "metadataTmdb", "metadataLanguage", "trailers", "trickplay", "segmentsProvider", "realtimeMonitor", "hardwareAcceleration", "chapterImages",
];

function readFeature(raw: unknown): CompatFeatureView | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !isText(raw.label) || typeof raw.state !== "string") return null;
  const probeState = isRecord(raw.probe) ? raw.probe.state : null;
  const missing = isRecord(raw.probe) && Array.isArray(raw.probe.missing) ? raw.probe.missing.filter((e): e is string => typeof e === "string") : [];
  const probe: FeatureProbe | null = probeState === "present" || probeState === "missing" ? { state: probeState, missing } : null;
  return {
    id: raw.id,
    area: text(raw.area) ?? "",
    critical: raw.critical === true,
    label: raw.label,
    state: raw.state as CompatFeatureView["state"],
    note: isText(raw.note) ? raw.note : null,
    since: text(raw.since),
    endpoints: Array.isArray(raw.endpoints) ? raw.endpoints.filter((e): e is string => typeof e === "string") : [],
    probe,
  };
}

function readVersionView(raw: Json): CompatVersionView | null {
  if (typeof raw.version !== "string" || !STATUSES.includes(raw.status as CompatStatus)) return null;
  const rawBasis = isRecord(raw.basis) ? raw.basis : null;
  const verdict = rawBasis?.verdict;
  const basis: CompatBasis | null = rawBasis && typeof rawBasis.version === "string"
    ? {
        version: rawBasis.version,
        verdict: verdict === "ok" || verdict === "partial" ? verdict : "fail",
        ranAt: text(rawBasis.ranAt),
        tentacleServer: text(rawBasis.tentacleServer),
      }
    : null;
  return {
    version: raw.version,
    status: raw.status as CompatStatus,
    reason: raw.reason === "tested" || raw.reason === "line" || raw.reason === "below-minimum" ? raw.reason : "unknown",
    basis,
    line: text(raw.line),
    minTentacle: text(raw.minTentacle),
    tentacleTooOld: raw.tentacleTooOld === true,
    features: Array.isArray(raw.features) ? raw.features.map(readFeature).filter((f): f is CompatFeatureView => f !== null) : [],
  };
}

export function readCompatReport(raw: unknown): JellyfinCompatReport | null {
  if (!isRecord(raw) || typeof raw.checkedAt !== "string") return null;
  const installedView = isRecord(raw.installed) ? readVersionView(raw.installed) : null;
  const installed: InstalledJellyfin | null = installedView && isRecord(raw.installed)
    ? { ...installedView, serverName: text(raw.installed.serverName), probes: raw.installed.probes === "ok" ? "ok" : "unavailable" }
    : null;
  const latestView = isRecord(raw.latest) ? readVersionView(raw.latest) : null;
  const latest: LatestJellyfin | null = latestView && isRecord(raw.latest) && typeof raw.latest.url === "string"
    ? {
        ...latestView,
        tag: text(raw.latest.tag) ?? latestView.version,
        publishedAt: text(raw.latest.publishedAt),
        url: raw.latest.url,
        newer: raw.latest.newer === true,
        checkedAt: text(raw.latest.checkedAt),
      }
    : null;
  const manifest = isRecord(raw.manifest) && typeof raw.manifest.revision === "number"
    ? {
        revision: raw.manifest.revision,
        generatedAt: text(raw.manifest.generatedAt),
        source: raw.manifest.source === "remote" ? ("remote" as const) : ("embedded" as const),
        remoteCheckedAt: text(raw.manifest.remoteCheckedAt),
        remoteError: text(raw.manifest.remoteError),
        testedVersions: Array.isArray(raw.manifest.testedVersions) ? raw.manifest.testedVersions.filter((v): v is string => typeof v === "string") : [],
        areas: isRecord(raw.manifest.areas)
          ? Object.fromEntries(Object.entries(raw.manifest.areas).filter((entry): entry is [string, LocalizedText] => isText(entry[1])))
          : {},
      }
    : null;
  const failure = raw.installedError;
  return {
    checkedAt: raw.checkedAt,
    tentacleServer: text(raw.tentacleServer) ?? "",
    manifest,
    installed,
    installedError: failure === "not-configured" || failure === "unreachable" || failure === "rejected" || failure === "invalid" ? failure : null,
    latest,
    latestError: text(raw.latestError),
  };
}

const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

function readTrailers(raw: unknown): SetupTrailers | null {
  if (!isRecord(raw)) return null;
  const gaps = Array.isArray(raw.compatGaps) ? raw.compatGaps.filter(isRecord) : [];
  return {
    titles: count(raw.titles),
    withTmdb: count(raw.withTmdb),
    withTrailer: count(raw.withTrailer),
    sampled: raw.sampled === true,
    tmdbBlocked: raw.tmdbBlocked === true,
    jellyseerr: raw.jellyseerr === true,
    refreshing: raw.refreshing === true,
    compatGaps: gaps.filter((gap) => isText(gap.label)).map((gap) => ({
      label: gap.label as LocalizedText,
      note: isText(gap.note) ? gap.note : null,
    })),
  };
}

function readCheck(raw: unknown): SetupCheck | null {
  if (!isRecord(raw) || !CHECK_IDS.includes(raw.id as SetupCheckId) || typeof raw.state !== "string") return null;
  return {
    id: raw.id as SetupCheckId,
    level: raw.level === "essential" || raw.level === "optional" ? raw.level : "recommended",
    state: raw.state as SetupCheck["state"],
    libraries: Array.isArray(raw.libraries)
      ? raw.libraries.filter(isRecord).map((l) => ({ id: text(l.id) ?? "", name: text(l.name) ?? "", enabled: l.enabled === true }))
      : null,
    current: text(raw.current),
    missingTmdb: typeof raw.missingTmdb === "number" ? raw.missingTmdb : null,
    plugins: Array.isArray(raw.plugins) ? (raw.plugins.filter(isRecord) as unknown as SetupCheck["plugins"]) : null,
    task: isRecord(raw.task) ? (raw.task as unknown as SetupCheck["task"]) : null,
    trailers: readTrailers(raw.trailers),
    action: (text(raw.action) as SetupCheck["action"]) ?? null,
    dashboardPath: text(raw.dashboardPath) ?? "/web/#/dashboard",
  };
}

export function readSetupReport(raw: unknown): JellyfinSetupReport | null {
  if (!isRecord(raw) || typeof raw.checkedAt !== "string" || !Array.isArray(raw.checks)) return null;
  const failure = raw.error;
  return {
    checkedAt: raw.checkedAt,
    jellyfinVersion: text(raw.jellyfinVersion),
    dashboardUrl: text(raw.dashboardUrl),
    restartPending: raw.restartPending === true,
    error: failure === "not-configured" || failure === "unreachable" || failure === "rejected" || failure === "invalid" ? failure : null,
    checks: raw.checks.map(readCheck).filter((check): check is SetupCheck => check !== null),
  };
}
