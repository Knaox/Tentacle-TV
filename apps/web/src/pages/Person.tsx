import { useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HeartIcon as Heart } from "@phosphor-icons/react/dist/csr/Heart";
import type { SearchMediaItem } from "@tentacle-tv/shared";
import { ContentErrorState } from "../components/ContentErrorState";
import { RowHeader } from "../components/rows/RowHeader";
import { PosterGrid } from "../components/search/page/SearchSections";
import { ExternalSections } from "../components/search/external/ExternalSections";
import { PersonHero } from "../components/person/PersonHero";
import { PersonBiography } from "../components/person/PersonBiography";
import { FilmographyFilters } from "../components/person/FilmographyFilters";
import { usePersonPage } from "../components/person/usePersonPage";
import { BackButton } from "../components/ui/BackButton";
import { imageColorOf, type ImageBlurHashes } from "../lib/blurhashColor";

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
      <div className="relative px-4 pt-24 md:px-12">
        {/* Même en échec, on sort de la page par où l'on est venu. */}
        <BackButton label={t("common:back")} className="absolute left-4 top-4 md:left-12 md:top-6" />
        <p className="mb-4 text-content-secondary">{t("media:personLoadError")}</p>
        <ContentErrorState onRetry={() => void page.details.refetch()} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-surface-0 pb-20">
      {/* Le Retour du socle, à la même place qu'avant : une pilule d'encre thémée —
          le voile du décor rend le coin haut gauche au fond de page, dans les deux thèmes. */}
      <BackButton label={t("common:back")} className="absolute left-4 top-4 z-20 md:left-12 md:top-6" />

      {page.details.data ? (
        <PersonHero
          id={personId}
          name={name}
          imageTag={page.details.data.ImageTags?.Primary ?? null}
          portraitColor={portraitColorOf(page.details.data)}
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
              <p className="ui-panel max-w-[65ch] px-5 py-4 text-sm text-content-secondary">{t("media:personLibraryEmpty")}</p>
            )}
            {page.filmography.data && page.entries.length > 0 && page.shown.length === 0 && (
              <p className="ui-panel max-w-[65ch] px-5 py-4 text-sm text-content-secondary">{t("media:personFilterEmpty")}</p>
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

/**
 * La couleur d'attente du portrait : Jellyfin joint `ImageBlurHashes` à la fiche d'une
 * personne, que le type partagé `PersonDetails` ne déclare pas.
 */
function portraitColorOf(details: { ImageTags?: Record<string, string> }): string | null {
  const hashes = (details as { ImageBlurHashes?: ImageBlurHashes }).ImageBlurHashes;
  return imageColorOf(hashes, "Primary", details.ImageTags?.Primary);
}

function LikeButton({ name, liked, pending, toggle }: { name: string; liked: boolean; pending: boolean; toggle: () => void }) {
  const { t } = useTranslation("media");
  const label = liked ? t("unlikeActor", { name }) : t("likeActor", { name });
  return (
    // `aria-pressed` allume le rond à la teinte franche (`.icon-btn`) ; le cœur passe en plein.
    <button type="button" aria-pressed={liked} aria-label={label} title={label} disabled={pending} onClick={toggle} className="icon-btn btn-soft">
      <Heart weight={liked ? "fill" : "regular"} size={20} aria-hidden />
    </button>
  );
}

function HeroSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6 px-4 pt-24 sm:flex-row sm:items-end md:px-12 md:pt-[22vh]">
      <div className="aspect-[2/3] w-36 rounded-tile bg-surface-2 sm:w-44 md:w-56" />
      <div className="flex-1 space-y-3 pb-1">
        <div className="h-3 w-40 rounded-chip bg-surface-2" />
        <div className="h-10 w-2/3 max-w-md rounded-field bg-surface-2" />
        <div className="h-3 w-56 rounded-chip bg-surface-2" />
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div aria-hidden className="grid gap-x-4 gap-y-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
      {Array.from({ length: 12 }, (_, i) => <div key={i} className="aspect-[2/3] rounded-card bg-surface-2" />)}
    </div>
  );
}
