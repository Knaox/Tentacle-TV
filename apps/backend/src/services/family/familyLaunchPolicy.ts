import { getConfigValue, setConfigValue } from "../configStore";
import {
  DEFAULT_FAMILY_LAUNCH_POLICY,
  type FamilyLaunchMode,
  type FamilyLaunchPolicy,
  type SetFamilyLaunchPolicyBody,
} from "../../family/familyPickerContract";

/**
 * « Qui regarde ? » à l'ouverture, réglé par l'ADMINISTRATION plateforme par
 * plateforme (docs/FAMILLE.md, « À l'ouverture ») : coupé pour tous (`off`),
 * ou au choix de chaque appareil (`choice`) — le bureau avec un défaut
 * (`defaultOn`) pour l'ordinateur qui n'a jamais choisi.
 *
 * Rangé dans `server_config` sous `family_launch_policy` (JSON), comme les
 * interrupteurs de la Famille. Absent ou illisible : les défauts (permis
 * partout, bureau activé par défaut). Une valeur illisible prend SON défaut ;
 * une plateforme inconnue est ignorée.
 */

export const FAMILY_LAUNCH_POLICY_KEY = "family_launch_policy";

type Loose = Record<string, unknown>;

function entryOf(source: Loose, platform: keyof FamilyLaunchPolicy): Loose {
  const entry = Object.hasOwn(source, platform) ? source[platform] : undefined;
  return entry && typeof entry === "object" && !Array.isArray(entry) ? (entry as Loose) : {};
}

function modeOf(value: unknown, fallback: FamilyLaunchMode): FamilyLaunchMode {
  return value === "off" || value === "choice" ? value : fallback;
}

/** Une politique entière, d'après n'importe quelle valeur (les défauts là où elle ne dit rien). */
export function normalizeLaunchPolicy(raw: unknown): FamilyLaunchPolicy {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Loose) : {};
  const desktop = entryOf(source, "desktop");
  const tv = entryOf(source, "tv");
  const defaults = DEFAULT_FAMILY_LAUNCH_POLICY;
  return {
    desktop: {
      mode: modeOf(desktop.mode, defaults.desktop.mode),
      defaultOn: typeof desktop.defaultOn === "boolean" ? desktop.defaultOn : defaults.desktop.defaultOn,
    },
    tv: { mode: modeOf(tv.mode, defaults.tv.mode) },
  };
}

export function getFamilyLaunchPolicy(): FamilyLaunchPolicy {
  const raw = getConfigValue(FAMILY_LAUNCH_POLICY_KEY);
  if (!raw) return normalizeLaunchPolicy(null);
  try {
    return normalizeLaunchPolicy(JSON.parse(raw));
  } catch {
    return normalizeLaunchPolicy(null);
  }
}

/** Pose ce qui change ; le reste garde sa valeur. Rend la politique entière, telle que gardée. */
export async function setFamilyLaunchPolicy(patch: SetFamilyLaunchPolicyBody): Promise<FamilyLaunchPolicy> {
  const current = getFamilyLaunchPolicy();
  const next = normalizeLaunchPolicy({
    desktop: { ...current.desktop, ...patch.desktop },
    tv: { ...current.tv, ...patch.tv },
  });
  await setConfigValue(FAMILY_LAUNCH_POLICY_KEY, JSON.stringify(next));
  return next;
}

/** Ce que fait un ORDINATEUR qui n'a jamais choisi (`PickerProfilesDto.atLaunch`, lu par les bureaux d'avant). */
export function desktopAtLaunchByDefault(policy: FamilyLaunchPolicy): boolean {
  return policy.desktop.mode === "choice" && policy.desktop.defaultOn;
}

/** Les TV demandent-elles « Qui regarde ? » à l'ouverture (`TvProfilesDto.askAtLaunch`) ? */
export function tvAsksAtLaunch(policy: FamilyLaunchPolicy): boolean {
  return policy.tv.mode !== "off";
}
