import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { splitMinutes } from "@tentacle-tv/shared";
import type { PlayCta } from "./detailMetrics";

const RING_R = 14;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Le bouton Lecture de la scène (`PlayCtaButton` de l'app) : pleine largeur
 * (420 au plus), 56 de haut, au dégradé de marque — la seule action en
 * couleur, comme le bouton de lecture des cartes. L'avancement se lit dans
 * l'anneau de l'icône, le temps restant sous le verbe.
 *
 * La feuille d'appui long des cartes le reprend tel quel, avec son propre
 * geste (`onPress`) : elle sait se rabattre sur la fiche quand une série n'a
 * rien à lancer.
 */
export const PlayCtaButton = memo(function PlayCtaButton({ cta, title, maxWidth, onPress }: {
  cta: PlayCta;
  title: string;
  maxWidth: number;
  /** Remplace la lecture de `cta.targetId`. */
  onPress?: () => void;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation("media");
  if (!cta.targetId && !onPress) return null;
  const remaining = cta.remainingMinutes != null ? remainingLabel(cta.remainingMinutes, t) : null;

  return (
    <button
      type="button"
      onClick={onPress ?? (() => navigate(`/watch/${cta.targetId}`))}
      aria-label={`${cta.label} ${title}`}
      // L'estompe sous le doigt en classes, pas par `mirror-detail-fade-press` :
      // la feuille des cartes le monte hors de la fiche, sans `detail.css`.
      className="relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-full px-6 text-cta-brand-fg transition-opacity duration-[120ms] ease-out active:opacity-[0.85]"
      style={{
        maxWidth,
        WebkitTapHighlightColor: "transparent",
        background: "linear-gradient(120deg, var(--brand) 0%, var(--brand-accent) 100%)",
        boxShadow: "0 10px 26px rgba(var(--brand-rgb), 0.4)",
      }}
    >
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
        {cta.progress !== null && (
          <svg className="absolute inset-0 h-8 w-8 -rotate-90" viewBox="0 0 32 32" aria-hidden>
            <circle cx="16" cy="16" r={RING_R} fill="none" stroke="currentColor" strokeOpacity={0.3} strokeWidth={2.5} />
            <circle cx="16" cy="16" r={RING_R} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
              strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - cta.progress)} />
          </svg>
        )}
        <Play size={16} fill="currentColor" aria-hidden className="relative ml-0.5" />
      </span>
      <span className="flex min-w-0 flex-col items-start leading-tight">
        <span className="max-w-full truncate text-[16px] font-bold tracking-[0.2px]">{cta.label}</span>
        {remaining && <span className="text-[12px] font-medium opacity-85">{remaining}</span>}
      </span>
    </button>
  );
});

function remainingLabel(total: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const { hours, minutes } = splitMinutes(total);
  return hours > 0
    ? t("detailRemainingHours", { hours, minutes: String(minutes).padStart(2, "0") })
    : t("detailRemainingMinutes", { count: minutes });
}
