import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { FauxChip, FauxCursor, Place, SceneStage, useSceneClock } from "..";

const STEPS = [900, 1000, 1900] as const;
const SEASONS = [
  { number: 1, episodes: 12, size: "16.3 Gio" },
  { number: 2, episodes: 11, size: "9.16 Gio" },
] as const;

/**
 * Le dialogue part d'un épisode ; le curseur choisit « La série », et le
 * panneau s'ouvre sur les saisons — il GRANDIT à ce moment-là plutôt que de
 * réserver un vide, parce que c'est exactement ce que fait le vrai dialogue.
 */
export function SeriesScopeScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const widened = step >= 2;
  return (
    <SceneStage cycle={cycle}>
      <Place x={92} y={78} w={456} className="rounded-2xl border border-line-subtle bg-surface-modal p-5 shadow-2xl">
        <p className="text-[15px] font-bold text-content-primary">
          {widened ? t("downloads:dialogTitleSeries") : t("downloads:dialogTitle")}
        </p>
        <p className="mt-0.5 text-[12px] text-content-tertiary">Fullmetal Alchemist: Brotherhood</p>
        <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wide text-content-quaternary">
          {t("downloads:scopeLabel")}
        </p>
        {/* La place des trois puces, posées par-dessus (ce sont des `Place`). */}
        <div className="h-7" />
        {widened && (
          <div className="mt-4">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-content-quaternary">
              {t("downloads:seasonsPickerLabel")}
            </p>
            {SEASONS.map((season) => (
              <span key={season.number} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                <span className="grid h-4 w-4 flex-shrink-0 place-items-center rounded border border-line-focus bg-cta-primary-bg">
                  <svg viewBox="0 0 24 24" className="h-3 w-3 text-cta-primary-fg" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="flex-1 text-[12px] text-content-secondary">
                  {t("downloads:seasonLabel", { num: season.number })}
                </span>
                <span className="text-[11px] tabular-nums text-content-quaternary">
                  {t("downloads:episodesCount", { count: season.episodes })} · {season.size}
                </span>
              </span>
            ))}
          </div>
        )}
      </Place>
      <FauxChip x={112} y={169} label={t("downloads:scopeEpisode")} selected={!widened} size="sm" />
      <FauxChip x={228} y={169} label={t("downloads:scopeSeason")} size="sm" />
      <FauxChip x={330} y={169} label={t("downloads:scopeSeries")} selected={widened} size="sm" />
      <FauxCursor x={widened ? 352 : 468} y={widened ? 184 : 300} hidden={step < 1} reduced={reduced} />
    </SceneStage>
  );
}
