/**
 * Octave mobile — « Lire ensuite » et « Ajouter à la file », suivis d'une confirmation BRÈVE (« Sera lu
 * ensuite », « Ajouté à la file d'attente », le titre dessous) : la même par le balayage d'une rangée, ses
 * actions d'accessibilité et la feuille « ⋯ ». Sans elle, le geste de la feuille ne disait rien.
 */

import type { TFunction } from "i18next";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { queueActions, type OctavePlayer } from "@tentacle-tv/shared/octave";
import { showNotice } from "../env/notices";

/** `t` : l'espace `musicLists`. */
export function playNextWithNotice(player: OctavePlayer, track: MusicTrack, t: TFunction): void {
  queueActions.playNext(player, [track]);
  showNotice("success", track.title, { title: t("swipe.nextNotice") });
}

export function enqueueWithNotice(player: OctavePlayer, track: MusicTrack, t: TFunction): void {
  queueActions.enqueue(player, [track]);
  showNotice("success", track.title, { title: t("swipe.queuedNotice") });
}
