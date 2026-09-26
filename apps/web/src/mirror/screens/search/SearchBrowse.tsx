import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { useMediaItem, useSearchBrowse, type SearchBrowseTarget } from "@tentacle-tv/api-client";
import { withoutLibraryTwins, type ExternalSearchItem, type SearchProvider } from "@tentacle-tv/shared";
import { Spinner } from "../../../components/ui/Spinner";
import { useExternalFilmography } from "../../../components/search/external/useExternalFilmography";
import { useGrid } from "../../useMirrorLayout";
import { ExternalSections } from "./SearchExternal";
import { PersonAvatar } from "./SearchPeople";
import { PosterGrid } from "./SearchSection";
import type { BrowseTarget } from "./searchRoute";

function query(target: BrowseTarget): SearchBrowseTarget {
  return target.kind === "person" ? { kind: "person", id: target.id } : target;
}

/**
 * `SearchBrowse` de l'app — parcourir une personne, un genre, un studio sans
 * quitter la recherche. En-tête : retour rond de 44 (`fill.soft` bordé),
 * portrait 56 pour une personne, type 11 en capitales, titre 22 extra-gras,
 * « N dans la bibliothèque » 13. Puis « Par année » 12 et la grille 3 colonnes
 * (gouttière 12). La filmographie continue par ce que les extensions
 * connaissent et que le serveur n'a pas, sans rien répéter.
 */
export const SearchBrowse = memo(function SearchBrowse({ target, onBack, onOpen, onOpenExternal, onSeeAllExternal }: {
  target: BrowseTarget;
  onBack: () => void;
  onOpen: (id: string) => void;
  onOpenExternal: (provider: SearchProvider, item: ExternalSearchItem) => void;
  onSeeAllExternal: (provider: SearchProvider, href: string) => void;
}) {
  const { t } = useTranslation("search");
  const { t: tc } = useTranslation("common");
  const { padding } = useGrid({ phoneColumns: 3, gutter: 12 });
  const { data, isPending } = useSearchBrowse(query(target));
  // Arrivée par une adresse sans `name` : le nom vient de la fiche de la personne.
  const personItem = useMediaItem(target.kind === "person" ? target.id : undefined);
  const title = target.kind === "person" ? target.person.name || (personItem.data?.Name ?? "") : target.name;
  const kicker = target.kind === "person" ? t("filmographyTitle") : t(target.kind);

  // L'identifiant TMDB, quand Jellyfin le connaît : il vaut mieux qu'un nom,
  // que deux acteurs peuvent porter.
  const tmdbId = personItem.data?.ProviderIds?.Tmdb ?? null;
  const external = useExternalFilmography(
    target.kind === "person" && !personItem.isPending && title !== "" ? { name: title, tmdbId } : null,
  );
  const outside = useMemo(() => {
    const owned = (data?.items ?? []).map((hit) => ({ name: hit.item.Name, year: hit.item.ProductionYear ?? null }));
    return external.results
      .map((result) => ({ ...result, items: withoutLibraryTwins(result.items, owned) }))
      .filter((result) => result.items.length > 0);
  }, [external.results, data]);

  return (
    <div>
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <button
          type="button"
          onClick={onBack}
          aria-label={tc("back")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-subtle bg-fill-soft text-content-primary active:opacity-70"
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
        {target.kind === "person" && <PersonAvatar person={{ ...target.person, name: title }} size={56} />}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.8px] text-content-tertiary">{kicker}</p>
          <h1 className="line-clamp-2 text-[22px] font-extrabold leading-[27px] tracking-[-0.4px] text-content-primary">{title}</h1>
          {data && <p className="text-[13px] font-medium text-content-tertiary">{t("inLibrary", { count: data.total })}</p>}
        </div>
      </div>

      {isPending && <div className="flex items-center justify-center py-6"><Spinner size="md" /></div>}
      {data && (
        <>
          <p className="mb-2 text-xs font-medium text-content-quaternary" style={{ paddingInline: padding }}>{t("sortedByYear")}</p>
          <PosterGrid hits={data.items} onOpen={onOpen} className="pb-5" />
        </>
      )}

      {target.kind === "person" && outside.length > 0 && (
        <ExternalSections results={outside} onOpen={onOpenExternal} onSeeAll={onSeeAllExternal} layout="grid" />
      )}
      {target.kind === "person" && outside.length === 0 && external.pending && (
        <div className="flex items-center gap-2 px-4 pb-5">
          <Spinner size="sm" tone="neutral" />
          <span className="text-[13px] font-medium text-content-tertiary">{t("externalSearching")}</span>
        </div>
      )}
    </div>
  );
});
