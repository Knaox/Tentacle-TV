import type { CompatFeatureView, JellyfinCompatReport, SetupCheck } from "@tentacle-tv/shared";

/**
 * Les données factices des scènes d'administration : un rapport de
 * compatibilité et des réglages recommandés TELS QUE LE SERVEUR LES REND,
 * pour que les vraies pièces (`InstalledColumn`, `LatestColumn`,
 * `SetupCheckRow`) les peignent sans rien savoir d'une scène.
 */

const FEATURE_LABELS: ReadonlyArray<{ fr: string; en: string }> = [
  { fr: "Connexion", en: "Sign-in" },
  { fr: "Bibliothèques", en: "Libraries" },
  { fr: "Lecture directe", en: "Direct play" },
  { fr: "Transcodage", en: "Transcoding" },
  { fr: "Sous-titres", en: "Subtitles" },
  { fr: "Reprise", en: "Resume" },
  { fr: "Génériques et résumés", en: "Credits and recaps" },
  { fr: "Aperçus de la barre", en: "Seek previews" },
  { fr: "Bandes-annonces", en: "Trailers" },
  { fr: "Recherche", en: "Search" },
];

const features = (probed: boolean): CompatFeatureView[] =>
  FEATURE_LABELS.map((label, i) => ({
    id: `scene-feature-${i}`,
    area: "playback",
    critical: i < 3,
    label,
    state: "ok",
    note: null,
    since: null,
    endpoints: [],
    probe: probed ? { state: "present", missing: [] } : null,
  }));

export const SCENE_COMPAT_REPORT: JellyfinCompatReport = {
  checkedAt: "2026-09-29T08:00:00.000Z",
  tentacleServer: "1.22.0",
  manifest: {
    revision: 1,
    generatedAt: "2026-09-29T06:00:00.000Z",
    source: "embedded",
    remoteCheckedAt: null,
    remoteError: null,
    testedVersions: ["10.10.7", "10.11.8", "12.1.0"],
    areas: {},
  },
  installed: {
    version: "10.11.8",
    status: "compatible",
    reason: "tested",
    basis: { version: "10.11.8", verdict: "ok", ranAt: "2026-09-29T06:00:00.000Z", tentacleServer: "1.22.0" },
    line: "10.11",
    minTentacle: null,
    tentacleTooOld: false,
    features: features(true),
    serverName: "Salon",
    probes: "ok",
  },
  installedError: null,
  latest: {
    version: "12.1.0",
    status: "compatible",
    reason: "tested",
    basis: { version: "12.1.0", verdict: "ok", ranAt: "2026-09-29T06:00:00.000Z", tentacleServer: "1.22.0" },
    line: "12.1",
    minTentacle: "1.22.0",
    tentacleTooOld: false,
    features: features(false),
    tag: "v12.1.0",
    publishedAt: "2026-09-15T00:00:00.000Z",
    url: "https://github.com/jellyfin/jellyfin/releases",
    newer: true,
    checkedAt: "2026-09-29T08:00:00.000Z",
  },
  latestError: null,
};

const LIBRARIES = ["Films", "Séries", "Animés"];

/** Les réglages de la scène ; `trickplayDone` : le geste en un clic a abouti. */
export function sceneSetupChecks(trickplayDone: boolean): SetupCheck[] {
  const base = { missingTmdb: null, plugins: null, task: null, trailers: null, current: null, libraries: null } as const;
  return [
    {
      ...base,
      id: "metadataLanguage",
      level: "recommended",
      state: "done",
      current: "fr-FR",
      action: null,
      dashboardPath: "/web/#/dashboard/settings",
    },
    {
      ...base,
      id: "trickplay",
      level: "recommended",
      state: trickplayDone ? "done" : "todo",
      libraries: LIBRARIES.map((name, i) => ({ id: `scene-lib-${i}`, name, enabled: trickplayDone || i === 0 })),
      action: trickplayDone ? null : "enableTrickplay",
      dashboardPath: "/web/#/dashboard/libraries",
    },
    {
      ...base,
      id: "hardwareAcceleration",
      level: "optional",
      state: "done",
      current: "vaapi",
      action: null,
      dashboardPath: "/web/#/dashboard/playback/transcoding",
    },
  ];
}
