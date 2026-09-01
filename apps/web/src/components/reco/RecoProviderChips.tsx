import { useTranslation } from "react-i18next";
import { PLATFORMS } from "../../hooks/usePlatformFilter";

interface RecoProviderChipsProps {
  selected: number[];
  onChange: (ids: number[]) => void;
}

/**
 * Chips de filtre par plateforme (ids watch-provider TMDB, catalogue partagé
 * avec le filtre de bibliothèque/Seer). Multi-sélection, filtrage CLIENT pur
 * (aucun refetch), boutons à état `aria-pressed`, collection qui passe à la
 * ligne — jamais une rangée rognée.
 */
export function RecoProviderChips({ selected, onChange }: RecoProviderChipsProps) {
  const { t } = useTranslation("reco");

  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div
      className="row-gutter mb-8 flex flex-wrap items-center gap-2"
      role="group"
      aria-label={t("providersFilterAria")}
    >
      <button
        type="button"
        aria-pressed={selected.length === 0}
        onClick={() => onChange([])}
        className={chipClass(selected.length === 0)}
      >
        {t("providersAll")}
      </button>
      {PLATFORMS.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={selected.includes(p.id)}
          onClick={() => toggle(p.id)}
          className={chipClass(selected.includes(p.id))}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}

function chipClass(active: boolean): string {
  return `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "border-[rgba(var(--brand-rgb),0.5)] bg-[var(--brand-soft)] text-[var(--brand)]"
      : "border-line-subtle bg-fill-subtle text-content-secondary hover:bg-fill-soft hover:text-content-primary"
  }`;
}
