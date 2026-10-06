import { getConfigValue, setConfigValue, deleteConfigValue } from "../configStore";
import { jellyfinAdminFetch } from "../jellyfinAdminFetch";
import { CONFIG_PENDING_KEY, SEGMENT_PLUGIN_SPECS } from "./catalog";
import { restartJellyfin, restartPending, type RestartClock } from "./jellyfinRestart";
import { configureSegmentPlugins } from "./pluginConfigure";
import { markIntroSkipperAudioOff, nudgeSegmentPluginsWatch } from "./segmentPluginsWatch";
import { ensureRepositories, installPlugin, readPackages, readPlugins } from "./pluginInstall";
import { SEGMENT_PLUGIN_KEYS, type SegmentPluginOutcome, type SegmentSetupRun, type SegmentSetupStartRequest } from "./segmentPluginsContract";

/**
 * Le passage d'installation de la détection des passages — le MÊME moteur pour
 * l'assistant et pour l'administration : dépôts, greffons, redémarrage de
 * Jellyfin, réglages. Un seul à la fois sur le serveur ; il tourne en tâche de
 * fond (le redémarrage prend jusqu'à une minute) et les deux portes lisent son
 * état.
 *
 * Rien n'y est bloquant : un dépôt muet ou un greffon sans version pour ce
 * Jellyfin donne un résultat par greffon, et le reste continue.
 */

const idle = (): SegmentSetupRun => ({
  phase: "idle",
  running: false,
  startedAt: null,
  finishedAt: null,
  plugins: SEGMENT_PLUGIN_KEYS.map((key) => ({ key, outcome: null })),
  restart: null,
  configured: null,
  error: null,
});

let run: SegmentSetupRun = idle();
let current: Promise<SegmentSetupRun> | null = null;

export function segmentSetupStatus(): SegmentSetupRun {
  return { ...run, plugins: run.plugins.map((plugin) => ({ ...plugin })) };
}

/** Pour les tests : un état neuf. */
export function resetSegmentSetupForTests(): void {
  run = idle();
  current = null;
}

function setOutcome(key: string, outcome: SegmentPluginOutcome): void {
  run.plugins = run.plugins.map((plugin) => (plugin.key === key ? { ...plugin, outcome } : plugin));
}

async function jellyfinVersion(): Promise<string | null> {
  const res = await jellyfinAdminFetch<{ Version?: unknown }>("/System/Info/Public");
  return res.ok && typeof res.data?.Version === "string" ? res.data.Version : null;
}

async function execute(request: SegmentSetupStartRequest, clock?: RestartClock): Promise<void> {
  const version = await jellyfinVersion();
  const plugins = await readPlugins();
  if (!version || typeof plugins === "string") {
    run.error = typeof plugins === "string" ? plugins : "unreachable";
    return;
  }

  run.phase = "repositories";
  const repositories = await ensureRepositories(SEGMENT_PLUGIN_SPECS);
  const registered = repositories.ok ? repositories.registered : new Set<string>();
  run.phase = "installing";
  const packages = registered.size > 0 ? await readPackages() : null;
  for (const spec of SEGMENT_PLUGIN_SPECS) {
    setOutcome(spec.key, await installPlugin(spec, { plugins, packages, registered, jellyfinVersion: version }));
  }

  const changed = run.plugins.some((plugin) => plugin.outcome === "installed" || plugin.outcome === "enabled");
  if (changed || (await restartPending())) {
    run.phase = "restarting";
    run.restart = await restartJellyfin({ whilePlaying: request.restartWhilePlaying === true }, clock);
  } else {
    run.restart = "not-needed";
  }

  run.phase = "configuring";
  const result = await configureSegmentPlugins();
  const loaded = run.restart === "done" || run.restart === "not-needed";
  run.configured = result?.configured ?? null;
  if (result?.configured && loaded) {
    await deleteConfigValue(CONFIG_PENDING_KEY).catch(() => undefined);
    if (result.keys.includes("introSkipper")) await markIntroSkipperAudioOff().catch(() => undefined);
  } else if (changed) {
    // Pas encore chargés : le guet de fond les réglera au prochain redémarrage.
    await setConfigValue(CONFIG_PENDING_KEY, new Date().toISOString()).catch(() => undefined);
    nudgeSegmentPluginsWatch();
  }
}

/**
 * Lance un passage, ou rend celui qui tourne déjà. La promesse se résout à la
 * fin du passage ; les routes ne l'attendent pas.
 */
export function startSegmentSetup(request: SegmentSetupStartRequest = {}, clock?: RestartClock): Promise<SegmentSetupRun> {
  if (current) return current;
  run = { ...idle(), phase: "repositories", running: true, startedAt: new Date().toISOString() };
  current = execute(request, clock)
    .catch((err) => {
      console.warn("[Passages] installation interrompue :", (err as Error)?.message ?? err);
      run.error = run.error ?? "invalid";
    })
    .then(() => {
      run = { ...run, phase: "done", running: false, finishedAt: new Date().toISOString() };
      current = null;
      const summary = run.plugins.map((plugin) => `${plugin.key}=${plugin.outcome ?? "—"}`).join(" ");
      console.log(`[Passages] installation : ${summary} · redémarrage=${run.restart ?? "—"} · réglés=${run.configured ?? "—"}${run.error ? ` · erreur=${run.error}` : ""}`);
      return segmentSetupStatus();
    });
  return current;
}

export function segmentConfigPending(): boolean {
  return getConfigValue(CONFIG_PENDING_KEY) !== undefined;
}
