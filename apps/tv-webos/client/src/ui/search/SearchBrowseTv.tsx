import { memo, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSearchBrowse, type SearchBrowseTarget as BrowseQuery } from "@tentacle-tv/api-client";
import { personMeta, type MediaItem } from "@tentacle-tv/shared";
import { PosterCard } from "@/components/cards/PosterCard";
import { FocusableCard } from "../cards/FocusableCard";
import { giveFocus } from "../../focus/active";
import { reviewAfterMount } from "../../focus/wait";
import { SearchPortraitTv } from "./SearchPersonTv";
import { isBrowseFresh, settleBrowse, type SearchBrowseTarget } from "./searchState";

/** Largeur d'une affiche : huit colonnes, marges comprises, dans les 1 728 px utiles d'une dalle. */
const CARD_WIDTH = 190;
/** Une filmographie plus longue ne se parcourt plus à la télécommande. */
const LIMIT = 120;

const noop = () => undefined;

/**
 * La recherche approfondie : la filmographie d'une personne, un genre ou un
 * studio — dans la BIBLIOTHÈQUE (`/api/search/person|genre|studio`), rien de
 * ce qui n'est pas sur le serveur. C'est une étagère, pas un catalogue.
 *
 * Posée par-dessus les résultats, dans la même surcouche : Retour la referme
 * d'abord et rend le focus à ce qui l'avait ouverte ; un second Retour ferme la
 * recherche. Les affiches sont celles des rangées (`PosterCard` enveloppée), la
 * grille est une `data-tv-grille` : descendre suit la colonne.
 */
export const SearchBrowseTv = memo(function SearchBrowseTv({ target }: { target: SearchBrowseTarget }) {
  const { t } = useTranslation("search");
  const query = useMemo<BrowseQuery>(
    () => (target.kind === "person" ? { kind: "person", id: target.id } : { kind: target.kind, name: target.name }),
    [target],
  );
  const { data, isError } = useSearchBrowse(query, LIMIT);
  const items = useMemo(() => (data?.items ?? []).map((hit) => hit.item as unknown as MediaItem), [data]);
  const grid = useRef<HTMLDivElement>(null);

  // Ouverte à l'instant : la première affiche prend le focus dès qu'elle est
  // montée. Remontée au retour d'une fiche, c'est la surcouche qui rend la
  // carte qu'on avait quittée — rien à décider ici.
  useEffect(() => {
    if (items.length === 0 || !isBrowseFresh()) return;
    reviewAfterMount(() => {
      const first = grid.current?.querySelector<HTMLElement>("[data-tv-carte]");
      if (!first) return false;
      settleBrowse();
      giveFocus(first);
      return true;
    }, { budgetMs: 1500 });
  }, [items.length]);

  const person = target.kind === "person" ? data?.person ?? null : null;
  const meta = data
    ? `${person ? personMeta(t, person) : t("countTitles", { count: data.total })}  ·  ${
      target.kind === "person" ? t("sortedByYear") : t("sortedByRating")
    }`
    : null;

  return (
    <div className="tv-search-browse" aria-label={target.name}>
      <header className="tv-search-browse-header">
        {target.kind === "person" && (
          <SearchPortraitTv person={person ?? { id: target.id, name: target.name, imageTag: null }} size={176} />
        )}
        <div className="tv-search-browse-heading">
          <p className="tv-search-kicker">{target.kind === "person" ? t("filmographyTitle") : t(target.kind)}</p>
          <h2 className="tv-search-browse-title">{target.name}</h2>
          {meta && <p className="tv-search-browse-meta">{meta}</p>}
        </div>
      </header>

      {!data && (
        <p className="tv-search-message">{isError ? t("noResults", { query: target.name }) : t("searching")}</p>
      )}

      {items.length > 0 && (
        <div ref={grid} className="tv-search-browse-grid" data-tv-grille>
          {items.map((item, index) => (
            <FocusableCard key={item.Id} index={index} width={CARD_WIDTH} itemId={item.Id} item={item} onActiveIndex={noop}>
              <PosterCard item={item} index={index} width={CARD_WIDTH} />
            </FocusableCard>
          ))}
        </div>
      )}
    </div>
  );
});
