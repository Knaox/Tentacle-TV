/**
 * Octave (mobile) — l'extension musique de CE serveur pour ce compte, ou `null` : la porte partagée
 * (`useMusicProvider` : capacité `plugins.isolatedRuntime`, extension active et configurée, contrat `music`
 * valide) sur la liste des extensions actives de l'app. `null` : rien hors bibliothèque.
 */

import { useMusicProvider, type MusicProvider } from "@tentacle-tv/api-client";
import type { MusicCapablePlugin } from "@tentacle-tv/shared/music";
import { useActivePlugins } from "@/hooks/useActivePlugins";

export function useMobileMusicProvider(): MusicProvider | null {
  const { data } = useActivePlugins();
  // La liste arrive telle que le serveur la sert (champ `music` compris) : le contrat la valide.
  return useMusicProvider(data as readonly MusicCapablePlugin[] | undefined);
}
