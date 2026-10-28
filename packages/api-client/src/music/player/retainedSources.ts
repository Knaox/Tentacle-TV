/**
 * Octave — le cache des SOURCES gardé d'une session du lecteur à l'autre. Sur le mobile, sortir d'Octave
 * démonte le lecteur : y revenir et relancer un titre le trouvait sans source, à redemander au serveur — et,
 * pour un titre de l'extension, à refaire résoudre (plusieurs secondes). Gardé, le titre déjà résolu repart
 * aussitôt ; une source expirée se redemande comme avant (`SourceCache.peek`).
 *
 * Un seul propriétaire à la fois (serveur + compte) : un autre compte repart d'un cache vide. Les résolveurs
 * suivent la DERNIÈRE session (son extension, son client de requêtes), jamais une session démontée.
 */

import { SourceCache, type SourceResolvers } from "@tentacle-tv/shared/octave";

let retained: { owner: string; cache: SourceCache; target: { resolvers: SourceResolvers } } | null = null;

/** Le cache de ce propriétaire, repris s'il existe ; `owner` nul : un cache neuf, jamais gardé. */
export function retainedSourceCache(owner: string | null, resolvers: SourceResolvers): SourceCache {
  if (owner === null) return new SourceCache(resolvers);
  if (retained?.owner === owner) {
    retained.target.resolvers = resolvers;
    return retained.cache;
  }
  const target = { resolvers };
  const cache = new SourceCache({
    library: (id) => target.resolvers.library(id),
    external: (track, intent) => target.resolvers.external(track, intent),
    now: () => target.resolvers.now(),
    kept: (trackKey) => target.resolvers.kept?.(trackKey) ?? null,
  });
  retained = { owner, cache, target };
  return cache;
}

/** Tests : oublie le cache gardé. */
export function forgetRetainedSourcesForTests(): void {
  retained = null;
}
