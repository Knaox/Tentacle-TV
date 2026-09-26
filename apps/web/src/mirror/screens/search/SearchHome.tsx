import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpLeft, Clock, X } from "lucide-react";
import { useResumeItems, useSearchDiscover } from "@tentacle-tv/api-client";
import { MediaCard } from "../../cards/MediaCard";
import { Rail, useRailCardWidth } from "./SearchSection";

interface Props {
  recent: string[];
  onPick: (query: string) => void;
  onRemove: (query: string) => void;
  onClear: () => void;
  onGenre: (name: string) => void;
  onOpen: (id: string) => void;
}

/** Une section de l'accueil : 20 au-dessus, titre 17 gras, action à droite. */
function HomeSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between px-4">
        <h2 className="text-[17px] font-bold tracking-[-0.2px] text-content-primary">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * `SearchHome` de l'app — la recherche avant la première lettre : titre 24
 * extra-gras et son indice 14 ; les recherches récentes (lignes de 46, horloge
 * 16, flèche de reprise, croix de 44 qui en retire une) ; « Reprendre » en rail
 * d'affiches 112 / 140 ; les genres en pastilles de 40.
 */
export const SearchHome = memo(function SearchHome({ recent, onPick, onRemove, onClear, onGenre, onOpen }: Props) {
  const { t } = useTranslation("search");
  const width = useRailCardWidth();
  const { data: discover } = useSearchDiscover();
  const { data: resume } = useResumeItems();
  const genres = discover?.genres ?? [];

  return (
    <div>
      <div className="flex flex-col gap-1.5 px-4 pt-4">
        <h1 className="text-2xl font-extrabold leading-[29px] tracking-[-0.5px] text-content-primary">{t("emptyTitle")}</h1>
        <p className="text-sm leading-5 text-content-tertiary">{t("emptyHint")}</p>
      </div>

      {recent.length > 0 && (
        <HomeSection
          title={t("recent")}
          action={(
            <button type="button" onClick={onClear} className="-my-2.5 py-2.5 text-[13px] font-semibold text-brand-light">
              {t("clearRecent")}
            </button>
          )}
        >
          {recent.map((query) => (
            <div key={query} className="flex items-center pl-4 pr-1.5">
              <button
                type="button"
                onClick={() => onPick(query)}
                className="flex min-h-[46px] min-w-0 flex-1 items-center gap-3 text-left active:opacity-65"
              >
                <Clock size={16} className="shrink-0 text-content-tertiary" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-content-primary">{query}</span>
                <ArrowUpLeft size={16} className="shrink-0 text-content-quaternary" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onRemove(query)}
                aria-label={`${t("removeRecent")} : ${query}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center text-content-tertiary active:opacity-65"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          ))}
        </HomeSection>
      )}

      {resume && resume.length > 0 && (
        <HomeSection title={t("continueWatching")}>
          <Rail>
            {resume.slice(0, 10).map((item) => (
              <div key={item.Id} className="shrink-0">
                <MediaCard item={item} width={width} onPress={() => onOpen(item.Id)} />
              </div>
            ))}
          </Rail>
        </HomeSection>
      )}

      {genres.length > 0 && (
        <HomeSection title={t("browseGenres")}>
          <div className="flex flex-wrap gap-2 px-4">
            {genres.map((genre) => (
              <button
                key={genre.name}
                type="button"
                onClick={() => onGenre(genre.name)}
                aria-label={`${genre.name}, ${t("titles", { count: genre.count })}`}
                className="flex h-10 items-center gap-[7px] rounded-full border border-line-subtle bg-fill-subtle px-3.5 active:opacity-65"
              >
                <span className="text-sm font-semibold text-content-primary">{genre.name}</span>
                <span className="text-xs font-medium text-content-tertiary">{genre.count}</span>
              </button>
            ))}
          </div>
        </HomeSection>
      )}
    </div>
  );
});
