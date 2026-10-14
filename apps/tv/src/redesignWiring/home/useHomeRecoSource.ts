import { useMemo } from "react";
import { useRecoPageVisit, useRecoSettings, type HomeRowDescriptor, type RecoRowItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useItemsByIds } from "../items/useItemsByIds";

const EMPTY: number[] = [];

export interface HomeRecoRow {
  /** La clé de la mise en page : `reco:<rangée servie>`. */
  layoutKey: string;
  row: { key: string; seedTitle?: string };
  /** Les titres EN bibliothèque, chacun avec son item Jellyfin (s'il est chargé). */
  entries: Array<{ reco: RecoRowItem; item: MediaItem }>;
  /** Les titres de la rangée dans l'ordre servi — les absents compris si `external`. */
  recos: RecoRowItem[];
}

/**
 * Les rangées `reco:<rangée>` de l'accueil : lues dans LA page du filtre du
 * compte — la même requête que « Pour vous », le web et le mobile. Sans
 * demande possible, le téléviseur ne montre que les titres en bibliothèque ;
 * garde Vigie ouverte (`external`), les titres absents restent à leur place
 * (`recos`), à demander. Une carte de la bibliothèque a besoin de son item
 * Jellyfin : images, empreintes, état de lecture (`useItemsByIds`, un lot pour
 * toute la page).
 */
export function useHomeRecoSource(layout: readonly HomeRowDescriptor[], external = false): HomeRecoRow[] {
  const wanted = useMemo(() => layout.filter((row) => row.key.startsWith("reco:")).map((row) => row.key), [layout]);
  const settings = useRecoSettings();
  // Le filtre du compte d'abord : sans cette garde, la page « toutes
  // plateformes » partirait avant la page filtrée (cf. TVRecoRow).
  const settingsReady = settings.isSuccess || settings.isError;
  const { data: page } = useRecoPageVisit(settings.data?.providerFilter ?? EMPTY, { enabled: settingsReady && wanted.length > 0 });

  const served = useMemo(() => {
    const rows = page?.rows ?? [];
    return wanted.flatMap((layoutKey) => {
      const row = rows.find((candidate) => candidate.key === layoutKey.slice("reco:".length));
      return row ? [{ layoutKey, row, recos: external ? row.items : row.items.filter((item) => item.jellyfinItemId !== null) }] : [];
    });
  }, [page, wanted, external]);

  const ids = useMemo(
    () => served.flatMap((row) => row.recos.flatMap((reco) => (reco.jellyfinItemId ? [reco.jellyfinItemId] : []))),
    [served],
  );
  const items = useItemsByIds(ids);

  return useMemo(
    () =>
      served.map(({ layoutKey, row, recos }) => ({
        layoutKey,
        row,
        entries: recos.flatMap((reco) => {
          const item = reco.jellyfinItemId ? items.get(reco.jellyfinItemId) : undefined;
          return item ? [{ reco, item }] : [];
        }),
        recos,
      })),
    [served, items],
  );
}
