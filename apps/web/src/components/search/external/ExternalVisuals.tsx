/**
 * Les briques visuelles d'un résultat hors bibliothèque : l'affiche (ou ses
 * initiales, jamais un carré vide) et la pastille que le plugin a choisie.
 * Partagées par l'omnibox, la page de résultats et les bibliothèques.
 */

import { memo } from "react";
import { useBrokenImage } from "../../../hooks/useBrokenImage";
import { initials, type ExternalSearchItem, type ExternalTone } from "@tentacle-tv/shared";

const FALLBACK = "linear-gradient(160deg, rgba(var(--brand-rgb), 0.45) 0%, var(--fill-strong) 100%)";

const TONE_CLASS: Record<ExternalTone, string> = {
  neutral: "bg-fill-medium text-content-secondary",
  info: "bg-status-info-bg text-status-info-fg",
  success: "bg-status-success-bg text-status-success-fg",
  warning: "bg-status-warning-bg text-status-warning-fg",
};

/* Posée sur une AFFICHE, la pastille suit ses propres jetons
 * (theme/surfaces.css) : les paires des surfaces sont illisibles sur une image
 * en thème clair. Classes écrites en toutes lettres : Tailwind les lit ici. */
const MEDIA_TONE_CLASS: Record<ExternalTone, string> = {
  neutral: "bg-[var(--media-badge-neutral-bg)] text-[var(--media-badge-neutral-fg)]",
  info: "bg-[var(--media-badge-info-bg)] text-[var(--media-badge-info-fg)]",
  success: "bg-[var(--media-badge-success-bg)] text-[var(--media-badge-success-fg)]",
  warning: "bg-[var(--media-badge-warning-bg)] text-[var(--media-badge-warning-fg)]",
};

export const ExternalPoster = memo(function ExternalPoster({ item, className }: {
  item: ExternalSearchItem;
  className: string;
}) {
  const { broken, reportFailure } = useBrokenImage(item.imageUrl);
  return (
    <div className={`relative shrink-0 overflow-hidden bg-surface-2 ${className}`}>
      {item.imageUrl !== null && !broken ? (
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={reportFailure}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-white/80" style={{ background: FALLBACK }}>
          {initials(item.title)}
        </div>
      )}
    </div>
  );
});

export function ExternalBadge({ badge, onMedia = false, className = "" }: {
  badge: ExternalSearchItem["badge"];
  /** Posée sur une image (l'affiche d'une carte), et non sur une surface de la page. */
  onMedia?: boolean;
  className?: string;
}) {
  if (badge === null) return null;
  const tone = onMedia ? MEDIA_TONE_CLASS[badge.tone] : TONE_CLASS[badge.tone];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone} ${className}`}>
      {badge.label}
    </span>
  );
}
