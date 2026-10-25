/**
 * Octave — l'état d'un titre hors bibliothèque, en mot ET en icône (jamais la
 * couleur seule) : prêt à écouter, en attente d'ajout, hors bibliothèque.
 * Rien pour un titre de la bibliothèque — c'est le cas ordinaire — sauf dans
 * une liste qui MÊLE les deux (`showLibrary` : album en partie présent,
 * recherche, playlist d'ailleurs) : l'icône de la bibliothèque, au ton de
 * réussite, y distingue ce qui est déjà à soi.
 */

import { memo } from "react";
import { AlertCircle, Clock3, Cloud, Library, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TrackAvailability } from "@tentacle-tv/shared/music";

interface AvailabilityMarkProps {
  availability: TrackAvailability;
  failed?: boolean;
  /** `chip` : pastille avec le mot ; `icon` : l'icône seule (le mot en infobulle et pour les lecteurs d'écran). */
  variant?: "chip" | "icon";
  showLibrary?: boolean;
}

export const AvailabilityMark = memo(function AvailabilityMark({ availability, failed = false, variant = "icon", showLibrary = false }: AvailabilityMarkProps) {
  const { t } = useTranslation("music");
  if (availability === "library" && !showLibrary) return null;
  const key = failed ? "failed" : availability;
  const Icon = failed ? AlertCircle : availability === "pending" ? Clock3 : availability === "cache" ? Zap : availability === "remote" ? Cloud : Library;
  const tone = failed ? "text-status-error-fg" : availability === "pending" ? "text-status-warning-fg" : availability === "cache" ? "text-octave-accent-text" : availability === "library" ? "text-status-success-fg" : "text-content-tertiary";
  const label = t(`availability.${key}`);
  // En attente : l'infobulle dit ce qui va se passer (il s'écoute déjà).
  const hint = key === "pending" ? `${label} — ${t("availability.pendingHint")}` : label;
  if (variant === "icon") {
    return (
      <span className={`inline-flex shrink-0 items-center ${tone}`} title={hint}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-fill-subtle px-2 py-0.5 text-[11px] font-medium ${tone}`} title={hint}>
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
});
