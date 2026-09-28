import { useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";
import type { SearchMediaItem } from "@tentacle-tv/shared";
import { ContentErrorState } from "../components/ContentErrorState";
import { RowHeader } from "../components/rows/RowHeader";
import { ArrowLeftIcon } from "../components/media/MediaDetailIcons";
import { PosterGrid } from "../components/search/page/SearchSections";
import { ExternalSections } from "../components/search/external/ExternalSections";
import { PersonHero } from "../components/person/PersonHero";
import { PersonBiography } from "../components/person/PersonBiography";
import { FilmographyFilters } from "../components/person/FilmographyFilters";
import { usePersonPage } from "../components/person/usePersonPage";

/**
 * La page d'une personne (`/person/:personId`) — ouverte d'un clic sur un
 * membre du casting ou de l'équipe d'une fiche.
 *
 * Portrait, métiers, vie et biographie tels que Jellyfin les connaît ; puis ses
 * titres DANS la bibliothèque, filtrables ; puis, s'il en existe, les sections
 * des plugins qui savent ce qu'elle a fait d'autre (« Pas encore sur le
 * serveur »). Sans plugin, la page s'arrête à la bibliothèque — le core ne sait
 * rien de ce qui n'y est pas.
 */
export function Person() {
  const { personId } = useParams<{ personId: string }>();
  if (!personId) return null;
  // Une clé par personne : passer de l'une à l'autre remet filtres et repli à zéro.
  return <PersonView key={personId} personId={personId} />;
}

function PersonView({ personId }: { personId: string }) {
  const { t } = useTranslation(["media", "common"]);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const page = usePersonPage(personId, params.get("role"));
  const openItem = useCallback((item: SearchMediaItem) => navigate(`/media/${item.Id}`), [navigate]);
  const name = page.details.data?.Name ?? "";

  if (page.details.isError && !page.details.data) {
    return (
      <div className="px-4 pt-24 md:px-12">
        <p className="mb-4 text-content-secondary">{t("media:personLoadError")}</p>
        <ContentErrorState onRetry={() => void page.details.refetch()} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-surface-0 pb-20">
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label={t("common:back")}
        className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-line-subtle bg-[var(--glass-tint)] px-4 py-2 text-sm text-content-secondary backdrop-blur-md transition-colors hover:text-content-primary md:left-12 md:top-6"
      >
        <ArrowLeftIcon />
        {t("common:back")}
      </button>

      {page.details.data ? (
        <PersonHero
          id={personId}
          name={name}
          imageTag={page.details.data.ImageTags?.Primary ?? null}
          life={page.life}
          roles={page.facets.roles.map((r) => r.role).filter((r) => r !== "Other")}
          backdrop={page.backdrop}
          countLabel={page.countLabel}
          trailing={name !== "" ? <LikeButton name={name} {...page.like} /> : null}
        />
      ) : (
        <HeroSkeleton />
      )}

      <div className="mt-12 space-y-12">
        <div className="px-4 md:px-12">
          <PersonBiography overview={page.details.data?.Overview} />
        </div>

        <section aria-label={t("media:personInLibraryTitle")}>
          <RowHeader title={t("media:personInLibraryTitle")} />
          <div className="row-gutter mt-4">
            {page.filmography.data && (
              <div className="mb-6">
                <FilmographyFilters
                  facets={page.facets}
                  kind={page.kind}
                  role={page.role}
                  onKind={page.setKind}
                  onRole={page.setRole}
                />
              </div>
            )}
            {page.filmography.isPending && <GridSkeleton />}
            {page.filmography.data && page.entries.length === 0 && (
              <p className="py-8 text-content-tertiary">{t("media:personLibraryEmpty")}</p>
            )}
            {page.filmography.data && page.entries.length > 0 && page.shown.length === 0 && (
              <p className="py-8 text-content-tertiary">{t("media:personFilterEmpty")}</p>
            )}
            {page.shown.length > 0 && <PosterGrid items={page.shown.map((e) => e.item)} onOpen={openItem} />}
          </div>
        </section>

        <div className="row-gutter">
          <ExternalSections
            external={page.external}
            library={page.owned}
            kind={page.kind === "all" ? null : page.kind}
            className="mt-0"
          />
        </div>
      </div>
    </div>
  );
}

function LikeButton({ name, liked, pending, toggle }: { name: string; liked: boolean; pending: boolean; toggle: () => void }) {
  const { t } = useTranslation("media");
  const label = liked ? t("unlikeActor", { name }) : t("likeActor", { name });
  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={toggle}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${
        liked
          ? "border-transparent bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] text-cta-brand-fg"
          : "border-line-strong bg-fill-subtle text-content-secondary hover:bg-fill-soft hover:text-content-primary"
      }`}
    >
      <Heart size={18} fill={liked ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}

function HeroSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6 px-4 pt-24 sm:flex-row sm:items-end md:px-12 md:pt-[22vh]">
      <div className="aspect-[2/3] w-36 rounded-[var(--radius-lg)] bg-fill-subtle sm:w-44 md:w-56" />
      <div className="flex-1 space-y-3 pb-1">
        <div className="h-3 w-40 rounded bg-fill-subtle" />
        <div className="h-10 w-2/3 max-w-md rounded bg-fill-subtle" />
        <div className="h-3 w-56 rounded bg-fill-subtle" />
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div aria-hidden className="grid gap-x-4 gap-y-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
      {Array.from({ length: 12 }, (_, i) => <div key={i} className="aspect-[2/3] rounded-md bg-fill-subtle" />)}
    </div>
  );
}
