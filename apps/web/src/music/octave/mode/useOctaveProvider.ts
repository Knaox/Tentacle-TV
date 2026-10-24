/**
 * Octave — l'extension musique de CE serveur pour ce compte, ou `null` : la
 * porte d'A5 (`useMusicProvider` : capacité `plugins.isolatedRuntime`,
 * extension active et configurée, contrat `music` valide, liste déjà filtrée
 * par le serveur pour le compte). `null` : rien hors bibliothèque, nulle part.
 */

import { useMusicProvider, type MusicProvider } from "@tentacle-tv/api-client";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";

export function useOctaveProvider(): MusicProvider | null {
  return useMusicProvider(useActivePluginsMeta());
}

/** Ce titre vient-il de CETTE extension (et donc ses gestes sont-ils possibles) ? */
export function isFromProvider(provider: MusicProvider | null, pluginId: string | null | undefined): provider is MusicProvider {
  return provider !== null && !!pluginId && provider.pluginId === pluginId;
}
