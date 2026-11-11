import { useTranslation } from "react-i18next";

interface WhatsNewFooterProps {
  index: number;
  count: number;
  onSelect: (index: number) => void;
  onDone: () => void;
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

/**
 * Au-delà, les points cèdent à une jauge : soixante points débordaient du pied et poussaient
 * « Suivant » hors de l'écran (11/11 — un appareil resté plusieurs versions en arrière cumule
 * leurs nouveautés).
 */
export const MAX_PROGRESS_DOTS = 12;

/** Points de progression (ou jauge) au centre, Précédent à gauche, Suivant puis Terminé à droite. */
export function WhatsNewFooter({ index, count, onSelect, onDone }: WhatsNewFooterProps) {
  const { t } = useTranslation("whatsNew");
  const last = index >= count - 1;
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line-subtle px-6 py-4">
      <button
        type="button"
        onClick={() => onSelect(index - 1)}
        disabled={index === 0}
        className="btn btn-soft shrink-0"
      >
        {t("whatsNew:previous")}
      </button>

      {/* Le centre cède toujours la place : les deux boutons ne sortent jamais du pied. */}
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        {count > MAX_PROGRESS_DOTS ? (
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={count}
            aria-valuenow={index + 1}
            aria-label={t("whatsNew:progress", { index: index + 1, total: count })}
            className="h-1 w-full max-w-[260px] overflow-hidden rounded-full bg-fill-strong"
          >
            {/* À l'encre, en `transform` : elle dit où l'on est, elle ne mesure rien. */}
            <div
              className="h-full w-full origin-left rounded-full bg-content-primary"
              style={{ transform: `scaleX(${(index + 1) / count})`, transition: "transform var(--duration-base) var(--ease-out)" }}
            />
          </div>
        ) : Array.from({ length: count }, (_, i) => {
          const current = i === index;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              aria-label={t("whatsNew:progress", { index: i + 1, total: count })}
              aria-current={current ? "true" : undefined}
              className={`relative h-2.5 w-2.5 rounded-full bg-fill-strong ${FOCUS}`}
              style={{ transform: current ? "scale(1.3)" : "scale(1)", transition: "transform var(--duration-base) var(--ease-out)" }}
            >
              {/* Le point courant se révèle en opacité par-dessus le gris — pas de fond animé.
                  À l'encre : il dit où l'on est, il ne mesure rien (plus de dégradé de marque). */}
              <span
                aria-hidden
                className="absolute inset-0 rounded-full bg-content-primary"
                style={{ opacity: current ? 1 : 0, transition: "opacity var(--duration-base) var(--ease-out)" }}
              />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={last ? onDone : () => onSelect(index + 1)}
        // L'action principale NEUTRE du socle : avancer n'est pas lire.
        className="btn btn-solid shrink-0"
      >
        {last ? t("whatsNew:done") : t("whatsNew:next")}
      </button>
    </div>
  );
}
