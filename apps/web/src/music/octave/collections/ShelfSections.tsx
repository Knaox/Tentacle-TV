/**
 * Octave — une rubrique de la bibliothèque rangée par la règle partagée (`useAlbumShelf`…) : « Vos favoris » en
 * tête (s'il y en a), puis le reste sous son propre titre. Les cartes y lisent leur rubrique (`ShelfScopeContext` :
 * « Mettre en haut », « Réordonner ») ; « Réordonner » ouvre la fenêtre de la section de l'élément choisi.
 */

import { useMemo, useState, type ReactNode } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { LibraryShelf } from "@tentacle-tv/api-client";
import type { MusicShelfSection } from "@tentacle-tv/shared/music";
import { CardGrid, Shelf } from "../components/Cards";
import { ShelfScopeContext, type ShelfScope } from "./shelfContext";
import { ShelfReorderDialog, type ReorderRow } from "./ShelfReorderDialog";

interface Props<T> {
  section: MusicShelfSection;
  shelf: LibraryShelf<T>;
  renderCard: (item: T) => ReactNode;
  /** Une rangée de la fenêtre « Réordonner » (titre, sous-titre, vignette). */
  describe: (item: T, t: TFunction) => Omit<ReorderRow, "key">;
  /** Ce qui se pose entre les favoris et le reste (le tri des albums, les imports). */
  between?: ReactNode;
  /** À côté du titre du reste (le tri des albums). */
  restAction?: ReactNode;
  /** Après la grille du reste (charger la suite). */
  after?: ReactNode;
}

export function ShelfSections<T>({ section, shelf, renderCard, describe, between, restAction, after }: Props<T>) {
  const { t } = useTranslation("musicFavorites");
  const { t: tm } = useTranslation("music");
  const [reordering, setReordering] = useState<"favorites" | "rest" | null>(null);
  const scope = useMemo<ShelfScope>(
    () => ({ section, shelf: shelf as unknown as ShelfScope["shelf"], reorder: (key) => setReordering(shelf.sectionOf(key)) }),
    [section, shelf],
  );
  const rows = useMemo(() => {
    const items = reordering === "favorites" ? shelf.favorites : reordering === "rest" ? shelf.rest : [];
    return items.map((item) => ({ key: shelf.keyOf(item), ...describe(item, tm as TFunction) }));
  }, [reordering, shelf, describe, tm]);
  const hasFavorites = shelf.favorites.length > 0;
  return (
    <ShelfScopeContext.Provider value={scope}>
      {hasFavorites && (
        <Shelf title={t("shelfTitle")}>
          <CardGrid>{shelf.favorites.map(renderCard)}</CardGrid>
        </Shelf>
      )}
      {between}
      {hasFavorites && shelf.rest.length > 0 ? (
        <Shelf title={t(`restTitle.${section}`)} action={restAction}>
          <CardGrid>{shelf.rest.map(renderCard)}</CardGrid>
        </Shelf>
      ) : (
        <>
          {restAction && <div className="flex px-2">{restAction}</div>}
          <CardGrid>{shelf.rest.map(renderCard)}</CardGrid>
        </>
      )}
      {after}
      {reordering && rows.length > 0 && <ShelfReorderDialog rows={rows} onMove={shelf.move} onClose={() => setReordering(null)} />}
    </ShelfScopeContext.Provider>
  );
}
