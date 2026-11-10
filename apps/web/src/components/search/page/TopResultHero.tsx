/**
 * Le meilleur résultat, en tête de page : la bannière du titre (son fond, son
 * affiche, son identité, pourquoi il répond) avec « Lire » pour un film et
 * « Détails » — ou le portrait d'une personne et l'accès à sa filmographie.
 *
 * Posé sur une image : couleurs de texte « sur média », constantes entre les
 * thèmes (le voile sombre fait la lisibilité, pas le thème choisi). Une seule
 * action au dégradé du logo — la lecture ; les autres sont des pilules sur média.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { InfoIcon } from "@phosphor-icons/react/dist/csr/Info";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { useCardMarkers, useJellyfinClient } from "@tentacle-tv/api-client";
import {
  cardRatingFor, itemMeta, matchReason, personMeta, type SearchItemHit, type SearchPersonHit, type SearchTopHit,
} from "@tentacle-tv/shared";
import { CardMarkerLayer } from "../../cards/CardMarkerLayer";
import { PlayIcon } from "../../icons/transport";
import { FadeImage } from "../../ui/FadeImage";
import { HighlightedText } from "../HighlightedText";
import { PersonAvatar, PosterThumb } from "../SearchThumbs";
import { useSeriesGapOffer } from "../../seasons/SeriesGapsScope";

interface TopResultHeroProps {
  top: SearchTopHit;
  terms: readonly string[];
  onOpen: (path: string) => void;
}

export const TopResultHero = memo(function TopResultHero({ top, terms, onOpen }: TopResultHeroProps) {
  return top.kind === "person"
    ? <TopPerson person={top.hit} terms={terms} onOpen={onOpen} />
    : <TopItem hit={top.hit} terms={terms} onOpen={onOpen} />;
});

function TopPerson({ person, terms, onOpen }: { person: SearchPersonHit; terms: readonly string[]; onOpen: (path: string) => void }) {
  const { t } = useTranslation("search");
  const path = `/search?person=${encodeURIComponent(person.id)}&name=${encodeURIComponent(person.name)}`;
  return (
    <section aria-label={t("topResult")} className="ui-panel flex items-center gap-6 p-6">
      <PersonAvatar person={person} size={112} />
      <div className="min-w-0">
        <p className="ui-eyebrow">{t("topResult")}</p>
        <h2 className="mt-1.5 truncate text-display-3 text-content-primary">
          <HighlightedText text={person.name} terms={terms} plain />
        </h2>
        <p className="mt-1.5 text-sm text-content-tertiary">{personMeta(t, person)}</p>
        {/* `cta-primary` : marqueur sans style, lu par le moteur de focus du client LG. */}
        <button type="button" onClick={() => onOpen(path)} className="btn btn-solid cta-primary mt-4">
          {t("filmography")}
        </button>
      </div>
    </section>
  );
}

function TopItem({ hit, terms, onOpen }: { hit: SearchItemHit; terms: readonly string[]; onOpen: (path: string) => void }) {
  const { t, i18n } = useTranslation("search");
  const client = useJellyfinClient();
  const { item, match } = hit;
  // Une série incomplète : ses saisons à demander, à côté de « Détails ».
  const gap = useSeriesGapOffer(item.Id);
  // « Vu » par le modèle des cartes : le geste en cours s'y lit au clic.
  const watched = useCardMarkers(item, { communityRating: null, scope: "item" }).statuses.includes("watched");
  const backdropTag = item.BackdropImageTags?.[0];
  const backdrop = backdropTag ? client.getImageUrl(item.Id, "Backdrop", { width: 1280, quality: 80, tag: backdropTag }) : null;
  const reason = matchReason(t, match);
  const progress = item.UserData?.PlayedPercentage ?? 0;

  return (
    <section aria-label={t("topResult")} className="relative isolate overflow-hidden rounded-sheet bg-surface-1">
      {/* Le décor : sa place tenue par l'encre, puis UN fondu (déjà vu : là d'emblée). */}
      {backdrop !== null && <FadeImage src={backdrop} alt="" loading="eager" className="absolute inset-0 -z-10" />}
      {/* Le voile de lecture — une encre, plus épaisse à gauche où vit le texte. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(90deg, rgba(var(--scrim-media-rgb),0.92) 0%, rgba(var(--scrim-media-rgb),0.74) 38%, rgba(var(--scrim-media-rgb),0.5) 70%, rgba(var(--scrim-media-rgb),0.34) 100%)",
        }}
      />
      <div className="flex items-end gap-6 p-6 md:p-8">
        <PosterThumb item={item} height={360} className="hidden h-[180px] w-[120px] rounded-card shadow-[var(--elev-2)] sm:block">
          {/* L'affiche du meilleur résultat porte les marqueurs des cartes : le
              même titre dit la même chose dans la bannière et dans la grille. */}
          <CardMarkerLayer item={item} communityRating={cardRatingFor(item, "item").rating} scope="item" />
        </PosterThumb>
        <div className="min-w-0 flex-1">
          <p className="ui-eyebrow text-[var(--on-media-secondary)]">{t("topResult")}</p>
          <h2 className="mt-1.5 text-display-3 text-[var(--on-media-primary)] md:text-display-2">
            <HighlightedText text={item.Name} terms={terms} plain />
          </h2>
          <p className="mt-2 text-sm tabular-nums text-[var(--on-media-secondary)]">{itemMeta(t, item, i18n.language)}</p>
          {reason && <p className="mt-1 text-sm font-medium text-[var(--on-media-primary)]">{reason}</p>}
          <div className="mt-5 flex flex-wrap gap-2.5">
            {item.Type === "Movie" && (
              <button type="button" onClick={() => onOpen(`/watch/${item.Id}`)} className="btn btn-play cta-primary">
                <PlayIcon aria-hidden size={18} />
                {progress > 0 && !watched ? t("resume") : t("play")}
              </button>
            )}
            <button type="button" onClick={() => onOpen(`/media/${item.Id}`)} className="btn btn-on-media">
              <InfoIcon aria-hidden size={18} />
              {t("details")}
            </button>
            {gap && (
              <button type="button" onClick={gap.open} className="btn btn-on-media">
                <PlusIcon aria-hidden size={18} />
                {t("requests:missingSeasons", { count: gap.count })}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
