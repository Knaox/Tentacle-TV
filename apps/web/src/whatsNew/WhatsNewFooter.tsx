import { useTranslation } from "react-i18next";

interface WhatsNewFooterProps {
  index: number;
  count: number;
  onSelect: (index: number) => void;
  onDone: () => void;
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

/** Points de progression au centre, Précédent à gauche, Suivant puis Terminé à droite. */
export function WhatsNewFooter({ index, count, onSelect, onDone }: WhatsNewFooterProps) {
  const { t } = useTranslation("whatsNew");
  const last = index >= count - 1;
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line-subtle px-6 py-4">
      <button
        type="button"
        onClick={() => onSelect(index - 1)}
        disabled={index === 0}
        className={`rounded-full bg-fill-subtle px-4 py-2 text-sm font-medium text-content-secondary transition-colors hover:bg-fill-soft disabled:pointer-events-none disabled:opacity-40 ${FOCUS}`}
      >
        {t("whatsNew:previous")}
      </button>

      <div className="flex items-center gap-2">
        {Array.from({ length: count }, (_, i) => {
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
              {/* Le point courant se révèle en opacité par-dessus le gris — pas de fond animé. */}
              <span
                aria-hidden
                className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)]"
                style={{ opacity: current ? 1 : 0, transition: "opacity var(--duration-base) var(--ease-out)" }}
              />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={last ? onDone : () => onSelect(index + 1)}
        className={`rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)] px-5 py-2 text-sm font-bold text-cta-brand-fg shadow-[0_6px_18px_rgba(var(--brand-rgb),0.35)] transition-transform hover:scale-[1.02] motion-reduce:!transform-none ${FOCUS}`}
      >
        {last ? t("whatsNew:done") : t("whatsNew:next")}
      </button>
    </div>
  );
}
