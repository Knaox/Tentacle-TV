/**
 * Octave (mobile) — les entrées de navigation que CE compte voit, règle PURE (`offlineNavRule.test.ts`) :
 * « Hors ligne » seulement derrière la porte du hors ligne d'Octave (compte de l'appareil, droit `keepOffline`,
 * jamais une session de profil) ; les autres toujours.
 */

import type { OctaveTab } from "@tentacle-tv/shared/octave/mode";

export function visibleNavItems<T extends { tab: OctaveTab }>(items: readonly T[], offlineShown: boolean): readonly T[] {
  return offlineShown ? items : items.filter((item) => item.tab !== "offline");
}
