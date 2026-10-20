import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  mergeHiddenHomeRows,
  recoRowTitle,
  reconcileHomeRows,
  useHomeLayout,
  useLibraries,
  useSaveHomeLayoutPatch,
  useServerCapabilities,
  visibleHomeRows,
} from "@tentacle-tv/api-client";
import type { HomeRowDescriptor } from "@tentacle-tv/api-client";

export interface HomeRowsEditorModel {
  /** La préférence d'accueil ET les bibliothèques ont répondu. */
  ready: boolean;
  /** L'une des deux lectures a échoué. */
  failed: boolean;
  rows: HomeRowDescriptor[];
  labelFor: (key: string) => string;
  onChange: (rows: HomeRowDescriptor[]) => void;
}

/**
 * Ce que l'éditeur des rangées de l'accueil (`HomeRowsEditor`) manipule — la
 * préférence du COMPTE (`/api/preferences/home-layout`) : Réglages ›
 * Personnalisation et l'étape « Votre accueil » du premier lancement du web
 * étroit lisent le MÊME modèle.
 *
 * La liste COMPLÈTE (clés hors catalogue comprises : elles restent stockées)
 * et la liste VISIBLE que l'éditeur manipule — seules les rangées que ce
 * serveur sait servir se proposent (« Films pour vous » : `reco.moviesRow`).
 */
export function useHomeRowsEditorModel(): HomeRowsEditorModel {
  const { t: tCommon } = useTranslation("common");
  const { t: tReco } = useTranslation("reco");
  const layoutQuery = useHomeLayout();
  const librariesQuery = useLibraries();
  const layout = layoutQuery.data;
  const libraries = librariesQuery.data;
  const libs = useMemo(() => (libraries ?? []).map((l) => ({ id: l.Id, name: l.Name })), [libraries]);
  const saveLayout = useSaveHomeLayoutPatch({ libraries: libs });

  const all = useMemo(
    () =>
      layout
        ? reconcileHomeRows(layout.rows, libs, {
            // Même ancre que l'accueil : l'éditeur doit montrer l'ordre RÉEL.
            anchorNewLibraries: layout.stored === false,
            catalog: layout.catalog,
          })
        : [],
    [layout, libs],
  );
  const serverCaps = useServerCapabilities();
  const editorCapabilities = serverCaps.known ? serverCaps.capabilities : undefined;
  const rows = useMemo(() => visibleHomeRows(all, layout?.catalog, editorCapabilities), [all, layout?.catalog, editorCapabilities]);

  // Les rangées cachées reprennent leur place derrière celles que l'éditeur a
  // ordonnées : une clé TMDB retirée puis remise ne perd rien. Patch
  // FONCTIONNEL : appliqué sur la copie fraîche du serveur, réconciliée.
  const { mutate } = saveLayout;
  const onChange = useCallback(
    (next: HomeRowDescriptor[]) => mutate((fresh) => ({ rows: mergeHiddenHomeRows(fresh.rows, next, fresh.catalog) })),
    [mutate],
  );

  const labelFor = useCallback((key: string): string => {
    if (key === "resume") return tCommon("common:resumeWatching");
    if (key === "nextUp") return tCommon("common:nextEpisodes");
    if (key === "watchlist") return tCommon("common:myList");
    if (key === "watched") return tCommon("common:alreadyWatched");
    if (key === "favorites") return tCommon("common:myFavorites");
    if (key.startsWith("library:")) {
      const id = key.slice("library:".length);
      return tCommon("common:latestAdditions", { name: libraries?.find((l) => l.Id === id)?.Name ?? "?" });
    }
    if (key.startsWith("reco:")) {
      // Même table que les rangées elles-mêmes (tendances, pouls, mieux notés compris).
      return tReco(recoRowTitle({ key: key.slice("reco:".length) }).key);
    }
    return key;
  }, [tCommon, tReco, libraries]);

  return {
    ready: layout !== undefined && libraries !== undefined,
    failed: layoutQuery.isError || librariesQuery.isError,
    rows,
    labelFor,
    onChange,
  };
}
