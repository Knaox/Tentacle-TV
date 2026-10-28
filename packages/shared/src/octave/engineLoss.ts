/**
 * Octave — le moteur a-t-il PERDU le titre que montre la barre ? Libéré pendant que l'app était derrière
 * (Android : application balayée en pause, le JS survivant au balayage) ou relancé, il ne connaît plus
 * rien : sa « reprise » ne ferait aucun son, et le bouton resterait sur « Pause » dans le silence. La
 * « Lecture » le lui redonne alors, à sa position (`OctavePlayer.resume`).
 */

import { currentItem } from "./queueModel";
import type { OctavePlayer } from "./octavePlayer";

export function engineLostCurrent(player: OctavePlayer): boolean {
  const snap = player.snapshot.get();
  // Pendant un départ, le titre n'est pas encore au moteur : rien n'est perdu.
  if (snap.phase === "starting") return false;
  const item = currentItem(snap.queue);
  const key = item ? player.engineKeys.get(item.uid) : undefined;
  return key !== undefined && player.deps.engine.getState().trackKey !== key;
}
