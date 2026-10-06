import { useEffect, useSyncExternalStore } from "react";
import { NativeEventEmitter, NativeModules } from "react-native";
import { parseDeviceMediaProfile, simulatedDeviceProfile, type DeviceMediaProfile } from "@tentacle-tv/shared";
import { plog } from "../utils/playerDiag";

/**
 * Le profil de décodage de CET appareil (`DeviceMediaProfile`, shared), lu par
 * le module natif Android (`MediaCapabilitiesModule`) — ou le profil SIMULÉ
 * que le banc a demandé (`debug.tentacle.media_profile`, app de mesure
 * seulement). Sur l'Apple TV, aucun module : `null`, rien ne change.
 *
 * Lu à la PREMIÈRE ouverture du lecteur (rien au démarrage de l'app), gardé
 * pour la vie du processus, relu quand la sortie change (HDMI, mode). Le
 * lecteur l'attend au plus `WAIT_MS` : au-delà, il part sans (déclarations
 * fixes, comme avant) et le profil servira au titre suivant.
 */

interface NativeProfile {
  json: string;
  simulated: string | null;
  elapsedMs: number;
}

interface MediaCapabilitiesNative {
  getProfile(): Promise<NativeProfile>;
}

const native: MediaCapabilitiesNative | undefined = NativeModules.TentacleMediaCapabilities;

/** L'attente la plus longue du lecteur avant de partir sans profil. */
export const WAIT_MS = 1500;

type Status = "idle" | "loading" | "ready";

let profile: DeviceMediaProfile | null = null;
let status: Status = native ? "idle" : "ready";
let snapshot: { profile: DeviceMediaProfile | null; pending: boolean } = { profile, pending: status !== "ready" };
const listeners = new Set<() => void>();

function publish(): void {
  const pending = status !== "ready";
  if (snapshot.profile === profile && snapshot.pending === pending) return;
  snapshot = { profile, pending };
  for (const listener of listeners) listener();
}

/** Le profil à retenir : le simulé s'il est demandé et connu, sinon le réel. */
function pick(result: NativeProfile): DeviceMediaProfile | null {
  const simulated = simulatedDeviceProfile(result.simulated);
  if (result.simulated && !simulated) plog("caps", `profil simulé inconnu « ${result.simulated} » — profil réel`);
  return simulated ?? parseDeviceMediaProfile(JSON.parse(result.json));
}

let requested = false;

/** Une seule lecture par processus ; un échec se retente à la prochaine ouverture. */
function load(): void {
  if (!native || requested) return;
  requested = true;
  status = "loading";
  publish();
  const timer = setTimeout(() => { if (status === "loading") { status = "ready"; publish(); } }, WAIT_MS);
  native.getProfile().then((result) => {
    profile = pick(result);
    plog("caps", `profil ${profile?.source ?? "absent"} ${profile?.name ?? ""} (${Math.round(result.elapsedMs)} ms)`);
  }).catch(() => {
    requested = false;
    plog("caps", "profil illisible — déclarations fixes");
  }).finally(() => {
    clearTimeout(timer);
    status = "ready";
    publish();
  });
}

let watching = false;

/** Un changement de sortie (HDMI, mode) : le profil se relit, l'ancien sert en attendant. */
function watch(): void {
  if (!native || watching) return;
  watching = true;
  new NativeEventEmitter(NativeModules.TentacleMediaCapabilities).addListener("TentacleMediaProfileChanged", () => {
    native.getProfile().then((result) => {
      const next = pick(result);
      if (JSON.stringify(next) === JSON.stringify(profile)) return;
      profile = next;
      plog("caps", `sortie changée → profil relu (${profile?.display.width}×${profile?.display.height})`);
      publish();
    }).catch(() => undefined);
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const getSnapshot = () => snapshot;

/** Le profil de l'appareil, et s'il est encore attendu (`pending`). */
export function useDeviceMediaProfile(): { profile: DeviceMediaProfile | null; pending: boolean } {
  useEffect(() => { load(); watch(); }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
