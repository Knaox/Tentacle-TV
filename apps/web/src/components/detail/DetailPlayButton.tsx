import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSeriesWatchState } from "@tentacle-tv/api-client";
import { useMediaWarmup } from "../../hooks/useMediaWarmup";
import { formatEpisodeCode, resumeState, splitMinutes, VERSION_QUERY_PARAM, type MediaItem } from "@tentacle-tv/shared";
import { RowsIcon } from "@phosphor-icons/react/dist/csr/Rows";
import { PlayIcon } from "../icons/transport";
import { PressableGlass } from "../ui/glass/PressableGlass";
import { DETAIL_COLLECTION_ANCHOR } from "./detailStageGeometry";

// L'action de LECTURE de la fiche, la seule de l'écran au dégradé du logo : `.btn-play`, en
// grande pilule (52 px). Plus de lueur portée ni de grossissement au survol — la pression
// (97 %) répond seule. Sous le verre natif, la marque passe DANS le verre (`tint: "brand"`) et
// la primitive retire `fallbackClassName`.
// `cta-primary` : marqueur sans style — le moteur de focus du client LG y reconnaît l'action
// principale de l'écran.
const PRIMARY_LAYOUT = "flex h-[52px] items-center gap-2.5 overflow-hidden text-left";
const PRIMARY_GLASS = {
  appearance: { material: "pane", level: "prominent", tint: "brand", shape: "capsule" },
  fallbackClassName: "btn btn-play btn-lg cta-primary",
} as const;

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
      <PressableGlass
        {...PRIMARY_GLASS}
        onClick={() => document.getElementById(DETAIL_COLLECTION_ANCHOR)?.scrollIntoView({ behavior: "smooth", block: "start" })}
        className={`${PRIMARY_LAYOUT} px-6`}
      >
        <RowsIcon size={20} weight="fill" aria-hidden className="relative" />
        <span className="relative whitespace-nowrap text-base font-semibold">{t("media:detailBrowseCollection", { count: collectionCount })}</span>
      </PressableGlass>
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
    <PressableGlass
      {...PRIMARY_GLASS}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`${PRIMARY_LAYOUT} pl-4 pr-6`}
    >
      <ProgressRing progress={progress} />
      <span className="relative flex flex-col leading-tight">
        <span className="whitespace-nowrap text-base font-semibold">{label}</span>
        {remaining && <span className="mt-0.5 whitespace-nowrap text-xs font-medium tabular-nums opacity-80">{remaining}</span>}
      </span>
    </PressableGlass>
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
      <PlayIcon size={progress !== null ? 14 : 20} aria-hidden className="relative" />
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
