import { getConfigValue, setConfigValue } from "../configStore";
import {
  DEFAULT_FAMILY_LAUNCH_SETTINGS,
  FAMILY_LAUNCH_ASK_PLATFORMS,
  launchAskedOn,
  type FamilyLaunchAskPlatform,
  type FamilyLaunchPolicy,
  type FamilyLaunchSettings,
  type SetFamilyLaunchPolicyBody,
} from "../../family/familyPickerContract";

/**
 * « Qui regarde ? » à l'ouverture, réglé par l'ADMINISTRATION (docs/FAMILLE.md,
 * « À l'ouverture »). Depuis la 1.31.1 (`family.launchPlatforms`), la forme
 * SIMPLE fait foi : un interrupteur général et des plateformes cochées
 * (`FamilyLaunchSettings`). La forme d'avant (`desktop` : permis / activé par
 * défaut ; `tv` : permis) n'est plus que tirée d'elle, pour les bureaux et les
 * TV d'avant.
 *
 * Rangé dans `server_config` sous `family_launch_policy` (JSON), les DEUX formes
 * ensemble : un serveur ramené en arrière relit la sienne. Absent ou illisible :
 * les défauts (tout coché). Une valeur d'avant la 1.31.1 est REPRISE telle
 * quelle : le bureau coupé ou « pas activé par défaut » décoche Ordinateurs et
 * Navigateur (le web suivait les ordinateurs) ; les TV coupées décochent TV ; le
 * mobile, qui demandait toujours, reste coché.
 */

export const FAMILY_LAUNCH_POLICY_KEY = "family_launch_policy";

type Loose = Record<string, unknown>;

function looseOf(value: unknown): Loose {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Loose) : {};
}

function entryOf(source: Loose, key: string): Loose {
  return looseOf(Object.hasOwn(source, key) ? source[key] : undefined);
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** La forme d'avant la 1.31.1 (`desktop`, `tv`), lue en forme simple. */
function settingsFromLegacy(source: Loose): FamilyLaunchSettings {
  const desktop = entryOf(source, "desktop");
  const tv = entryOf(source, "tv");
  const computers = desktop.mode !== "off" && desktop.defaultOn !== false;
  const defaults = DEFAULT_FAMILY_LAUNCH_SETTINGS.platforms;
  return {
    enabled: true,
    platforms: { ...defaults, desktop: computers, web: computers, tv: tv.mode !== "off" },
  };
}

/** La forme simple, d'après n'importe quelle valeur gardée (les défauts là où elle ne dit rien). */
export function normalizeLaunchSettings(raw: unknown): FamilyLaunchSettings {
  const source = looseOf(raw);
  if (!Object.hasOwn(source, "platforms")) return settingsFromLegacy(source);
  const platforms = entryOf(source, "platforms");
  const defaults = DEFAULT_FAMILY_LAUNCH_SETTINGS;
  return {
    enabled: boolOr(source.enabled, defaults.enabled),
    platforms: Object.fromEntries(
      FAMILY_LAUNCH_ASK_PLATFORMS.map((platform) => [platform, boolOr(platforms[platform], defaults.platforms[platform])]),
    ) as FamilyLaunchSettings["platforms"],
  };
}

/** La politique entière telle que `GET /api/admin/family/picker` la rend : la forme
 *  d'avant TIRÉE de la forme simple, puis la forme simple. */
export function launchPolicyOf(settings: FamilyLaunchSettings): FamilyLaunchPolicy {
  const mode = (platform: FamilyLaunchAskPlatform) => (launchAskedOn(settings, platform) ? "choice" : "off");
  return {
    desktop: { mode: mode("desktop"), defaultOn: true },
    tv: { mode: mode("tv") },
    enabled: settings.enabled,
    platforms: { ...settings.platforms },
  };
}

export function getFamilyLaunchSettings(): FamilyLaunchSettings {
  const raw = getConfigValue(FAMILY_LAUNCH_POLICY_KEY);
  if (!raw) return normalizeLaunchSettings(null);
  try {
    return normalizeLaunchSettings(JSON.parse(raw));
  } catch {
    return normalizeLaunchSettings(null);
  }
}

export function getFamilyLaunchPolicy(): FamilyLaunchPolicy {
  return launchPolicyOf(getFamilyLaunchSettings());
}

/**
 * Un corps de la forme d'avant (un bureau d'avant la 1.31.1), appliqué à la
 * forme simple : « Permis » coupé décoche ; permis, ou « activé par défaut »,
 * coche selon `defaultOn` — et rallume l'interrupteur général, sans quoi le
 * geste ne se verrait pas. Les ordinateurs règlent aussi le navigateur.
 */
function applyLegacy(settings: FamilyLaunchSettings, patch: SetFamilyLaunchPolicyBody): FamilyLaunchSettings {
  const next: FamilyLaunchSettings = { enabled: settings.enabled, platforms: { ...settings.platforms } };
  const turn = (platforms: readonly FamilyLaunchAskPlatform[], on: boolean) => {
    for (const platform of platforms) next.platforms[platform] = on;
    if (on) next.enabled = true;
  };
  const desktop = patch.desktop;
  if (desktop?.mode === "off") turn(["desktop", "web"], false);
  else if (desktop?.mode === "choice" || desktop?.defaultOn !== undefined) turn(["desktop", "web"], desktop.defaultOn ?? true);
  if (patch.tv?.mode) turn(["tv"], patch.tv.mode === "choice");
  return next;
}

/** Pose ce qui change ; le reste garde sa valeur. Rend la politique entière, telle que gardée. */
export async function setFamilyLaunchPolicy(patch: SetFamilyLaunchPolicyBody): Promise<FamilyLaunchPolicy> {
  const legacy = applyLegacy(getFamilyLaunchSettings(), patch);
  const next = normalizeLaunchSettings({
    enabled: patch.enabled ?? legacy.enabled,
    platforms: { ...legacy.platforms, ...patch.platforms },
  });
  const policy = launchPolicyOf(next);
  await setConfigValue(FAMILY_LAUNCH_POLICY_KEY, JSON.stringify(policy));
  return policy;
}

/** Ce que fait un ORDINATEUR qui n'a jamais choisi (`PickerProfilesDto.atLaunch`, lu par les bureaux d'avant). */
export function desktopAtLaunchByDefault(policy: FamilyLaunchPolicy): boolean {
  return policy.desktop.mode === "choice" && policy.desktop.defaultOn;
}

/** Les TV demandent-elles « Qui regarde ? » à l'ouverture (`TvProfilesDto.askAtLaunch`) ? */
export function tvAsksAtLaunch(policy: FamilyLaunchPolicy): boolean {
  return policy.tv.mode !== "off";
}
