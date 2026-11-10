import { useTranslation } from "react-i18next";
import type { WhatsNewKind } from "./types";

const KIND_KEY: Record<WhatsNewKind, string> = {
  new: "whatsNew:kindNew",
  improved: "whatsNew:kindImproved",
  fixed: "whatsNew:kindFixed",
};

// Des puces du socle : la teinte franche pour ce qui est NOUVEAU, l'encre pour le reste —
// plus de violet et de rose de marque pour distinguer trois sortes de lignes.
const KIND_STYLE: Record<WhatsNewKind, string> = {
  new: "chip-accent",
  improved: "text-content-primary",
  fixed: "",
};

const KIND_DOT: Record<WhatsNewKind, string> = {
  new: "bg-accent",
  improved: "bg-content-secondary",
  fixed: "bg-content-quaternary",
};

/** Nouveau / Amélioré / Corrigé — pastille pleine, ou point coloré avec libellé lu seulement. */
export function KindBadge({ kind, compact = false }: { kind: WhatsNewKind; compact?: boolean }) {
  const { t } = useTranslation("whatsNew");
  const label = t(KIND_KEY[kind]);
  if (compact) {
    return (
      <span className="mt-1.5 flex-shrink-0">
        <span aria-hidden className={`block h-2 w-2 rounded-full ${KIND_DOT[kind]}`} />
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <span
      className={`chip h-[22px] text-[11px] uppercase tracking-wide ${KIND_STYLE[kind]}`}
    >
      {label}
    </span>
  );
}
