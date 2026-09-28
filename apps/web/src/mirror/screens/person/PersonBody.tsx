import { memo, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  biographyParagraphs, creditRoleKey, type CreditRole, type FilmographyEntry, type FilmographyFacets,
  type FilmographyKind, type MediaItem, type SearchMediaItem,
} from "@tentacle-tv/shared";
import { Spinner } from "../../../components/ui/Spinner";
import { MediaCard } from "../../cards/MediaCard";
import { useGrid } from "../../useMirrorLayout";
import { gridCell } from "../search/SearchSection";

/** `PersonBio` de l'app : titre 18 gras, texte 15/22 sur six lignes, « Voir plus » s'il a été coupé. */
export const PersonBio = memo(function PersonBio({ overview }: { overview: string | undefined }) {
  const { t } = useTranslation(["media", "common"]);
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const text = biographyParagraphs(overview).join("\n\n");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    setTruncated(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);

  if (text === "") return null;
  return (
    <section className="mt-6 px-4">
      <h2 className="mb-2 text-[18px] font-bold leading-[23px] tracking-[-0.4px] text-content-primary">{t("media:personBiography")}</h2>
      <p ref={ref} className={`whitespace-pre-line text-[15px] leading-[22px] text-content-secondary ${expanded ? "" : "line-clamp-6"}`}>
        {text}
      </p>
      {(truncated || expanded) && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-[13px] font-semibold text-brand-light">
          {expanded ? t("common:showLess") : t("common:showMore")}
        </button>
      )}
    </section>
  );
});

interface FilmographyProps {
  pending: boolean;
  entries: FilmographyEntry<SearchMediaItem>[];
  shown: FilmographyEntry<SearchMediaItem>[];
  facets: FilmographyFacets;
  kind: FilmographyKind;
  role: CreditRole | null;
  onKind: (kind: FilmographyKind) => void;
  onRole: (role: CreditRole | null) => void;
  onOpen: (id: string) => void;
}

/** `PersonFilmography` de l'app : pastilles de 36 qui défilent, puis la grille trois colonnes (gouttière 12). */
export const PersonFilmography = memo(function PersonFilmography(props: FilmographyProps) {
  const { pending, entries, shown, facets, kind, role, onKind, onRole, onOpen } = props;
  const { t } = useTranslation("media");
  const { itemWidth, gutter, padding } = useGrid({ phoneColumns: 3, gutter: 12 });
  const cell = gridCell(itemWidth);
  const showKinds = facets.movies > 0 && facets.series > 0;
  const showRoles = facets.roles.length > 1;

  return (
    <section className="mt-6">
      <h2 className="mb-2 px-4 text-[18px] font-bold leading-[23px] tracking-[-0.4px] text-content-primary">{t("personInLibraryTitle")}</h2>
      {(showKinds || showRoles) && (
        <div className="mirror-no-scrollbar mb-3 flex items-center gap-2 overflow-x-auto overscroll-x-contain px-4">
          {showKinds && (
            <>
              <Chip label={t("personFilterAll")} count={facets.total} active={kind === "all"} onClick={() => onKind("all")} />
              <Chip label={t("personFilterMovies")} count={facets.movies} active={kind === "movie"} onClick={() => onKind("movie")} />
              <Chip label={t("personFilterSeries")} count={facets.series} active={kind === "series"} onClick={() => onKind("series")} />
            </>
          )}
          {showKinds && showRoles && <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-line-strong" />}
          {showRoles && facets.roles.map((r) => (
            <Chip
              key={r.role}
              label={t(creditRoleKey(r.role))}
              count={r.count}
              active={role === r.role}
              onClick={() => onRole(role === r.role ? null : r.role)}
            />
          ))}
        </div>
      )}
      {pending && <div className="flex justify-center py-8"><Spinner /></div>}
      {!pending && entries.length === 0 && <p className="px-4 py-4 text-[14px] font-medium text-content-tertiary">{t("personLibraryEmpty")}</p>}
      {!pending && entries.length > 0 && shown.length === 0 && (
        <p className="px-4 py-4 text-[14px] font-medium text-content-tertiary">{t("personFilterEmpty")}</p>
      )}
      {shown.length > 0 && (
        <div className="flex flex-wrap" style={{ paddingInline: padding, gap: gutter }}>
          {shown.map(({ item }) => (
            <div key={item.Id} style={{ width: cell }}>
              <MediaCard item={item as unknown as MediaItem} width={cell} onPress={() => onOpen(item.Id)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
});

function Chip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`mirror-press flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 ${
        active ? "border-brand bg-[var(--brand-soft)] text-content-primary" : "border-line-subtle bg-fill-subtle text-content-secondary"
      }`}
    >
      <span className="text-[13px] font-semibold">{label}</span>
      <span className="text-[12px] font-medium text-content-quaternary">{count}</span>
    </button>
  );
}
