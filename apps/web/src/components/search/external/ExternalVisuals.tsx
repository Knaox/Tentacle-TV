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

export function ExternalBadge({ badge, className = "" }: { badge: ExternalSearchItem["badge"]; className?: string }) {
  if (badge === null) return null;
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${TONE_CLASS[badge.tone]} ${className}`}>
      {badge.label}
    </span>
  );
}
