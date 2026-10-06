import type { SegmentPluginKey } from "./segmentPluginsContract";

/**
 * Les trois greffons de passages que Tentacle installe, tels que les
 * manifestes les publient (relevé du 2026-10-06, mesuré sur Jellyfin 10.11.11
 * et 12.1.0) :
 *
 *  - Intro Skipper et SkipMe.db partagent UN dépôt, celui d'Intro Skipper. Son
 *    adresse ne sert un manifeste qu'à Jellyfin : la réponse dépend de l'agent
 *    `Jellyfin-Server/x.y.z` (un navigateur est renvoyé vers GitHub) ;
 *  - TheIntroDB a le sien, sur GitHub.
 *
 * Jellyfin choisit seul la version compatible avec lui-même (`targetAbi`) :
 * on n'en fige aucune. Seule exception, TheIntroDB déclare une ABI 10.9 pour
 * sa branche 10.11 alors que son auteur exige 10.11.6 — on garde ce plancher
 * nous-mêmes.
 *
 * `guid` est l'identifiant d'assemblage SANS tirets, la forme que rendent
 * `/Packages` et `/Plugins`.
 */
export interface SegmentPluginSpec {
  key: SegmentPluginKey;
  /** Le nom du paquet au catalogue (`/Packages`), aussi celui du greffon (`/Plugins`). */
  packageName: string;
  guid: string;
  repository: { name: string; url: string };
  homepage: string;
  /** Version de Jellyfin minimale, quand le manifeste ne la dit pas juste. */
  minJellyfin: string | null;
}

export const INTRO_SKIPPER_REPOSITORY = { name: "Intro Skipper", url: "https://intro-skipper.org/manifest.json" };

export const SEGMENT_PLUGIN_SPECS: readonly SegmentPluginSpec[] = [
  {
    key: "introSkipper",
    packageName: "Intro Skipper",
    guid: "c83d86bba1e04c35a113e2101cf4ee6b",
    repository: INTRO_SKIPPER_REPOSITORY,
    homepage: "https://github.com/intro-skipper/intro-skipper",
    minJellyfin: null,
  },
  {
    key: "theIntroDb",
    packageName: "TheIntroDB",
    guid: "c9e41b9563e445e29db6b83df21ae5e7",
    repository: { name: "TheIntroDB", url: "https://raw.githubusercontent.com/TheIntroDB/jellyfin-plugin/main/manifest.json" },
    homepage: "https://github.com/TheIntroDB/jellyfin-plugin",
    minJellyfin: "10.11.6",
  },
  {
    key: "skipMeDb",
    packageName: "SkipMe.db",
    guid: "b2a63e620ac545759ad22c7534ccb83d",
    repository: INTRO_SKIPPER_REPOSITORY,
    homepage: "https://github.com/intro-skipper/skipme.db-plugin",
    minJellyfin: null,
  },
];

/** Les tâches planifiées des greffons, par leur clé (stable de 10.11 à 12). */
export const PLUGIN_TASK_KEYS = {
  /** La détection d'Intro Skipper : chapitres, images noires ET empreintes audio — chaque nuit par défaut. */
  introSkipperDetect: "IntroSkipperDetectSegmentsTask",
  /** La synchronisation de SkipMe.db : `SkipMeDbSync` en 0.1.x (10.11), `SkipMeDaily` en 0.2.x (12). */
  skipMeSync: ["SkipMeDbSync", "SkipMeDaily"],
} as const;

/** Un identifiant de Jellyfin, avec ou sans tirets, en minuscules sans tirets. */
export function normalizeGuid(value: unknown): string {
  return typeof value === "string" ? value.replace(/-/g, "").toLowerCase() : "";
}

/** `10.11.6` ≤ `10.11.11` : comparaison numérique, partie par partie. */
export function versionAtLeast(version: string, minimum: string): boolean {
  const a = version.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const b = minimum.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return true;
}

/** Une adresse de dépôt, comparée sans la casse ni la barre finale. */
export function sameRepositoryUrl(a: unknown, b: string): boolean {
  const clean = (value: string) => value.trim().replace(/\/+$/, "").toLowerCase();
  return typeof a === "string" && clean(a) === clean(b);
}

/** Dans `server_config` : des greffons posés attendent d'être réglés (redémarrage remis à plus tard). */
export const CONFIG_PENDING_KEY = "segment_plugins_config_pending";

/** Dans `server_config` : la migration « Intro Skipper sans écoute » a été faite, une fois pour toutes. */
export const INTRO_SKIPPER_MIGRATION_KEY = "introskipper_audio_off_applied";
