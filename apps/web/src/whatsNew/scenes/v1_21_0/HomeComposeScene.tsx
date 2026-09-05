import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { FauxCursor, FauxRow, FauxToggle, Place, SceneStage, useSceneClock } from "..";

const STEPS = [800, 900, 1500, 1300] as const;
const ROW_H = 52;

/** Dans Personnalisation, une rangée remonte et une autre s'allume ; le mini-accueil suit. */
export function HomeComposeScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const moved = step >= 1;
  const trendingOn = step >= 2;
  const rows = [
    { label: t("nav:myFavorites"), on: true, dy: moved ? ROW_H : 0 },
    { label: t("nav:libraries"), on: true, dy: moved ? ROW_H : 0 },
    { label: t("reco:rowForYou"), on: true, dy: moved ? -2 * ROW_H : 0 },
    { label: t("reco:rowTrending"), on: trendingOn, dy: 0 },
  ];
  return (
    <SceneStage cycle={cycle}>
      <Place x={32} y={28} w={280} h={304} className="rounded-[var(--radius-lg)] border border-line-subtle bg-surface-2">
        <span className="absolute left-4 top-3 text-[13px] font-semibold text-content-primary">{t("preferences:persoRowsTitle")}</span>
      </Place>
      {rows.map((row, i) => (
        <Place key={row.label} x={44} y={72 + i * ROW_H} w={256} h={40} dy={row.dy} className="flex items-center gap-3 rounded-[var(--radius-md)] bg-fill-subtle px-3">
          <span className="text-[12px] text-content-quaternary">≡</span>
          <span className="flex-1 truncate text-[12px] font-medium text-content-secondary">{row.label}</span>
          <FauxToggle x={196} y={8} on={row.on} />
        </Place>
      ))}
      <FauxRow x={340} y={40} title={t("nav:myFavorites")} count={5} cardW={40} tones={[3, 1, 4, 3, 5]} dy={moved ? 110 : 0} />
      <FauxRow x={340} y={150} title={t("reco:rowForYou")} count={5} cardW={40} tones={[0, 2, 1, 0, 2]} dy={moved ? -110 : 0} />
      <FauxRow x={340} y={260} title={t("reco:rowTrending")} count={5} cardW={40} tones={[5, 4, 2, 1, 3]} visible={trendingOn} stagger />
      <FauxCursor
        x={step === 1 ? 60 : step >= 2 ? 262 : 560}
        y={step === 1 ? 92 : step >= 2 ? 248 : 330}
        pressed={step === 1 || step === 2}
        reduced={reduced}
      />
    </SceneStage>
  );
}
