/**
 * La carte d'un titre HORS bibliothèque dans le miroir (téléphone) : celle des
 * sections « Pas encore sur le serveur » de la recherche et d'une
 * filmographie. La largeur vient du parent (rail ou grille).
 */

import { useState } from "react";
import { Film, Tv } from "lucide-react";
import type { ExternalSearchItem, ExternalTone } from "@tentacle-tv/shared";

/** Affiche 2:3 à contour pointillé, pastille d'état, titre 13 et année 12. */
export function ExternalResultCard({ item, width, onPress }: { item: ExternalSearchItem; width: number; onPress: () => void }) {
  const [broken, setBroken] = useState(false);
  const Icon = item.kind === "series" ? Tv : Film;
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={[item.title, item.year, item.badge?.label].filter(Boolean).join(", ")}
      className="shrink-0 text-left active:opacity-70"
      style={{ width }}
    >
      <span
        className="relative flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-line-subtle bg-surface-2"
        style={{ width, height: width * 1.5 }}
      >
        {item.imageUrl && !broken ? (
          <img src={item.imageUrl} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <Icon size={26} className="text-content-quaternary" aria-hidden />
        )}
        {item.badge && <Badge label={item.badge.label} tone={item.badge.tone} />}
      </span>
      <span className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-4 text-content-primary">{item.title}</span>
      {item.year !== null && <span className="block text-xs text-content-tertiary">{item.year}</span>}
    </button>
  );
}

/** Les paires d'état du thème (`statusPairs` de l'app) ; `neutral` : pastille sombre. */
const TONE_CLASS: Record<ExternalTone, string> = {
  neutral: "text-on-media-primary",
  info: "bg-status-info-bg text-status-info-fg",
  success: "bg-status-success-bg text-status-success-fg",
  warning: "bg-status-warning-bg text-status-warning-fg",
};

/** La pastille d'état que le plugin pose sur un titre (« Demandé », « Bientôt »…). */
function Badge({ label, tone }: { label: string; tone: ExternalTone }) {
  return (
    <span
      className={`absolute bottom-1.5 left-1.5 max-w-[88%] truncate rounded-full px-[7px] py-[3px] text-[10.5px] font-semibold ${TONE_CLASS[tone]}`}
      style={tone === "neutral" ? { background: "rgba(var(--scrim-media-rgb), 0.72)" } : undefined}
    >
      {label}
    </span>
  );
}
