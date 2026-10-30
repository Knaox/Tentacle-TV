/**
 * Octave — une rubrique de la bibliothèque rangée par la règle partagée (`useAlbumShelf`…) : « Vos favoris » en
 * tête (s'il y en a), puis le reste sous son propre titre. Les cartes y lisent leur rubrique (`ShelfScopeContext` :
 * « Mettre en haut », « Réordonner ») ; « Réordonner » ouvre la fenêtre de la section de l'élément choisi.
 */

import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpDown } from "lucide-react";
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
  // « Réordonner » VISIBLE à côté du titre (lot fl : il ne vivait que dans le menu d'une carte).
  const reorderButton = (items: readonly T[], which: "favorites" | "rest") =>
    items.length > 1 && shelf.ordered(shelf.keyOf(items[0]!)) ? <ReorderButton label={t("actions.reorder")} onClick={() => setReordering(which)} /> : undefined;
  return (
    <ShelfScopeContext.Provider value={scope}>
      {hasFavorites && (
        <Shelf title={t("shelfTitle")} action={reorderButton(shelf.favorites, "favorites")}>
          <CardGrid>{shelf.favorites.map(renderCard)}</CardGrid>
        </Shelf>
      )}
      {between}
      {hasFavorites && shelf.rest.length > 0 ? (
        <Shelf title={t(`restTitle.${section}`)} action={restAction ?? reorderButton(shelf.rest, "rest")}>
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

export function ReorderButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-content-secondary transition-colors duration-150 hover:bg-octave-hover hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      <ArrowUpDown className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}
