import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSeriesWatchState } from "@tentacle-tv/api-client";
import { useMediaWarmup } from "../../hooks/useMediaWarmup";
import { formatEpisodeCode, resumeState, splitMinutes, VERSION_QUERY_PARAM, type MediaItem } from "@tentacle-tv/shared";
import { PlayIcon } from "../media/MediaDetailIcons";
import { PressableScale } from "../ui/PressableScale";
import { DETAIL_COLLECTION_ANCHOR } from "./detailStageGeometry";

const PRIMARY_CLASS = "group/play relative flex h-14 items-center gap-3 overflow-hidden rounded-full pr-7 text-left text-cta-brand-fg ring-1 ring-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]";
const PRIMARY_STYLE = {
  background: "linear-gradient(120deg, var(--brand) 0%, var(--brand-accent) 100%)",
  boxShadow: "0 12px 34px rgba(var(--brand-rgb), 0.42)",
};

/**
 * L'action principale de la fiche — la seule en couleur, au dégradé de marque
 * comme le bouton de lecture des cartes.
 *
 * Entamé : « Reprendre », ce qu'il reste en clair (« Reste 1 h 48 min ») et la
 * progression en filet dans le bouton même — un chiffre isolé à côté des
 * pastilles se lisait comme une étiquette orpheline. Série : l'épisode visé
 * (« Reprendre S1 E3 »), avec SA reprise. Collection, série terminée : aucun
 * bouton, il n'y a rien à lancer.
 */
export function DetailPlayButton({ item, collectionCount = 0, version = null }: {
  item: MediaItem;
  collectionCount?: number;
  /** Version choisie sous la rangée (`DetailVersionPicker`) ; la fiche d'une série n'en a pas. */
  version?: string | null;
}) {
  const { t } = useTranslation(["common", "media"]);
  const navigate = useNavigate();
  const isSeries = item.Type === "Series";
  const { data: watchState } = useSeriesWatchState(isSeries ? item.Id : undefined);
  const episode = isSeries && watchState && watchState.type !== "completed" ? watchState.episode : undefined;
  const target = episode ?? item;
  // La fiche est la plus sûre des intentions : le serveur lit d'avance la tête
  // et la fin du fichier que ce bouton jouerait (`lib/mediaWarmup.ts`). Une
  // demi-seconde d'abord, pour laisser passer ce que la fiche charge elle-même.
  useMediaWarmup(item.Type === "BoxSet" ? null : target, 600, target === item ? version : null);

  // Une collection n'a rien à lire : son action principale est d'en parcourir
  // le contenu, juste sous la scène.
  if (item.Type === "BoxSet") {
    if (collectionCount === 0) return null;
    return (
      <PressableScale
        hoverScale={1.03}
        tapScale={0.97}
        onClick={() => document.getElementById(DETAIL_COLLECTION_ANCHOR)?.scrollIntoView({ behavior: "smooth", block: "start" })}
        className={`${PRIMARY_CLASS} pl-6`}
        style={PRIMARY_STYLE}
      >
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-white/15 opacity-0 transition-opacity duration-200 group-hover/play:opacity-100" />
        <svg className="relative h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 6h16M4 12h16M4 18h10" /></svg>
        <span className="relative whitespace-nowrap text-base font-bold">{t("media:detailBrowseCollection", { count: collectionCount })}</span>
      </PressableScale>
    );
  }
  if (isSeries && !episode) return null;

  const resume = resumeState(target);
  // « Lecture » tout court pour une série jamais commencée : le code du premier
  // épisode n'apprendrait rien.
  const code = episode && watchState?.type !== "start" ? formatEpisodeCode(episode.ParentIndexNumber, episode.IndexNumber) : "";
  const verb = resume || watchState?.type === "continue" ? t("common:resume") : t("common:play");
  const label = code ? `${verb} ${code}` : verb;
  const remaining = resume?.remainingMinutes != null ? remainingLabel(resume.remainingMinutes, t) : null;

  return (
    <DetailPlayPill
      label={label}
      remaining={remaining}
      progress={resume?.progress ?? null}
      ariaLabel={`${label} — ${target.Name}`}
      onClick={() => navigate(`/watch/${target.Id}${version && target === item ? `?${VERSION_QUERY_PARAM}=${encodeURIComponent(version)}` : ""}`)}
    />
  );
}

/**
 * Le bouton lui-même, sans ce qui le décide : la fiche d'un titre gardé le
 * nourrit de sa progression LOCALE, la fiche en ligne de celle de Jellyfin —
 * un seul dessin pour les deux.
 */
export function DetailPlayPill({ label, remaining, progress, ariaLabel, onClick }: {
  label: string;
  /** « Reste 1 h 48 min », ou rien. */
  remaining: string | null;
  /** Avancement 0..1 dans l'anneau de l'icône, `null` sans reprise. */
  progress: number | null;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <PressableScale
      hoverScale={1.03}
      tapScale={0.97}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`${PRIMARY_CLASS} pl-4`}
      style={PRIMARY_STYLE}
    >
      {/* Éclat au survol : un calque en fondu d'OPACITÉ, jamais un fond animé. */}
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-white/15 opacity-0 transition-opacity duration-200 group-hover/play:opacity-100" />
      <ProgressRing progress={progress} />
      <span className="relative flex flex-col leading-tight">
        <span className="whitespace-nowrap text-base font-bold">{label}</span>
        {remaining && <span className="whitespace-nowrap text-xs font-medium opacity-85">{remaining}</span>}
      </span>
    </PressableScale>
  );
}

/**
 * L'icône Lecture, cerclée de l'avancement quand il y en a un : la progression
 * se lit dans le bouton même, sans barre qui passerait sous le texte.
 */
function ProgressRing({ progress }: { progress: number | null }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center">
      {progress !== null && (
        <svg className="absolute inset-0 h-8 w-8 -rotate-90" viewBox="0 0 32 32" aria-hidden>
          <circle cx="16" cy="16" r={r} fill="none" stroke="currentColor" strokeOpacity={0.3} strokeWidth={2.5} />
          <circle cx="16" cy="16" r={r} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - progress)} />
        </svg>
      )}
      <span className="relative ml-0.5 flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4"><PlayIcon /></span>
    </span>
  );
}

/** « Reste 1 h 48 min » / « Reste 42 min » — partagé avec la fiche d'un titre gardé. */
export function remainingLabel(total: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const { hours, minutes } = splitMinutes(total);
  return hours > 0
    ? t("media:detailRemainingHours", { hours, minutes: String(minutes).padStart(2, "0") })
    : t("media:detailRemainingMinutes", { count: minutes });
}
