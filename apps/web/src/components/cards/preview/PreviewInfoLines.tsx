import { Fragment, memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatDuration, TICKS_PER_MINUTE } from "@tentacle-tv/shared";
import { previewFactsEmpty, type PreviewFacts, type PreviewInfo, type PreviewProgress } from "./previewInfo";

/**
 * Les deux lignes d'infos du bandeau, sous le titre (`previewInfo.ts` décide
 * de ce qu'elles disent) :
 *
 *   • la PREMIÈRE : l'épisode d'une vignette (« S01E05 · Chute libre »), sinon
 *     les faits — année, classification, durée ou saisons, qualité ;
 *   • la DERNIÈRE : la progression d'un titre commencé (« 54 sur 58 min »),
 *     sinon les faits d'un épisode, sinon les genres.
 *
 * Une ligne vide n'est pas rendue ; la dernière cède la première quand le
 * bandeau est trop bas (`previewPanel.css`). Le texte est posé sur média :
 * blanc dans les deux schémas.
 */
export const PreviewInfoLines = memo(function PreviewInfoLines({ info }: { info: PreviewInfo }) {
  // Un épisode a déjà son année dans sa série : ses faits commencent à la classification.
  const episodeFacts = info.episode ? { ...info.facts, year: null } : null;
  const first = info.episode
    ? <EpisodeLine episode={info.episode} />
    : previewFactsEmpty(info.facts) ? null : <FactsLine facts={info.facts} />;
  const last = info.progress
    ? <ProgressLine progress={info.progress} />
    : episodeFacts
      ? previewFactsEmpty(episodeFacts) ? null : <FactsLine facts={episodeFacts} />
      : info.genres.length > 0
        ? <GenresLine genres={info.genres} />
        : null;
  return (
    <>
      {first && <Line slot="first">{first}</Line>}
      {last && <Line slot="last">{last}</Line>}
    </>
  );
});

function Line({ slot, children }: { slot: "first" | "last"; children: ReactNode }) {
  return (
    <div className="card-preview-line" data-line={slot}>
      {children}
    </div>
  );
}

/** Le point de marque qui sépare les faits (celui de la bannière d'accueil). */
const Dot = () => <span aria-hidden className="card-preview-dot" />;

function FactsLine({ facts }: { facts: PreviewFacts }) {
  const { t } = useTranslation(["trailerPreview", "common"]);
  const parts: ReactNode[] = [];
  if (facts.year !== null) parts.push(<span key="year" className="card-preview-year">{facts.year}</span>);
  if (facts.rating) {
    parts.push(
      <span key="rating" className="card-preview-rating" aria-label={t("trailerPreview:ratingLabel", { rating: facts.rating })}>
        {facts.rating}
      </span>,
    );
  }
  if (facts.runtime) parts.push(<span key="runtime">{facts.runtime}</span>);
  if (facts.seasons !== null) parts.push(<span key="seasons">{t("common:seasonsCount", { count: facts.seasons })}</span>);
  if (facts.quality.length > 0) {
    parts.push(
      <span key="quality">
        {facts.quality.map((badge) => (
          <span key={badge.kind} className="card-preview-quality" data-accent={badge.accent} aria-label={badge.label} title={badge.label}>
            {badge.short}
          </span>
        ))}
      </span>,
    );
  }
  return (
    <p className="card-preview-facts">
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <Dot />}
          {part}
        </Fragment>
      ))}
    </p>
  );
}

function EpisodeLine({ episode }: { episode: NonNullable<PreviewInfo["episode"]> }) {
  return (
    <p className="card-preview-episode">
      <b>{episode.code}</b>
      {episode.title && (
        <>
          <Dot />
          {episode.title}
        </>
      )}
    </p>
  );
}

function GenresLine({ genres }: { genres: readonly string[] }) {
  return (
    <p className="card-preview-genres">
      {genres.map((genre, index) => (
        <Fragment key={genre}>
          {index > 0 && <Dot />}
          <span>{genre}</span>
        </Fragment>
      ))}
    </p>
  );
}

/** « 54 sur 58 min » sous l'heure, « 1h 12min sur 2h 33min » au-delà. */
function ProgressLine({ progress }: { progress: PreviewProgress }) {
  const { t } = useTranslation("trailerPreview");
  const totalMinutes = Math.round(progress.totalTicks / TICKS_PER_MINUTE);
  const watchedMinutes = Math.min(totalMinutes, Math.max(1, Math.floor(progress.watchedTicks / TICKS_PER_MINUTE)));
  const time = totalMinutes < 60
    ? t("progressMinutes", { watched: watchedMinutes, total: totalMinutes })
    : t("progressTime", {
        watched: formatDuration(Math.max(progress.watchedTicks, TICKS_PER_MINUTE)) ?? "",
        total: formatDuration(progress.totalTicks) ?? "",
      });
  return (
    <div className="card-preview-progress">
      <span aria-hidden className="card-preview-progress-track">
        <span className="card-preview-progress-fill" style={{ width: `${Math.max(2, Math.min(100, progress.percent))}%` }} />
      </span>
      <span className="card-preview-progress-time">{time}</span>
    </div>
  );
}
