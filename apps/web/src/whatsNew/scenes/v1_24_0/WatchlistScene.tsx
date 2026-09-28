import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import { FauxCard, FauxCursor, Place, SceneStage, sceneSpring, sceneTween, useSceneClock } from "..";
import { FauxCollectionPanel, PANEL, VIEW_TOGGLE } from "./FauxCollectionPanel";
import { FauxResumeTile, FauxUndoToast, FauxWatchlistRow } from "./FauxWatchlistPieces";

const STEPS = [1100, 700, 300, 800, 300, 900, 300, 1600] as const;
// L'écart de 10 px est une classe (`gap-[10px]`) : la passe webOS l'émule, pas un `gap` en ligne.
const SHELF = { y: 128, tileW: 128 } as const;
const BODY_Y = 234;
const ROW = { h: 46, gap: 6 } as const;
const TOAST = { x: 170, y: 316, w: 300 } as const;
/** Un compte de scène : la liste a douze titres, dont trois en cours et quatre terminés. */
const COUNTS = [12, 5, 3, 4] as const;

/**
 * Ma liste, sœur de la Bibliothèque : le même panneau d'outils, les étapes de
 * visionnage, la file « Reprendre ». Le curseur passe en vue liste, retire un
 * titre d'un geste — la ligne s'en va, « Annuler » paraît — puis le rend.
 */
export function WatchlistScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["common", "watchlist"]);
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const media = useSceneMedia();
  const list = step >= 2;
  const removed = step >= 4 && step <= 6;
  const total = COUNTS[0] - (removed ? 1 : 0);
  const summary = [t("watchlist:statTotal", { count: total }), t("watchlist:statInProgress", { count: COUNTS[2] }), t("watchlist:statWatched", { count: COUNTS[3] })].join(" · ");
  const removeAim = { x: PANEL.x + PANEL.w - 21, y: BODY_Y + ROW.h / 2 };
  const cursor = step >= 5 ? { x: TOAST.x + TOAST.w - 72, y: TOAST.y + 18 }
    : step >= 3 ? removeAim
      : step >= 1 ? { x: VIEW_TOGGLE.x + VIEW_TOGGLE.cell * 1.5 + 3, y: VIEW_TOGGLE.y + 13 }
        : { x: 560, y: 330 };
  return (
    <SceneStage cycle={cycle}>
      <Place x={PANEL.x} y={10} w={PANEL.w}>
        <p className="flex items-baseline gap-2.5">
          <span className="text-[18px] font-bold tracking-tight text-content-primary">{t("common:myList")}</span>
          <span className="text-[10px] text-content-tertiary">{summary}</span>
        </p>
      </Place>
      <FauxCollectionPanel view={list ? "list" : "grid"} counts={[total, COUNTS[1], COUNTS[2], COUNTS[3]]} />
      <Place x={PANEL.x} y={SHELF.y} w={PANEL.w}>
        <p className="mb-1.5 flex items-baseline gap-2">
          <span className="text-[12px] font-bold text-content-primary">{t("watchlist:resumeTitle")}</span>
          <span className="text-[9px] text-content-tertiary">{t("watchlist:resumeHint")}</span>
        </p>
        <div className="flex gap-[10px]">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ width: SHELF.tileW }}><FauxResumeTile poster={posterAt(media, i)} tone={i} /></span>
          ))}
        </div>
      </Place>
      {Array.from({ length: 7 }, (_, i) => (
        <FauxCard key={i} x={PANEL.x + i * 82} y={BODY_Y} w={72} poster={posterAt(media, 4 + i)} tone={i} visible={!list} />
      ))}
      {[0, 1, 2, 3].map((i) => {
        const gone = i === 0 && removed;
        const lift = i > 0 && removed ? -(ROW.h + ROW.gap) : 0;
        return (
          <Place key={i} x={PANEL.x} y={BODY_Y + i * (ROW.h + ROW.gap)} w={PANEL.w} visible={list && !gone} dx={gone ? -24 : 0} dy={list ? lift : 8} transition={sceneSpring}>
            <FauxWatchlistRow poster={posterAt(media, 4 + i)} tone={i} />
          </Place>
        );
      })}
      <Place x={TOAST.x} y={TOAST.y} w={TOAST.w} visible={removed} dy={removed ? 0 : 12} transition={sceneTween} className="z-10">
        <FauxUndoToast title={posterAt(media, 4)?.title ?? t("common:myList")} />
      </Place>
      <FauxCursor x={cursor.x} y={cursor.y} pressed={step === 2 || step === 4 || step === 6} hidden={step >= 7} reduced={reduced} />
    </SceneStage>
  );
}
