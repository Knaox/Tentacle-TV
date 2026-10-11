import { hostSupports, requestHost } from "../../serverHost/hostChannel";
import {
  HOST_METHOD_TIMEOUTS_MS, JELLYFIN_WINDOWS_DOWNLOAD_URL, parseInstallStatus, parseJellyfinDetection, parsePickFolderResult, parseStartResult,
  type JellyfinLocalDetection, type PickFolderParams, type PickFolderResult,
} from "../../serverHost/hostMethods";
import type { HostMethod } from "../../serverHost/hostProtocol";
import type { SetupJellyfinInstall, SetupJellyfinStart, SetupLocalJellyfin } from "../setupAppHostContract";
import { SetupError } from "../setupErrors";

/**
 * Les gestes de l'hôte de l'app Windows, demandés par le canal IPC
 * (`hostChannel.ts`) et lus de façon TOLÉRANTE (`hostMethods.ts`). Un hôte
 * absent, plus ancien ou muet : `host_unavailable` — jamais un plantage, et
 * l'assistant garde son repli (la page officielle, puis la détection).
 *
 * La dernière détection est gardée : le contexte de l'assistant en tire
 * l'adresse proposée d'office (le port lu dans la configuration de Jellyfin,
 * pas 8096 supposé).
 */
let lastDetection: JellyfinLocalDetection | null = null;

export function appHostServes(method: HostMethod): boolean {
  return hostSupports(method);
}

async function call<T>(method: HostMethod, params: unknown, parse: (raw: unknown) => T | null): Promise<T> {
  if (!hostSupports(method)) throw new SetupError("host_unavailable");
  let raw: unknown;
  try {
    raw = await requestHost(method, params, HOST_METHOD_TIMEOUTS_MS[method]);
  } catch {
    throw new SetupError("host_unavailable");
  }
  const parsed = parse(raw);
  if (parsed === null) throw new SetupError("host_unavailable");
  return parsed;
}

export async function detectLocalJellyfin(): Promise<SetupLocalJellyfin> {
  const found = await call("jellyfin.detect", undefined, parseJellyfinDetection);
  lastDetection = found;
  const { port: _port, ...rest } = found;
  return { ...rest, docsUrl: JELLYFIN_WINDOWS_DOWNLOAD_URL };
}

/** L'adresse du Jellyfin de la machine d'après la dernière détection ; `null` avant la première. */
export function detectedJellyfinUrl(): string | null {
  return lastDetection?.url ?? null;
}

const withDocs = (status: Omit<SetupJellyfinInstall, "docsUrl">): SetupJellyfinInstall => ({ ...status, docsUrl: JELLYFIN_WINDOWS_DOWNLOAD_URL });

export async function startJellyfinInstall(): Promise<SetupJellyfinInstall> {
  return withDocs(await call("jellyfin.install", undefined, parseInstallStatus));
}

export async function jellyfinInstallStatus(): Promise<SetupJellyfinInstall> {
  return withDocs(await call("jellyfin.installStatus", undefined, parseInstallStatus));
}

export function startLocalJellyfin(): Promise<SetupJellyfinStart> {
  return call("jellyfin.start", undefined, parseStartResult);
}

export function pickFolderOnHost(params: PickFolderParams): Promise<PickFolderResult> {
  return call("dialog.pickFolder", params, parsePickFolderResult);
}

/** Pour les tests : oublie la dernière détection. */
export function resetAppHostCache(): void {
  lastDetection = null;
}
