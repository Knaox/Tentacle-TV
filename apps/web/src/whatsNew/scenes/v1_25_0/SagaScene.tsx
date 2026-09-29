import { useTranslation } from "react-i18next";
import type { CardStatusKind } from "@tentacle-tv/shared";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import { FauxCursor, Place, SceneStage, sceneTween, useSceneClock } from "..";
import { FauxMarkedCard } from "../v1_24_0/FauxMarkedCard";

const STEPS = [1500, 900, 1300, 500, 1600] as const;
const ROW = { x: 55, y: 92, w: 110, gap: 30 } as const;
const POSTER_OFFSET = 8;
/** Un film par volet : le premier est la fiche ouverte, deux sont vus, le troisième vient ensuite. */
const PARTS: ReadonlyArray<{ statuses: CardStatusKind[]; cue: "current" | "upNext" | null; userScore: number | null }> = [
  { statuses: ["watched"], cue: "current", userScore: 8 },
  { statuses: ["watched"], cue: null, userScore: 7 },
  { statuses: ["watchlist"], cue: "upNext", userScore: null },
  { statuses: [], cue: null, userScore: null },
];
const NEXT = 2;
const colX = (i: number) => ROW.x + i * (ROW.w + ROW.gap);

/**
 * La saga d'un film, sur sa fiche : les volets dans l'ordre, chacun avec son
 * rang (« Volet 3 »), la fiche ouverte cerclée, les vus marqués, et « À
 * suivre » sur celui qui vient après le dernier vu. Le curseur le survole :
 * sa carte est une vraie carte, « Lire » en tête du plateau.
 */
export function SagaScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation("media");
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const media = useSceneMedia();
  const hovered = step >= 2 && step <= 3;
  const cursor = step >= 1 && step <= 3 ? { x: colX(NEXT) + 15, y: ROW.y + 150 } : { x: 580, y: 340 };
  const summary = [
    t("sagaFilms", { count: PARTS.length }),
    t("sagaInLibrary", { count: PARTS.length }),
    t("sagaWatched", { count: PARTS.filter((p) => p.statuses.includes("watched")).length }),
  ].join(" · ");
  return (
    <SceneStage cycle={cycle}>
      <Place x={ROW.x} y={40} w={530}>
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 h-4 w-[3px] rounded-full" style={{ background: "linear-gradient(180deg, var(--brand), var(--brand-accent))" }} />
            <p className="text-[15px] font-bold tracking-tight text-content-primary">{t("sagaFallbackTitle")}</p>
          </div>
          <p className="truncate text-[10px] text-content-tertiary">{summary}</p>
        </div>
      </Place>
      {PARTS.map((part, i) => {
        const current = part.cue === "current";
        return (
          <Place key={i} x={colX(i)} y={ROW.y} w={ROW.w} visible={step >= 0} transition={sceneTween}>
            <div className={current ? "rounded-xl ring-2 ring-[rgba(var(--brand-rgb),0.75)] ring-offset-2 ring-offset-surface-0" : ""}>
              <FauxMarkedCard
                x={0}
                y={0}
                w={ROW.w}
                poster={posterAt(media, POSTER_OFFSET + i)}
                tone={i}
                userScore={part.userScore}
                statuses={part.statuses}
                hovered={i === NEXT && hovered}
                hoverable={i === NEXT}
              />
              <div className="aspect-[2/3]" aria-hidden />
            </div>
            <p className="mt-1.5 truncate px-0.5 text-[10px] font-medium text-content-tertiary">
              {t("sagaPart", { position: i + 1 })}
              {part.cue && (
                <>
                  <span aria-hidden> · </span>
                  <span className="font-semibold text-brand-light">{t(part.cue === "current" ? "sagaCurrent" : "sagaUpNext")}</span>
                </>
              )}
            </p>
          </Place>
        );
      })}
      <FauxCursor x={cursor.x} y={cursor.y} pressed={step === 3} hidden={step === 0 || step >= 4} reduced={reduced} />
    </SceneStage>
  );
}
