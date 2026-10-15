import { useMemo } from "react";
import { reconcileHomeRows, useHomeLayout, useLibraries, useServerCapabilities, visibleHomeRows } from "@tentacle-tv/api-client";
import type { HomeRowDescriptor } from "@tentacle-tv/api-client";

/** L'ordre historique du téléviseur — servi tant que la mise en page du compte
 *  n'est pas là (premier chargement, vieux serveur) ; les bibliothèques
 *  s'ajoutent en fin, comme avant. */
export const LEGACY_HOME_ROWS: readonly HomeRowDescriptor[] = [
  { key: "resume", enabled: true },
  { key: "nextUp", enabled: true },
  { key: "watchlist", enabled: true },
  { key: "watched", enabled: true },
];

/**
 * Les rangées de l'accueil, dans l'ordre du compte : la mise en page du
 * serveur — celle que le web édite ; le téléviseur ne fait que la LIRE —
 * réconciliée avec les bibliothèques réelles et le catalogue de ce serveur,
 * réduite aux rangées actives — et à celles que le serveur DÉCLARE savoir
 * servir (« Films pour vous » : `reco.moviesRow`). MÊME réconciliation que le
 * web et le mobile (api-client) : même accueil partout.
 */
export function useTVHomeRows(): { rows: HomeRowDescriptor[] } {
  const { data: layout } = useHomeLayout();
  const { data: libraries } = useLibraries();
  const { capabilities } = useServerCapabilities();
  const rows = useMemo(() => {
    const stored = layout?.rows ?? LEGACY_HOME_ROWS;
    const libs = (libraries ?? []).map((l) => ({ id: l.Id, name: l.Name }));
    return visibleHomeRows(
      reconcileHomeRows(stored, libs, { anchorNewLibraries: layout?.stored === false, catalog: layout?.catalog }),
      layout?.catalog,
      capabilities,
    ).filter((row) => row.enabled);
  }, [layout, libraries, capabilities]);
  return { rows };
}
