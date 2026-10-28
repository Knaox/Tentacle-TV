/**
 * Octave (mobile) — un titre gardé hors ligne se lit TOUJOURS depuis le téléphone. Le lecteur prend déjà la
 * copie au départ (`keptPlayback.ts`, avant le cache des sources) ; restent les cas où elle arrive APRÈS :
 * la liste des copies se charge un instant après l'ouverture d'Octave (un « Lecture » plus rapide partait du
 * serveur), ou la copie s'achève pendant l'écoute. Le titre en cours (et le suivant déjà donné au moteur)
 * passent alors au fichier, à la même position (`refreshEngineSource`) : une perte de réseau ensuite ne coupe
 * plus rien.
 *
 * Le magasin des copies est tenu ouvert tant que le lecteur vit : sans lui, la liste ne se chargeait qu'à
 * l'ouverture d'une vue qui la montre.
 */

import { currentItem, refreshEngineSource, type OctavePlayer, type PlayerSnapshot } from "@tentacle-tv/shared/octave";
import { subscribeKeptMusic } from "../offline/keptMusic";
import { keptPlaybackSource } from "../offline/keptPlayback";

export interface KeptSwapState {
  snapshot: PlayerSnapshot;
  engineKeys: ReadonlyMap<string, string>;
  nextUid: string | null;
  nextFromDevice: boolean;
}

/** Les clés MOTEUR (courant, suivant) qui jouent depuis le serveur alors qu'une copie complète est là. */
export function keptSwapTargets(state: KeptSwapState, hasKept: (trackKey: string) => boolean): string[] {
  const { snapshot } = state;
  const out: string[] = [];
  const item = currentItem(snapshot.queue);
  // Pendant un départ, le lecteur choisit encore sa source : il prendra la copie lui-même.
  if (item && !snapshot.fromDevice && snapshot.phase !== "starting" && snapshot.phase !== "error" && hasKept(item.track.key)) {
    const key = state.engineKeys.get(item.uid);
    if (key) out.push(key);
  }
  const next = state.nextUid ? snapshot.queue.items.find((i) => i.uid === state.nextUid) : undefined;
  if (next && !state.nextFromDevice && hasKept(next.track.key)) {
    const key = state.engineKeys.get(next.uid);
    if (key) out.push(key);
  }
  return out;
}

/** Tient le magasin des copies ouvert et fait passer au fichier ce qui joue encore du serveur ; rend le détachement. */
export function followKeptCopies(player: OctavePlayer): () => void {
  // Une bascule en cours ne se redemande pas (le magasin notifie à chaque octet transféré).
  const pending = new Set<string>();
  const sync = () => {
    if (player.restoredAtMs !== null) return; // rien ne joue encore : « Lecture » prendra la copie
    const targets = keptSwapTargets(
      { snapshot: player.snapshot.get(), engineKeys: player.engineKeys, nextUid: player.nextUid, nextFromDevice: player.nextFromDevice },
      (key) => keptPlaybackSource(key) !== null,
    );
    for (const key of targets) {
      if (pending.has(key)) continue;
      pending.add(key);
      refreshEngineSource(player, key);
      setTimeout(() => pending.delete(key), 5_000);
    }
  };
  const offStore = subscribeKeptMusic(sync);
  const offPlayer = player.snapshot.subscribe(sync);
  return () => {
    offStore();
    offPlayer();
  };
}
