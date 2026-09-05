import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../../../components/settings/ToggleSwitch";
import type { SceneProps } from "../../types";
import { FauxCursor, FauxRow, Place, SceneStage, useSceneClock } from "..";

const STEPS = [800, 900, 1500, 1300] as const;
const ROW_H = 50;
const noop = () => {};

function GripIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      {[6, 12, 18].flatMap((cy) => [9, 15].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" />))}
    </svg>
  );
}

function Chevron({ up }: { up: boolean }) {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-md text-content-tertiary">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d={up ? "M4.5 15.75l7.5-7.5 7.5 7.5" : "M19.5 8.25l-7.5 7.5-7.5-7.5"} />
      </svg>
    </span>
  );
}

/** L'éditeur « Rangées de l'accueil » de Personnalisation, tel quel ; une rangée remonte, une autre s'allume, le mini-accueil suit. */
export function HomeComposeScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const moved = step >= 1;
  const trendingOn = step >= 2;
  const rows = [
    { key: "favorites", label: t("common:myFavorites"), on: true, dy: moved ? ROW_H : 0 },
    { key: "library", label: t("common:latestAdditions", { name: "Films" }), on: true, dy: moved ? ROW_H : 0 },
    { key: "forYou", label: t("reco:rowForYou"), on: true, dy: moved ? -2 * ROW_H : 0 },
    { key: "trending", label: t("reco:rowTrending"), on: trendingOn, dy: 0 },
  ];
  return (
    <SceneStage cycle={cycle}>
      <Place x={24} y={20} w={300} h={320} className="rounded-xl border border-line-subtle bg-surface-1 p-3">
        <p className="text-sm font-semibold text-content-primary">{t("preferences:persoRowsTitle")}</p>
      </Place>
      {rows.map((row, i) => (
        <Place
          key={row.key}
          x={36}
          y={60 + i * ROW_H}
          w={276}
          dy={row.dy}
          className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${moved && row.key === "forYou" ? "border-line-focus bg-fill-soft" : "border-line-subtle bg-fill-faint"}`}
        >
          <span aria-hidden className="cursor-grab text-content-quaternary"><GripIcon /></span>
          <span className={`min-w-0 flex-1 truncate text-sm ${row.on ? "text-content-primary" : "text-content-tertiary"}`}>{row.label}</span>
          <span className="flex items-center gap-1"><Chevron up /><Chevron up={false} /></span>
          <ToggleSwitch checked={row.on} onChange={noop} label={row.label} />
        </Place>
      ))}
      <FauxRow x={344} y={20} title={t("common:myFavorites")} count={4} cardW={54} dy={moved ? 112 : 0} />
      <FauxRow x={344} y={132} title={t("reco:rowForYou")} count={4} cardW={54} offset={4} dy={moved ? -112 : 0} />
      <FauxRow x={344} y={244} title={t("reco:rowTrending")} count={4} cardW={54} offset={8} visible={trendingOn} stagger />
      <FauxCursor
        x={step === 1 ? 52 : step >= 2 ? 292 : 560}
        y={step === 1 ? 82 : step >= 2 ? 232 : 330}
        pressed={step === 1 || step === 2}
        reduced={reduced}
      />
    </SceneStage>
  );
}
