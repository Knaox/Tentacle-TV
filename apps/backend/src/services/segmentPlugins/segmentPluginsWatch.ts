import { deleteConfigValue, getConfigValue, setConfigValue } from "../configStore";
import { hasPrisma } from "../db";
import { CONFIG_PENDING_KEY, INTRO_SKIPPER_MIGRATION_KEY, LEGACY_INTRO_SKIPPER_MIGRATION_KEY, SEGMENT_PLUGIN_SPECS } from "./catalog";
import { configureSegmentPlugins, introSkipperAutoOff } from "./pluginConfigure";
import { findPlugin, pluginStatus, readPlugins } from "./pluginInstall";

/**
 * Le guet de fond des greffons de passages, deux devoirs qui ne se font
 * qu'une fois chacun :
 *
 *  1. la COUPURE côté Jellyfin, au retrait de l'analyse audio : une Intro
 *     Skipper déjà installée voit son analyse automatique (écoute comprise)
 *     coupée UNE fois de plus — même là où elle avait été rallumée depuis la
 *     première coupure (2026-10-06, `introskipper_audio_off_applied`, dont la
 *     marque est effacée) — et le journal le dit quand elle tournait.
 *     Tentacle n'offre plus aucun interrupteur pour la rallumer ; chaque
 *     installation ou réparation la recoupe. Jellyfin sans Intro Skipper :
 *     rien à couper, la marque est posée aussi. Jellyfin injoignable : on
 *     retentera.
 *  2. les réglages EN ATTENTE : des greffons posés sans redémarrage (quelqu'un
 *     regardait) sont réglés dès que Jellyfin les a chargés.
 *
 * Toutes les cinq minutes tant qu'il reste un devoir ; ensuite, plus rien.
 */

const FIRST_DELAY_MS = 60_000;
const INTERVAL_MS = 5 * 60_000;

let timer: ReturnType<typeof setTimeout> | null = null;

export async function markIntroSkipperAudioOff(): Promise<void> {
  if (getConfigValue(INTRO_SKIPPER_MIGRATION_KEY) === undefined) {
    await setConfigValue(INTRO_SKIPPER_MIGRATION_KEY, new Date().toISOString());
  }
  if (getConfigValue(LEGACY_INTRO_SKIPPER_MIGRATION_KEY) !== undefined) {
    await deleteConfigValue(LEGACY_INTRO_SKIPPER_MIGRATION_KEY);
  }
}

/** Un tour du guet. Rend vrai quand il ne reste plus rien à faire. */
export async function segmentPluginsTick(): Promise<boolean> {
  if (!hasPrisma()) return false;
  const migrate = getConfigValue(INTRO_SKIPPER_MIGRATION_KEY) === undefined;
  const pending = getConfigValue(CONFIG_PENDING_KEY) !== undefined;
  if (!migrate && !pending) return true;
  const plugins = await readPlugins();
  if (typeof plugins === "string") return false;

  if (pending) {
    const result = await configureSegmentPlugins();
    const allLoaded = SEGMENT_PLUGIN_SPECS.every((spec) => {
      const status = pluginStatus(findPlugin(plugins, spec));
      return status === "active" || status === "";
    });
    if (result?.configured && allLoaded) {
      await deleteConfigValue(CONFIG_PENDING_KEY);
      if (result.keys.includes("introSkipper")) await markIntroSkipperAudioOff();
      console.log("[Passages] greffons chargés : réglages posés (analyse automatique d'Intro Skipper coupée)");
    }
  }
  if (getConfigValue(INTRO_SKIPPER_MIGRATION_KEY) === undefined) {
    const introSkipper = SEGMENT_PLUGIN_SPECS.find((spec) => spec.key === "introSkipper")!;
    const status = pluginStatus(findPlugin(plugins, introSkipper));
    // Posé mais pas encore chargé : on attendra qu'il le soit.
    if (status !== "restart") {
      const outcome = status === "active" ? await introSkipperAutoOff() : { done: true, changed: false };
      if (outcome.done) {
        await markIntroSkipperAudioOff();
        if (outcome.changed) {
          console.log("[Passages] Intro Skipper : son analyse automatique (qui écoute l'audio) tournait — coupée, l'analyse audio est retirée ; rien à faire");
        }
      }
    }
  }
  return getConfigValue(INTRO_SKIPPER_MIGRATION_KEY) !== undefined && getConfigValue(CONFIG_PENDING_KEY) === undefined;
}

export function startSegmentPluginsWatch(): void {
  if (timer) return;
  const loop = (delay: number) => {
    timer = setTimeout(() => {
      segmentPluginsTick()
        .catch((err) => {
          console.warn("[Passages] guet des greffons :", (err as Error)?.message ?? err);
          return false;
        })
        .then((finished) => {
          timer = null;
          if (!finished) loop(INTERVAL_MS);
        });
    }, delay);
    timer.unref?.();
  };
  loop(FIRST_DELAY_MS);
}

/** Relance le guet (un passage vient de laisser des réglages en attente). */
export function nudgeSegmentPluginsWatch(): void {
  startSegmentPluginsWatch();
}
