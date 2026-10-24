import { resolve } from "path";
import { DATA_DIR, getInstalled, isValidPluginId } from "../../services/pluginManager";
import { readPluginManifest } from "../../services/pluginServerModule";
import { isPluginUsable } from "../../services/pluginStorage/gate";
import { titleLanguage } from "../../services/reco/titleLanguage";
import { readPluginMusicManifest } from "../../routes/pluginMusicMeta";
import { cleanupSocketRoot, guestDataDir } from "./guestLaunch";
import { GuestSupervisor, type GuestState } from "./guestSupervisor";
import { createHostDispatcher } from "./hostDispatcher";
import type { HostEvent, PluginRuntimeManifest } from "./pluginServerRuntime";
import { readRuntimeManifest, runtimeEntryPath } from "./runtimeManifest";
import { HOST_HANDLERS } from "./host/hostHandlers";
import { runtimeServices, type AudioItemsChange } from "./hostServices";
import { broadcastMusicProvider } from "./host/musicEvents";
import { forgetIsolatedRights } from "./accountRights";
import { stopAllWorkers, stopPluginWorkers } from "./tools/toolWorkers";
import type { RelayTarget } from "./relay/relayRoute";

/**
 * Les invités du runtime isolé, un par extension ISOLÉE qui sert (installée,
 * activée, pas refusée) — `sync` les accorde à `installed.json` : une extension
 * activée démarre, une extension coupée reçoit `shutdown` AUSSITÔT et son relais
 * se ferme, sans redémarrer le serveur. Chaque changement d'une extension
 * musique s'annonce aux clients (`music:provider`).
 */

const READY_WAIT_MS = 5_000;
const supervisors = new Map<string, GuestSupervisor>();
let unsubscribeLibrary: (() => void) | null = null;

export function serverLocale(): string {
  return (titleLanguage() ?? "en").slice(0, 2).toLowerCase() || "en";
}

/** Le manifeste `runtime` validé d'une extension installée, `null` si elle n'est pas isolée. */
export function isolatedManifestOf(pluginId: string): PluginRuntimeManifest | null {
  return isValidPluginId(pluginId) ? readRuntimeManifest(readPluginManifest(pluginId)) : null;
}

export function isIsolatedPlugin(pluginId: string): boolean {
  return isolatedManifestOf(pluginId) !== null;
}

function declaresMusic(pluginId: string): boolean {
  return readPluginMusicManifest(readPluginManifest(pluginId)?.music) !== null;
}

function createSupervisor(pluginId: string, manifest: PluginRuntimeManifest): GuestSupervisor | null {
  const pluginDir = resolve(DATA_DIR, pluginId);
  const entry = runtimeEntryPath(pluginDir, manifest.entry);
  if (!entry) return null;
  const dataDir = guestDataDir(pluginDir);
  const dispatch = createHostDispatcher({ pluginId, manifest, pluginDir, dataDir }, HOST_HANDLERS);
  return new GuestSupervisor({
    pluginId,
    manifest,
    paths: { pluginDir, dataDir, entry },
    locale: serverLocale,
    onCall: dispatch,
    onExit: () => stopPluginWorkers(pluginId),
  });
}

/** Accorde les invités à l'état des extensions. Rend les extensions qui ont changé. */
export async function syncIsolatedPlugins(): Promise<string[]> {
  const changed: string[] = [];
  const wanted = new Map<string, PluginRuntimeManifest>();
  for (const plugin of getInstalled()) {
    const manifest = isolatedManifestOf(plugin.pluginId);
    if (manifest && isPluginUsable(plugin)) wanted.set(plugin.pluginId, manifest);
  }
  for (const [pluginId, supervisor] of [...supervisors]) {
    if (wanted.has(pluginId)) continue;
    supervisors.delete(pluginId);
    changed.push(pluginId);
    await supervisor.stop("disabled");
  }
  for (const [pluginId, manifest] of wanted) {
    if (supervisors.has(pluginId)) continue;
    const supervisor = createSupervisor(pluginId, manifest);
    if (!supervisor) {
      console.error(`[plugin:${pluginId}] module hors du dossier de l'extension : pas lancé`);
      continue;
    }
    supervisors.set(pluginId, supervisor);
    supervisor.start();
    changed.push(pluginId);
  }
  if (changed.length > 0) forgetIsolatedRights();
  if (changed.some(declaresMusic)) broadcastMusicProvider();
  return changed;
}

/** Une extension change (configuration, accord d'outil) : l'invité l'apprend, les clients relisent. */
export async function isolatedPluginChanged(pluginId: string): Promise<void> {
  if (!isIsolatedPlugin(pluginId)) return;
  const changed = await syncIsolatedPlugins();
  forgetIsolatedRights(pluginId);
  supervisors.get(pluginId)?.pushEvent({ type: "settings.changed" });
  if (!changed.includes(pluginId) && declaresMusic(pluginId)) broadcastMusicProvider();
}

/** Arrête l'invité (mise à jour, désinstallation) ; `sync` le relancera s'il sert encore. */
export async function stopIsolatedPlugin(pluginId: string): Promise<void> {
  const supervisor = supervisors.get(pluginId);
  if (!supervisor) return;
  supervisors.delete(pluginId);
  await supervisor.stop("restart");
}

export function relayLookup(pluginId: string): RelayTarget | null {
  const supervisor = supervisors.get(pluginId);
  if (!supervisor) return null;
  return {
    manifest: supervisor.manifest,
    ready: async () => ((await supervisor.whenReady(READY_WAIT_MS)) ? supervisor.socket : null),
  };
}

export function isolatedState(pluginId: string): { state: GuestState; version: string | null; lastError: string | null; restarts: number } | null {
  const supervisor = supervisors.get(pluginId);
  return supervisor
    ? { state: supervisor.state, version: supervisor.version, lastError: supervisor.lastError, restarts: supervisor.restarts }
    : null;
}

function pushToMusicGuests(event: HostEvent): void {
  for (const supervisor of supervisors.values()) {
    if ((supervisor.manifest.hostApi ?? []).includes("jellyfin.music")) supervisor.pushEvent(event);
  }
}

/** Les éléments audio vus par Jellyfin (flux de la musique du cœur), poussés aux invités qui parlent musique. */
function onAudioItems(change: AudioItemsChange): void {
  if (change.added.length + change.updated.length + change.removed.length === 0) return;
  pushToMusicGuests({ type: "jellyfin.audioItems", added: change.added, updated: change.updated, removed: change.removed });
}

export function startIsolatedRuntime(): Promise<string[]> {
  unsubscribeLibrary ??= runtimeServices().onAudioItems?.(onAudioItems) ?? null;
  return syncIsolatedPlugins();
}

/** L'arrêt du serveur : chaque invité reçoit `shutdown`, ses ouvriers partent avec lui. */
export async function stopIsolatedRuntime(): Promise<void> {
  unsubscribeLibrary?.();
  unsubscribeLibrary = null;
  const all = [...supervisors.values()];
  supervisors.clear();
  await Promise.all(all.map((s) => s.stop("stop")));
  stopAllWorkers();
  cleanupSocketRoot();
}

/** L'état de Jellyfin, dit aux invités (`jellyfin.state`). */
export function pushJellyfinState(state: "up" | "restarting" | "down"): void {
  pushToMusicGuests({ type: "jellyfin.state", state });
}
