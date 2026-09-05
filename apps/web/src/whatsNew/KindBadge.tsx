import { useTranslation } from "react-i18next";
import type { WhatsNewKind } from "./types";

const KIND_KEY: Record<WhatsNewKind, string> = {
  new: "whatsNew:kindNew",
  improved: "whatsNew:kindImproved",
  fixed: "whatsNew:kindFixed",
};

const KIND_STYLE: Record<WhatsNewKind, string> = {
  new: "border-[rgba(var(--brand-rgb),0.5)] bg-[var(--brand-soft)] text-[var(--brand)]",
  improved: "border-[rgba(var(--brand-accent-rgb),0.45)] bg-[rgba(var(--brand-accent-rgb),0.12)] text-[var(--brand-accent)]",
  fixed: "border-line-strong bg-fill-soft text-content-secondary",
};

const KIND_DOT: Record<WhatsNewKind, string> = {
  new: "bg-[var(--brand)]",
  improved: "bg-[var(--brand-accent)]",
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
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${KIND_STYLE[kind]}`}
    >
      {label}
    </span>
  );
}
