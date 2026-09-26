import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { isFamilyActive, toggleFamily, type PlatformCatalogEntry } from "@tentacle-tv/api-client";
import { PlatformLogo } from "../../../components/reco/PlatformLogo";
import { useRecoFilter } from "../../../hooks/useRecoFilter";
import { BottomSheet } from "../../ui/BottomSheet";
import { PillButton } from "./PillButton";

/**
 * `RecoFilterSheet` de l'app : les familles de plateformes de la région, en
 * grille de deux cellules (48 de haut, logo 28, rayon 12), multi-sélection,
 * et « Toutes les plateformes ». Feuille à paliers 70 / 95 %. La sélection
 * vit dans le store du filtre du web : la liaison de session la pousse au
 * compte, débouncée — le dernier appui ne se perd pas à la fermeture.
 */
export function RecoFilterSheet({ open, onClose, catalog }: {
  open: boolean;
  onClose: () => void;
  catalog: PlatformCatalogEntry[];
}) {
  const { t } = useTranslation("reco");
  const { selected, setSelected, clear } = useRecoFilter();

  return (
    <BottomSheet open={open} onClose={onClose} snapPoints={[0.7, 0.95]} label={t("filtersPlatformsLabel")}>
      <div className="flex flex-col gap-3 px-4 pb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-content-tertiary">{t("filtersPlatformsLabel")}</p>
        <div className="grid grid-cols-2 gap-2" role="list">
          {catalog.map((entry) => {
            const active = isFamilyActive(entry, selected);
            return (
              <button
                key={entry.key}
                type="button"
                role="checkbox"
                aria-checked={active}
                aria-label={entry.label}
                onClick={() => setSelected(toggleFamily(selected, entry))}
                className="flex min-h-[48px] items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left active:opacity-[0.85]"
                style={{
                  background: active ? "var(--brand-soft)" : "var(--fill-faint)",
                  borderColor: active ? "var(--brand-glow)" : "transparent",
                }}
              >
                <PlatformLogo logoPath={entry.logoPath} label={entry.label} />
                <span
                  className={`min-w-0 flex-1 truncate text-[13px] ${active ? "font-semibold text-brand-light" : "font-medium text-content-primary"}`}
                >
                  {entry.label}
                </span>
                {active && <Check size={16} className="shrink-0 text-brand-light" aria-hidden />}
              </button>
            );
          })}
        </div>
        <PillButton title={t("providersAll")} variant="ghost" onPress={clear} disabled={selected.length === 0} className="self-start" />
      </div>
    </BottomSheet>
  );
}
