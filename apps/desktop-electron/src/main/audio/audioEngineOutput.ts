/**
 * La SORTIE de l'instance audio, sortie de `audioEngine.ts` : périphérique, mode exclusif, et la chaîne de
 * filtres qui les suit (mesure du niveau, gain de la transition douce : jamais en mode exclusif).
 */

import { LEVEL_FILTER } from "./audioLevel";
import { outputOptions, type Platform } from "./audioOptions";
import type { Settings } from "./audioEngineState";
import { deckChain } from "./crossfadeFilter";

interface OutputMpv {
  set: (name: string, value: string) => Promise<string | null>;
}

/** La chaîne `af` : rien en mode exclusif, la mesure seule, ou la mesure et le gain du fondu (`expr` à sa naissance). */
export function chainFor(exclusive: boolean, expr: string | null): string {
  if (exclusive) return "";
  return expr === null ? LEVEL_FILTER : deckChain(expr);
}

/** Règle la sortie ; rend les refus de mpv (vide : tout est pris). */
export async function applyOutput(mpv: OutputMpv, platform: Platform, settings: Settings, deviceId: string | null, exclusive: boolean): Promise<string[]> {
  // Le filtre de mesure suit le mode exclusif (`audioLevel.ts`) — posé ou retiré avec la sortie, qui se rouvre de toute façon.
  const filter = exclusive === settings.exclusive ? {} : { af: chainFor(exclusive, null) };
  Object.assign(settings, { deviceId, exclusive });
  const options = { ...outputOptions(platform, deviceId, exclusive), ...filter };
  return (await Promise.all(Object.entries(options).map(([k, v]) => mpv.set(k, v)))).filter((e): e is string => e !== null);
}
