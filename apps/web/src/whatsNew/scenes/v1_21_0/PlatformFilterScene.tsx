import { Check, SlidersHorizontal, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PlatformLogo } from "../../../components/reco/PlatformLogo";
import { useSceneMedia } from "../../sceneMedia";
import type { SceneProps } from "../../types";
import { FauxCursor, FauxRow, Place, SceneStage, useSceneClock } from "..";

const STEPS = [700, 900, 900, 1700] as const;
const FILTERED = [1, 3] as const;
const NONE: readonly number[] = [];

/** Le vrai menu Filtres de la page Recommandations ; Netflix coché, les titres absents du service s'effacent. */
export function PlatformFilterScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const { platforms } = useSceneMedia();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const open = step >= 1;
  const selected = step >= 2;
  const filtered = step >= 3;
  const entries = platforms.slice(0, 6);
  const netflix = entries[0];
  return (
    <SceneStage cycle={cycle}>
      {/* Le bouton Filtres, tel quel (RecoFiltersMenu). */}
      <Place x={24} y={20}>
        <span
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${
            selected
              ? "border-[rgba(var(--brand-rgb),0.5)] bg-[var(--brand-soft)] text-[var(--brand)]"
              : "border-line-subtle bg-fill-subtle text-content-secondary"
          }`}
        >
          <SlidersHorizontal size={15} aria-hidden />
          {t("reco:filtersButton")}
          {selected && <span className="rounded-full bg-[var(--brand)] px-1.5 text-[11px] font-bold leading-4 text-cta-brand-fg">1</span>}
        </span>
      </Place>
      {/* Le panneau, avec les vrais logos de vos services. */}
      <Place x={24} y={66} w={300} visible={open} dy={open ? 0 : 6} className="rounded-2xl border border-line-subtle bg-surface-modal p-4 shadow-2xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-content-quaternary">{t("reco:filtersPlatformsLabel")}</p>
        <div className="grid grid-cols-2 gap-1.5">
          {entries.map((entry, i) => {
            const activeChip = selected && i === 0;
            return (
              <span
                key={entry.key}
                className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left ${
                  activeChip ? "border-[rgba(var(--brand-rgb),0.5)] bg-[var(--brand-soft)]" : "border-transparent"
                }`}
              >
                <PlatformLogo logoPath={entry.logoPath} label={entry.label} />
                <span className="min-w-0 flex-1 truncate text-sm text-content-primary">{entry.label}</span>
                {activeChip && <Check size={14} className="shrink-0 text-[var(--brand)]" aria-hidden />}
              </span>
            );
          })}
        </div>
      </Place>
      <FauxRow x={344} y={24} title={t("reco:rowForYou")} count={4} cardW={60} hidden={filtered ? FILTERED : NONE} />
      <FauxRow x={344} y={150} title={t("reco:rowDiscover")} count={4} cardW={60} offset={4} hidden={filtered ? FILTERED : NONE} />
      {/* La puce de filtre de l'accueil (HomeRecoFilterChip), après le titre de la rangée. */}
      {netflix && (
        <Place x={434} y={19} visible={filtered} dy={filtered ? 0 : 6}>
          <span className="flex min-w-0 items-center gap-1.5 rounded-full border border-[rgba(var(--brand-rgb),0.5)] bg-[var(--brand-soft)] py-0.5 pl-1.5 pr-1 text-xs font-medium text-[var(--brand)]">
            <PlatformLogo logoPath={netflix.logoPath} label={netflix.label} className="h-4 w-4" />
            <span className="truncate">{netflix.label}</span>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"><X size={12} aria-hidden /></span>
          </span>
        </Place>
      )}
      <FauxCursor
        x={step === 1 ? 70 : step === 2 ? 110 : step >= 3 ? 250 : 560}
        y={step === 1 ? 38 : step === 2 ? 138 : step >= 3 ? 320 : 330}
        pressed={step === 1 || step === 2}
        reduced={reduced}
      />
    </SceneStage>
  );
}
