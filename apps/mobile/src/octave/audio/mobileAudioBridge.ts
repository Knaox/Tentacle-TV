/**
 * Octave (mobile) — le pont du module natif `octave-audio`, devant l'adaptateur PARTAGÉ : une source gardée
 * sur l'appareil devient son fichier local avant de partir (`keptAudioPort.ts`), et les commandes partent
 * DANS L'ORDRE où la page les donne (une résolution de copie ne fait jamais passer un « suivant » avant le
 * « lire » qui le précède). Une source que le téléphone a résolue lui-même part en flux DIRECT
 * (`../clientFetch/directSource.ts`), le serveur en repli.
 */

import type { NativeBridge } from "@tentacle-tv/shared/octave";
import { withDirectSource, type DirectSourceDeps } from "../clientFetch/directSource";
import { keptFileFor } from "./keptAudioPort";

const SOURCE_COMMANDS = new Set(["audio_play", "audio_set_next", "audio_swap_source"]);

/** Les arguments, la source remplacée par sa copie locale si elle existe. */
export async function withLocalSource(command: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!SOURCE_COMMANDS.has(command)) return args;
  const source = args.source as ({ url: string; kept?: unknown } & Record<string, unknown>) | null | undefined;
  if (!source?.kept) return args;
  const local = await keptFileFor(source);
  return local === null ? args : { ...args, source: { ...source, url: local, complete: true } };
}

export function orderedBridge(native: NativeBridge, direct?: DirectSourceDeps): NativeBridge {
  let chain: Promise<unknown> = Promise.resolve();
  const prepare = async (command: string, args: Record<string, unknown>) => {
    const local = await withLocalSource(command, args);
    return direct ? withDirectSource(command, local, direct) : local;
  };
  return {
    invoke: <T>(command: string, args: Record<string, unknown> = {}): Promise<T> => {
      const run = chain.then(async () => native.invoke<T>(command, await prepare(command, args)));
      chain = run.catch(() => undefined);
      return run;
    },
    listen: native.listen,
  };
}
