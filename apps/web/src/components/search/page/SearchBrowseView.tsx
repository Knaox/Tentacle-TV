/**
 * Parcourir plutôt que chercher : la FILMOGRAPHIE d'une personne dans la
 * bibliothèque (du plus récent au plus ancien), les titres d'un GENRE ou d'un
 * STUDIO (les mieux notés d'abord). L'app n'a pas de page dédiée à chacun :
 * c'est ici qu'ils vivent, à une adresse partageable.
 *
 * Sous une filmographie, les plugins qui savent le faire (`search.person`)
 * ajoutent ce que la personne a fait et que la bibliothèque n'a pas — rien
 * du tout sans plugin actif et configuré.
 */

import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMediaItem, useSearchBrowse, type SearchBrowseTarget } from "@tentacle-tv/api-client";
import type { SearchMediaItem } from "@tentacle-tv/shared";
import { PersonAvatar } from "../SearchThumbs";
import { personMeta } from "../searchLabels";
import { ExternalSections } from "../external/ExternalSections";
import { useExternalFilmography } from "../external/useExternalFilmography";
import { PosterGrid } from "./SearchSections";

export const SearchBrowseView = memo(function SearchBrowseView({ target, personName, onOpenItem }: {
  target: SearchBrowseTarget;
  personName: string | null;
  onOpenItem: (item: SearchMediaItem) => void;
}) {
  const { t } = useTranslation("search");
  const { data, isLoading, isError } = useSearchBrowse(target);
  const person = data?.person ?? null;
  const title = target.kind === "person"
    ? (person?.name ?? personName ?? "")
    : (data?.genre ?? data?.studio ?? target.name);
  const kicker = target.kind === "person" ? t("filmographyTitle") : t(target.kind);
  const sorted = target.kind === "person" ? t("sortedByYear") : t("sortedByRating");

  // L'identifiant TMDB de la personne, quand Jellyfin le connaît : il vaut
  // mieux qu'un nom, que deux acteurs peuvent porter.
  const personItem = useMediaItem(target.kind === "person" ? target.id : undefined);
  const tmdbId = personItem.data?.ProviderIds?.Tmdb ?? null;
  const external = useExternalFilmography(
    target.kind === "person" && title !== "" && !personItem.isPending ? { name: title, tmdbId } : null,
  );
  const owned = useMemo(
    () => (data?.items ?? []).map((hit) => ({ name: hit.item.Name, year: hit.item.ProductionYear ?? null })),
    [data],
  );

  return (
    <div className="px-4 pt-8 md:px-12">
      <header className="flex items-center gap-5">
        {target.kind === "person" && (
          <PersonAvatar person={{ id: target.id, name: title, imageTag: person?.imageTag ?? null }} size={88} />
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-content-quaternary">{kicker}</p>
          <h1 className="mt-1 truncate text-3xl font-bold tracking-tight text-content-primary md:text-4xl">{title}</h1>
          <p className="mt-1.5 text-sm text-content-tertiary">
            {person !== null ? personMeta(t, person) : data ? t("countTitles", { count: data.total }) : " "}
            {data && data.total > 1 && <span className="text-content-quaternary"> · {sorted}</span>}
          </p>
        </div>
      </header>
      <div className="mt-8">
        {isLoading && (
          <div aria-hidden className="grid gap-x-4 gap-y-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
            {Array.from({ length: 12 }, (_, i) => <div key={i} className="aspect-[2/3] rounded-md bg-fill-subtle" />)}
          </div>
        )}
        {isError && <p className="py-16 text-center text-content-tertiary">{t("noResults", { query: title })}</p>}
        {data && <PosterGrid items={data.items.map((hit) => hit.item)} onOpen={onOpenItem} />}
        {target.kind === "person" && <ExternalSections external={external} library={owned} className="mt-12" />}
      </div>
    </div>
  );
});
