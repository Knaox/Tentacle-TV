/**
 * La barre de l'activité en direct qui avance SEULE. Sur iOS, le JavaScript
 * est suspendu dès que l'application passe derrière (le transfert continue,
 * lui, dans la session d'arrière-plan du système) : la Live Activity ne peut
 * plus être mise à jour. Le compte à rebours avance déjà seul ; la barre aussi,
 * si on lui donne un départ et une arrivée — `ProgressView(timerInterval:)`.
 *
 * Le départ est VIRTUEL : l'instant où l'avancement aurait été nul si tout le
 * lot avait tourné au débit d'aujourd'hui. De là, à `nowMs`, la barre est
 * exactement à `percent`, et elle touche la fin à `endsAtMs`.
 */

import type { LiveContent } from "./livePublish";

export function liveBarStartMs(content: Pick<LiveContent, "phase" | "percent" | "endsAtMs">, nowMs: number): number | null {
  const { percent, endsAtMs } = content;
  if (content.phase !== "transferring" || percent === null || endsAtMs === null) return null;
  if (endsAtMs <= nowMs || percent >= 100) return null;
  const fraction = Math.max(0, percent) / 100;
  return Math.round(nowMs - (fraction / (1 - fraction)) * (endsAtMs - nowMs));
}
