/**
 * Octave — ce que l'extension dit des identités qui ont changé (ses attentes,
 * `PendingMusicItem.formerIds`), donné au magasin de la musique gardée
 * (`setKeptRenames`) : un titre importé gardé sous sa fiche d'hier reste reconnu
 * sous sa clé d'aujourd'hui, réglage de tenue à jour allumé ou non.
 *
 * Même requête (et même cache) que les vues qui montrent les attentes : aucune de
 * plus quand une playlist est ouverte ; rien du tout sans la musique gardée (le
 * web, une session de profil).
 */

import { useEffect } from "react";
import { useMusicPending } from "@tentacle-tv/api-client";
import { useOctaveProvider } from "../mode/useOctaveProvider";
import { type MusicOfflineSurface, renamesOf, shownToFormer } from "@tentacle-tv/offline-core/music";
import { setKeptRenames } from "./keptMusicStore";

export function useKeptRenames(surface: MusicOfflineSurface): void {
  const provider = useOctaveProvider();
  const { data } = useMusicPending(surface.visible ? provider : null);
  const items = data.items;
  useEffect(() => setKeptRenames(shownToFormer(renamesOf(items))), [items]);
}
