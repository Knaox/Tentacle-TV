import { jellyfinAdminFetch } from "../jellyfinAdminFetch";
import { PLUGIN_TASK_KEYS, SEGMENT_PLUGIN_SPECS, type SegmentPluginSpec } from "./catalog";
import { findPlugin, pluginStatus, readPlugins, type Loose } from "./pluginInstall";
import type { SegmentPluginKey } from "./segmentPluginsContract";

/**
 * Les réglages que Tentacle pose sur les greffons de passages, une fois
 * chargés (la configuration d'un greffon ne se lit qu'après le redémarrage).
 *
 * Intro Skipper : son écoute (Chromaprint) n'a PAS d'interrupteur à elle — la
 * chaîne d'analyseurs l'ajoute d'office (`BaseItemAnalyzerTask.cs`, branches
 * 10.11 et 12.0). Couper l'analyse audio, c'est donc couper son analyse
 * AUTOMATIQUE : `AutoDetectIntros` (à l'ajout d'un média) et la tâche de
 * détection nocturne, privée de déclencheurs. Le greffon reste : ses passages
 * déjà trouvés, son bouton dans les clients Jellyfin, et l'analyse à la main
 * depuis son panneau, si l'administrateur la veut.
 *
 * TheIntroDB et SkipMe.db : les sources en ligne, actives — tous les types de
 * passages, la lecture au besoin (TheIntroDB), la synchronisation (SkipMe.db).
 *
 * Chaque écriture est un remplacement intégral : on relit, on change nos
 * champs, on renvoie tout, on relit pour vérifier.
 */

const isRecord = (value: unknown): value is Loose => typeof value === "object" && value !== null && !Array.isArray(value);
const spec = (key: SegmentPluginKey): SegmentPluginSpec => SEGMENT_PLUGIN_SPECS.find((candidate) => candidate.key === key)!;

/** Les champs voulus, posés s'ils diffèrent ; vrai si la configuration relue les porte. */
async function patchConfiguration(guid: string, wanted: Record<string, unknown>): Promise<boolean> {
  const path = `/Plugins/${guid}/Configuration`;
  const current = await jellyfinAdminFetch(path);
  if (!current.ok || !isRecord(current.data)) return false;
  const config = current.data;
  const holds = (data: Loose) => Object.entries(wanted).every(([key, value]) => !(key in data) || data[key] === value);
  if (holds(config)) return true;
  // Un champ que cette version du greffon ne connaît pas n'est pas ajouté.
  const patch = Object.fromEntries(Object.entries(wanted).filter(([key]) => key in config));
  const res = await jellyfinAdminFetch(path, { method: "POST", body: { ...config, ...patch }, expectEmpty: true });
  if (!res.ok) return false;
  const after = await jellyfinAdminFetch(path);
  return after.ok && isRecord(after.data) && holds(after.data);
}

async function readTasks(): Promise<Loose[] | null> {
  const res = await jellyfinAdminFetch("/ScheduledTasks?isHidden=false");
  return res.ok && Array.isArray(res.data) ? res.data.filter(isRecord) : null;
}

async function setTriggers(task: Loose, triggers: unknown[]): Promise<boolean> {
  if (typeof task.Id !== "string") return false;
  const res = await jellyfinAdminFetch(`/ScheduledTasks/${encodeURIComponent(task.Id)}/Triggers`, { method: "POST", body: triggers, expectEmpty: true });
  return res.ok;
}

const triggersOf = (task: Loose | undefined): unknown[] => (Array.isArray(task?.Triggers) ? task.Triggers : []);

/** La nuit, une heure du matin : l'horaire que SkipMe.db se donne lui-même. */
const SKIPME_DAILY_TRIGGER = { Type: "DailyTrigger", TimeOfDayTicks: 36_000_000_000 };

/** L'analyse automatique d'Intro Skipper, écoute comprise, coupée. */
export async function introSkipperAudioOff(): Promise<boolean> {
  const configured = await patchConfiguration(spec("introSkipper").guid, { AutoDetectIntros: false });
  const tasks = await readTasks();
  const detect = tasks?.find((task) => task.Key === PLUGIN_TASK_KEYS.introSkipperDetect);
  if (!tasks) return false;
  const quiet = !detect || triggersOf(detect).length === 0 || (await setTriggers(detect, []));
  return configured && quiet;
}

async function theIntroDbOnline(): Promise<boolean> {
  return patchConfiguration(spec("theIntroDb").guid, {
    EnableIntro: true,
    EnableRecap: true,
    EnableCredits: true,
    EnablePreview: true,
    EnableOnDemandFetch: true,
  });
}

async function skipMeOnline(): Promise<boolean> {
  const tasks = await readTasks();
  if (!tasks) return false;
  const sync = tasks.find((task) => (PLUGIN_TASK_KEYS.skipMeSync as readonly unknown[]).includes(task.Key));
  // Sa tâche absente : une version qui synchronise autrement — rien à rallumer.
  if (!sync || triggersOf(sync).length > 0) return true;
  return setTriggers(sync, [SKIPME_DAILY_TRIGGER]);
}

const CONFIGURE: Record<SegmentPluginKey, () => Promise<boolean>> = {
  introSkipper: introSkipperAudioOff,
  theIntroDb: theIntroDbOnline,
  skipMeDb: skipMeOnline,
};

/**
 * Règle chaque greffon ACTIF parmi les trois. `null` : aucun n'est chargé
 * (redémarrage pas encore fait) — rien n'a été réglé, à refaire plus tard.
 */
export async function configureSegmentPlugins(): Promise<{ configured: boolean; keys: SegmentPluginKey[] } | null> {
  const plugins = await readPlugins();
  if (typeof plugins === "string") return null;
  const active = SEGMENT_PLUGIN_SPECS.filter((candidate) => pluginStatus(findPlugin(plugins, candidate)) === "active");
  if (active.length === 0) return null;
  let configured = true;
  for (const candidate of active) {
    configured = (await CONFIGURE[candidate.key]()) && configured;
  }
  return { configured, keys: active.map((candidate) => candidate.key) };
}
