/**
 * Octave (mobile) — l'extension de musique de CE serveur pour ce compte (Sillon),
 * ou `null` : la même porte que le bureau (`useMusicProvider` d'api-client :
 * capacité `plugins.isolatedRuntime`, extension active et configurée, contrat
 * `music` valide), sur la liste des extensions que le mobile lit déjà.
 */

import { useMusicProvider, type MusicProvider } from "@tentacle-tv/api-client";
import type { MusicCapablePlugin } from "@tentacle-tv/shared/music";
import { useActivePlugins } from "@/hooks/useActivePlugins";

export function useMusicOfflineProvider(): MusicProvider | null {
  const { data } = useActivePlugins();
  // Le serveur relaie le champ `music` du manifeste tel quel ; le contrat le valide (`findMusicProvider`).
  return useMusicProvider(data as readonly MusicCapablePlugin[] | undefined);
}
