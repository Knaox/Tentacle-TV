/**
 * Octave — les extensions musique, vues par l'interface (points d'extension
 * 1 à 5, pluginMusicContract.ts).
 *
 * ADAPTATEUR provisoire : la porte officielle viendra de l'api-client
 * (`packages/api-client/src/pluginMusic/*`, agent 5). D'ici là, la garde est
 * la même que celle du contrat — capacité `plugins.isolatedRuntime` ET
 * extension active, configurée, déclarant un `music` valide (les droits du
 * compte sont appliqués par le serveur : `/api/plugins/active` ne relaie
 * `music` qu'à un compte permis). Sinon : liste vide, et RIEN hors
 * bibliothèque ne s'affiche nulle part.
 */

import { useMemo } from "react";
import { useServerCapability } from "@tentacle-tv/api-client";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";
import { readPluginMusicManifest, type PluginMusicManifest } from "@tentacle-tv/shared/music";

export interface MusicProvider {
  pluginId: string;
  name: string;
  manifest: PluginMusicManifest;
}

interface PluginMetaLike {
  pluginId: string;
  name: string;
  configEnabled?: boolean;
}

/** La règle, pure : quelles extensions offrent la musique hors bibliothèque. */
export function musicProvidersOf(runtimeDeclared: boolean, metas: readonly PluginMetaLike[]): MusicProvider[] {
  if (!runtimeDeclared) return [];
  const out: MusicProvider[] = [];
  for (const meta of metas) {
    if (meta.configEnabled !== true) continue;
    // Le champ `music` est relayé par `/api/plugins/active` (contrat) ; lu sans le présumer.
    const manifest = readPluginMusicManifest((meta as PluginMetaLike & { music?: unknown }).music);
    if (manifest) out.push({ pluginId: meta.pluginId, name: meta.name, manifest });
  }
  return out;
}

export function useMusicProviders(): MusicProvider[] {
  const runtime = useServerCapability("plugins.isolatedRuntime");
  const metas = useActivePluginsMeta();
  return useMemo(() => musicProvidersOf(runtime, metas), [runtime, metas]);
}

/** Le nom de la section de recherche d'une extension, dans la langue, sinon les mots du cœur. */
export function providerSectionLabel(provider: MusicProvider, lang: string, fallback: string): string {
  const labels = provider.manifest.labels ?? {};
  return labels[lang.slice(0, 2)] ?? fallback;
}
