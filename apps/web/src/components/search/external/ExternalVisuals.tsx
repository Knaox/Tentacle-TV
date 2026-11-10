/**
 * Les briques visuelles d'un résultat hors bibliothèque : l'affiche (ou ses
 * initiales, jamais un carré vide) et la pastille que le plugin a choisie.
 * Partagées par l'omnibox, la page de résultats et les bibliothèques.
 */

import { memo } from "react";
import type { ExternalSearchItem, ExternalTone } from "@tentacle-tv/shared";
import { ThumbImage } from "../SearchThumbs";

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
  // La même image à repli que les vignettes de la bibliothèque : l'encre
  // d'abord, UN fondu, les initiales si l'affiche manque.
  return <ThumbImage url={item.imageUrl} label={item.title} className={className} />;
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
    <span className={`inline-flex h-5 shrink-0 items-center rounded-chip px-1.5 text-[11px] font-semibold leading-none ${tone} ${className}`}>
      {badge.label}
    </span>
  );
}
