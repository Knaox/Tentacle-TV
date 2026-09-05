import { useTranslation } from "react-i18next";
import { MetaChip } from "../../../components/media/MetaChips";
import type { SceneProps } from "../../types";
import { FauxCursor, FauxRow, Place, ScenePlayerPanel, SceneStage, useSceneClock } from "..";

const STEPS = [800, 900, 700, 1700] as const;

/** Le voile de survol des cartes reco : pastille Lecture (le vrai disque) et badges de qualité et de langues. */
function HoverVeil({ shown, label }: { shown: boolean; label: string }) {
  return (
    <div className="absolute inset-0" style={{ opacity: shown ? 1 : 0, transition: "opacity var(--duration-base) var(--ease-out)" }}>
      <div className="pointer-events-none absolute left-1.5 top-1.5 z-10 flex flex-wrap items-center gap-1">
        <MetaChip tone="accent">4K</MetaChip>
        <MetaChip>Vision</MetaChip>
        <MetaChip tone="lang">VF · EN</MetaChip>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-full" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.92) 30%, rgba(0,0,0,0.55) 70%, transparent)" }} />
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-2.5 pb-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cta-primary-border bg-cta-primary-bg text-cta-primary-fg" style={{ boxShadow: "var(--elev-2)" }}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
        </span>
        <span className="min-w-0 truncate whitespace-nowrap text-[11px] font-semibold leading-none text-white">{label}</span>
      </div>
    </div>
  );
}

/** Survoler une carte reco révèle Lecture et ses badges ; un clic, et le lecteur reprend là où vous en étiez. */
export function PlayFromRecoScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const hover = step >= 1;
  const playing = step >= 3;
  return (
    <SceneStage cycle={cycle}>
      <FauxRow x={38} y={10} title={t("reco:rowForYou")} count={4} cardW={110} showTitles highlight={hover ? 1 : undefined} />
      {/* Le voile est peint PAR-DESSUS la carte survolée, à sa place exacte, avec la même levée. */}
      <Place x={158} y={36} w={110} h={165} visible={hover} scale={hover ? 1.06 : 1} dy={hover ? -8 : 0} className="overflow-hidden rounded-[var(--radius-lg)]">
        <HoverVeil shown={hover} label={t("common:play")} />
      </Place>
      <ScenePlayerPanel x={38} y={246} w={200} progress={0.42} caption={t("whatsNew:sceneResume")} visible={playing} dy={playing ? 0 : 12} />
      <FauxCursor
        x={step === 1 ? 213 : step >= 2 ? 186 : 560}
        y={step === 1 ? 118 : step >= 2 ? 173 : 330}
        pressed={step === 2}
        hidden={playing}
        reduced={reduced}
      />
    </SceneStage>
  );
}
