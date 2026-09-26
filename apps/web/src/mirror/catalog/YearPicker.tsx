import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";

const OLDEST_YEAR = 1950;

/**
 * Le choix d'une année (`YearPicker` de `CatalogFilterSheet`) : libellé 10
 * tertiaire, bouton de 44 sur `fill.subtle` bordé, rayon 12 ; déplié, la
 * liste des années (de l'année courante à 1950) défile sur 176 au plus,
 * rangées de 40, la valeur choisie en violet.
 */
export function YearPicker({ label, value, onChange }: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = new Date().getFullYear(); y >= OLDEST_YEAR; y--) list.push(y);
    return list;
  }, []);
  const choose = (v: number | null) => {
    onChange(v);
    setOpen(false);
  };
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1 text-[10px] font-bold tracking-[0.3px] text-content-tertiary">{label}</p>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`${label} ${value ?? t("allYears")}`}
        className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-line-subtle bg-fill-subtle px-3"
      >
        <span className="text-sm text-content-secondary">{value ?? t("allYears")}</span>
        <Chevron size={14} className="text-content-tertiary" aria-hidden />
      </button>
      {open && (
        <div className="mt-1 max-h-[176px] overflow-y-auto overscroll-contain">
          {[null, ...years].map((y) => (
            <button
              key={y ?? "all"}
              type="button"
              onClick={() => choose(y)}
              className={`flex min-h-[40px] w-full items-center px-1 text-left text-sm ${value === y ? "" : "text-content-secondary"}`}
              style={value === y ? { color: "var(--brand)" } : undefined}
            >
              {y ?? t("allYears")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
