import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia, type ScenePoster } from "../../sceneMedia";
import { SeasonTabs, type SeasonTabItem } from "../../../components/episodes/SeasonTabs";
import { FauxCursor, Place, SceneStage, useSceneClock } from "..";
import { WatchedGlyph } from "../../../components/cards/cardGlyphs";
import { CARD_TONES } from "../FauxCard";
import { Shrink } from "./Shrink";

const STEPS = [1700, 900, 400, 1900] as const;
const SEASON_COUNT = 6;
/** La saison de l'épisode à reprendre : ouverte d'emblée, marquée « en cours ». */
const CURRENT = 2;
const NEXT = 3;
const TABS = { x: 36, y: 150, w: 568, scale: 0.8 } as const;
/** Le centre de la pastille « Saison 4 », en px du canevas (pastilles `md` à l'échelle 0,8). */
const NEXT_TAB = { x: 444, y: 167 } as const;
const noop = () => {};

/**
 * La bande des saisons : sur le décor de la série, lisible quelle que soit
 * l'image ; la fiche s'ouvre sur la saison en cours, marquée d'un point, les
 * saisons vues portent la coche. Un clic sur la suivante : ses épisodes sont
 * là tout de suite. La bande est la VRAIE (`SeasonTabs`).
 */
export function SeasonsScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation("whatsNew");
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const media = useSceneMedia();
  const seasons = useMemo<SeasonTabItem[]>(
    () => Array.from({ length: SEASON_COUNT }, (_, i) => ({
      Id: `scene-season-${i}`,
      Name: t("sceneSeason", { number: i + 1 }),
      ChildCount: 10 - (i % 3),
      UserData: { Played: i < CURRENT } as SeasonTabItem["UserData"],
    })),
    [t],
  );
  const selected = step >= 2 ? NEXT : CURRENT;
  const backdrop = media.detail?.gallery[0] ?? media.backdrop?.url ?? null;
  return (
    <SceneStage cycle={cycle}>
      <Place x={0} y={0} w={640} h={210}>
        {backdrop ? <img src={backdrop} alt="" draggable={false} className="h-full w-full object-cover" /> : <div className="h-full w-full" style={{ background: CARD_TONES[2] }} />}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--surface-0)]" />
      </Place>
      <Place x={TABS.x} y={TABS.y}>
        <Shrink width={TABS.w} scale={TABS.scale}>
          <SeasonTabs seasons={seasons} selectedId={seasons[selected].Id} markedId={seasons[CURRENT].Id} onSelect={noop} />
        </Shrink>
      </Place>
      <Place x={TABS.x} y={206} w={TABS.w}>
        <div key={selected} className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <FauxEpisodeRow
              key={i}
              poster={posterAt(media, selected * 3 + i)}
              tone={selected + i}
              label={t("sceneEpisode", { number: i + 1 })}
              progress={selected === CURRENT && i === 1 ? 46 : null}
              watched={selected === CURRENT && i === 0}
            />
          ))}
        </div>
      </Place>
      <FauxCursor x={NEXT_TAB.x} y={NEXT_TAB.y} pressed={step === 2} hidden={step === 0} reduced={reduced} />
    </SceneStage>
  );
}

/** Une ligne d'épisode : sa vignette et sa jauge, son numéro, sa durée. */
function FauxEpisodeRow({ poster, tone, label, progress, watched }: {
  poster: ScenePoster | null; tone: number; label: string; progress: number | null; watched: boolean;
}) {
  const image = poster?.backdropUrl ?? poster?.url ?? null;
  return (
    <div className="flex h-[42px] items-center gap-3 rounded-lg px-1">
      <span className="relative aspect-video h-full shrink-0 overflow-hidden rounded-md bg-fill-subtle">
        {image ? <img src={image} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" /> : <span className="absolute inset-0" style={{ background: CARD_TONES[tone % CARD_TONES.length] }} />}
        {progress !== null && (
          <span className="absolute inset-x-0 bottom-0 block h-[2px] bg-black/55">
            <span className="block h-full" style={{ width: `${progress}%`, background: "var(--progress-fill)" }} />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-semibold text-content-primary">{label}</span>
        <span className="block text-[9px] text-content-tertiary">42 min</span>
      </span>
      {watched && <WatchedGlyph filled className="h-3.5 w-3.5 text-content-secondary" />}
    </div>
  );
}
