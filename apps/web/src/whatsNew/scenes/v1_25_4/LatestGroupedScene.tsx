import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { useSceneMedia, type SceneMedia, type ScenePoster } from "../../sceneMedia";
import { FauxCard, FauxCursor, Place, SceneStage, useSceneClock } from "..";

/** Avant (la rangée inondée), le regroupement, après, la carte survolée. */
const STEPS = [1900, 700, 1700, 1600] as const;
const CARD_W = 100;
const GAP = 12;
const COUNT = 5;
const ROW_X = Math.round((640 - (COUNT * CARD_W + (COUNT - 1) * GAP)) / 2);
const ROW_Y = 92;
/** Les épisodes d'une même série arrivés ensemble, avant le regroupement. */
const FLOOD = 4;
const NBSP_DOT = " · ";

const slotX = (slot: number) => ROW_X + slot * (CARD_W + GAP);

interface Picks {
  /** Trois séries distinctes (la regroupée, la saison, la nouvelle série) et deux autres titres. */
  series: (ScenePoster | null)[];
  others: (ScenePoster | null)[];
}

/** Des séries pour les cartes regroupées, jamais l'affiche d'un film ; le reste en complément. */
function pick(media: SceneMedia): Picks {
  const seen = new Set<string>();
  const series: ScenePoster[] = [];
  for (const poster of media.posters) {
    if (!poster.series || seen.has(poster.series)) continue;
    seen.add(poster.series);
    series.push(poster);
  }
  const others = media.posters.filter((poster) => !poster.series);
  return {
    series: [0, 1, 2].map((i) => series[i] ?? null),
    others: [0, 1].map((i) => others[i] ?? null),
  };
}

/**
 * « Derniers ajouts » : quatre épisodes d'une même série arrivés ensemble
 * occupaient quatre cartes ; ils n'en font plus qu'une, celle de la série,
 * qui dit ce qu'elle apporte — la ligne du modèle partagé
 * (`latestAdditionsLine`, clés de l'espace `cards`) à la place de l'année.
 * La rangée reste variée : une nouvelle saison, une nouvelle série, des films.
 */
export function LatestGroupedScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["whatsNew", "cards", "common"]);
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const media = useSceneMedia();
  const picks = useMemo(() => pick(media), [media]);
  const grouped = step >= 1;
  const [main, season, fresh] = picks.series;
  const nameOf = (poster: ScenePoster | null) => poster?.series ?? poster?.title ?? null;
  const after: { poster: ScenePoster | null; line: string | null; tone: number }[] = [
    { poster: main, line: t("cards:newEpisodes", { count: FLOOD }), tone: 0 },
    { poster: season, line: `${t("cards:newSeasons", { count: 1 })}${NBSP_DOT}${t("cards:episodeCount", { count: 8 })}`, tone: 1 },
    { poster: fresh, line: `${t("cards:newSeries")}${NBSP_DOT}${t("cards:episodeCount", { count: 10 })}`, tone: 2 },
    { poster: picks.others[0], line: null, tone: 3 },
    { poster: picks.others[1], line: null, tone: 4 },
  ];
  return (
    <SceneStage cycle={cycle}>
      <Place x={ROW_X} y={ROW_Y - 34}>
        <span className="text-[15px] font-semibold tracking-tight text-content-primary">{t("common:latestAdditionsShort")}</span>
      </Place>
      {/* Avant : la même série, épisode après épisode. */}
      {Array.from({ length: FLOOD }, (_, i) => (
        <Place key={`flood-${i}`} x={slotX(i)} y={ROW_Y} w={CARD_W} visible={!grouped || i === 0} dx={grouped ? slotX(0) - slotX(i) : 0} scale={grouped && i > 0 ? 0.9 : 1}>
          {!grouped || i > 0 ? (
            <>
              <FauxCard x={0} y={0} w={CARD_W} poster={main} tone={0} />
              <Caption title={nameOf(main)} line={t("whatsNew:sceneEpisode", { number: 7 + i })} />
            </>
          ) : null}
        </Place>
      ))}
      <Place x={slotX(FLOOD)} y={ROW_Y} w={CARD_W} visible={!grouped}>
        <FauxCard x={0} y={0} w={CARD_W} poster={picks.others[0]} tone={3} />
        <Caption title={nameOf(picks.others[0])} line={picks.others[0]?.year ? String(picks.others[0].year) : null} />
      </Place>
      {/* Après : une carte par série, la rangée variée. */}
      {after.map((card, slot) => (
        <Place key={`after-${slot}`} x={slotX(slot)} y={ROW_Y} w={CARD_W} visible={grouped} dy={grouped ? 0 : 8}>
          <FauxCard x={0} y={0} w={CARD_W} poster={card.poster} tone={card.tone} hovered={step === 3 && slot === 0} />
          <Caption title={nameOf(card.poster)} line={card.line ?? (card.poster?.year ? String(card.poster.year) : null)} />
        </Place>
      ))}
      <FauxCursor x={slotX(0) + CARD_W / 2} y={ROW_Y + 70} hidden={step < 3} reduced={reduced} />
    </SceneStage>
  );
}

/** La légende de `PosterCard` (ses classes, aux tailles des scènes) : le titre, puis l'année — ou ce que la carte regroupée apporte. */
function Caption({ title, line }: { title: string | null; line: string | null }) {
  return (
    <div className="absolute left-0 right-0 px-0.5" style={{ top: CARD_W * 1.5 + 10 }}>
      {title ? <h3 className="truncate text-[11px] font-semibold tracking-tight text-content-primary">{title}</h3> : <span className="block h-2.5 w-3/4 rounded bg-fill-medium" />}
      {line ? <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug card-caption">{line}</p> : null}
    </div>
  );
}
