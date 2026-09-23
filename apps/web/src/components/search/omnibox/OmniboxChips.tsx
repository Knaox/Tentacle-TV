/**
 * Les pastilles de genres et de studios — des options de la liste comme les
 * autres, disposées en ligne : les flèches les parcourent dans l'ordre, et
 * l'active prend l'anneau de la marque.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { SearchFacetHit } from "@tentacle-tv/shared";
import { optionId, type RowProps } from "./OmniboxRows";

/** Les noms de genre arrivent de fournisseurs divers (« action », « Drame ») : une majuscule à l'affichage. */
export function displayFacet(name: string): string {
  return name.charAt(0).toLocaleUpperCase() + name.slice(1);
}

export const FacetChip = memo(function FacetChip({
  facet,
  kind,
  showKind,
  ...row
}: RowProps & { facet: SearchFacetHit; kind: "genre" | "studio"; showKind: boolean }) {
  const { t } = useTranslation("search");
  const { index, active, onHover, onActivate } = row;
  return (
    <span
      id={optionId(index)}
      role="option"
      aria-selected={active}
      onMouseMove={() => { if (!active) onHover(index); }}
      onClick={() => onActivate(index)}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] transition-colors duration-100 ${
        active
          ? "border-[rgba(var(--brand-rgb),0.55)] bg-[var(--brand-soft)] text-content-primary"
          : "border-line-subtle bg-fill-subtle text-content-secondary hover:bg-fill-soft"
      }`}
    >
      {showKind && (
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-content-quaternary">
          {t(kind)}
        </span>
      )}
      <span className="font-medium">{displayFacet(facet.name)}</span>
      <span className="tabular-nums text-content-quaternary">{facet.count}</span>
    </span>
  );
});
