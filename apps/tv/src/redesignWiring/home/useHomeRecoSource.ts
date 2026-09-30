import { useMemo } from "react";
import { useRecoPage, useRecoSettings, type HomeRowDescriptor, type RecoRowItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useItemsByIds } from "../items/useItemsByIds";

const EMPTY: number[] = [];

export interface HomeRecoRow {
  /** La clé de la mise en page : `reco:<rangée servie>`. */
  layoutKey: string;
  row: { key: string; seedTitle?: string };
  /** Les titres EN bibliothèque, chacun avec son item Jellyfin (s'il est chargé). */
  entries: Array<{ reco: RecoRowItem; item: MediaItem }>;
}

/**
 * Les rangées `reco:<rangée>` de l'accueil : lues dans LA page du filtre du
 * compte — la même requête que « Pour vous », le web et le mobile. Le
 * téléviseur ne montre que les titres en bibliothèque (rien à demander à trois
 * mètres), et une carte refondue a besoin de leur item Jellyfin : images,
 * empreintes, état de lecture (`useItemsByIds`, un lot pour toute la page).
 */
export function useHomeRecoSource(layout: readonly HomeRowDescriptor[]): HomeRecoRow[] {
  const wanted = useMemo(() => layout.filter((row) => row.key.startsWith("reco:")).map((row) => row.key), [layout]);
  const settings = useRecoSettings();
  // Le filtre du compte d'abord : sans cette garde, la page « toutes
  // plateformes » partirait avant la page filtrée (cf. TVRecoRow).
  const settingsReady = settings.isSuccess || settings.isError;
  const { data: page } = useRecoPage(settings.data?.providerFilter ?? EMPTY, { enabled: settingsReady && wanted.length > 0 });

  const served = useMemo(() => {
    const rows = page?.rows ?? [];
    return wanted.flatMap((layoutKey) => {
      const row = rows.find((candidate) => candidate.key === layoutKey.slice("reco:".length));
      return row ? [{ layoutKey, row, recos: row.items.filter((item) => item.jellyfinItemId !== null) }] : [];
    });
  }, [page, wanted]);

  const ids = useMemo(() => served.flatMap((row) => row.recos.map((reco) => reco.jellyfinItemId as string)), [served]);
  const items = useItemsByIds(ids);

  return useMemo(
    () =>
      served.map(({ layoutKey, row, recos }) => ({
        layoutKey,
        row,
        entries: recos.flatMap((reco) => {
          const item = items.get(reco.jellyfinItemId as string);
          return item ? [{ reco, item }] : [];
        }),
      })),
    [served, items],
  );
}
