/**
 * Octave (mobile) — ce que l'extension dit des identités qui ont changé (ses
 * attentes, `PendingMusicItem.formerIds`), donné au magasin de la musique gardée :
 * un titre importé gardé sous sa fiche d'hier reste reconnu sous sa clé
 * d'aujourd'hui. Même requête (et même cache) que les vues qui montrent les
 * attentes ; rien du tout sans la musique gardée (une session de profil).
 */

import { useEffect } from "react";
import { useMusicPending, type MusicProvider } from "@tentacle-tv/api-client";
import { renamesOf, shownToFormer, type MusicOfflineSurface } from "@tentacle-tv/offline-core/music";
import { keptMusicStore } from "./keptMusic";

export function useKeptRenames(surface: MusicOfflineSurface, provider: MusicProvider | null): void {
  const { data } = useMusicPending(surface.visible ? provider : null);
  const items = data.items;
  useEffect(() => keptMusicStore.setRenames(shownToFormer(renamesOf(items))), [items]);
}
