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
        className="btn btn-soft"
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
        className="btn btn-solid"
      >
        {last ? t("whatsNew:done") : t("whatsNew:next")}
      </button>
    </div>
  );
}
