import type { Transition } from "framer-motion";
import { useTranslation } from "react-i18next";
import { easeOut } from "../../../theme/motion";
import type { SceneProps } from "../../types";
import { useSceneMedia } from "../../sceneMedia";
import { FauxCard, FauxCursor, Place, SceneStage, useSceneClock } from "..";
import { FauxTrailerPreview } from "./FauxTrailerPreview";
import { otherPoster, sceneTrailer } from "./previewSceneMedia";
import {
  HOVERED, NEIGHBOR_SHIFT, NEXT_ROW_Y, POSTER, POSTERS_Y, POSTER_COUNT, PREVIEW_FROM_SCALE, PREVIEW_RECT, ROW, actionCenter, posterX,
} from "./previewSceneGeometry";

/**
 * Le pointeur arrive, s'ARRÊTE sur l'affiche (le délai de l'app), la mini-carte
 * grandit sur l'image du titre, la vidéo part, un plan change, « Ma liste » se
 * coche, et l'aperçu reste à l'écran.
 */
const STEPS = [700, 1000, 650, 1150, 950, 380, 1700] as const;
const HOVER = 1;
const OPEN = 2;
const PLAYING = 3;
const AIM = 4;
const CLICK = 5;
/** L'entrée de la mini-carte : la taille en décélération, l'opacité en fondu court — le tempo de l'app. */
const GROW: Transition = { scale: { duration: 0.34, ease: easeOut }, opacity: { duration: 0.14, ease: "linear" } };
const MAKE_ROOM: Transition = { duration: 0.34, ease: easeOut };
/** Le pointeur se pose dans le haut de l'affiche : il tombera sur la VIDÉO de la mini-carte, pas sur ses boutons. */
const CURSOR_REST = { x: posterX(HOVERED) + 56, y: POSTERS_Y + 46 };

/**
 * L'aperçu de bande-annonce au survol : une rangée de VRAIES affiches, le
 * pointeur qui s'y pose, puis la mini-carte qui grandit DEPUIS l'affiche —
 * l'image du titre d'abord, puis la vidéo et ses plans — pendant que les
 * voisines s'écartent ; dessous, le bandeau qui monte d'un bloc (les actions,
 * le titre et ses étoiles, l'année et la durée, les genres), le son en haut à
 * droite. Le titre survolé est celui du bandeau de l'accueil : son logo, ses
 * genres et ses décors viennent de sa fiche.
 */
export function TrailerPreviewScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["reco", "common"]);
  const media = useSceneMedia();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const trailer = sceneTrailer(media);
  const open = step >= OPEN;
  const shot = step < PLAYING ? -1 : step - PLAYING;
  const aim = actionCenter(1);

  return (
    <SceneStage cycle={cycle}>
      <Place x={ROW.x} y={ROW.y} w={400}>
        <span className="text-[15px] font-semibold tracking-tight text-content-primary">{t("reco:rowForYouMovies")}</span>
      </Place>
      {Array.from({ length: POSTER_COUNT }, (_, i) => {
        const hovered = i === HOVERED;
        const shift = !open || hovered || reduced ? 0 : i < HOVERED ? -NEIGHBOR_SHIFT : NEIGHBOR_SHIFT;
        return (
          <FauxCard
            key={i}
            x={posterX(i)}
            y={POSTERS_Y}
            w={POSTER.w}
            poster={hovered ? trailer.poster : otherPoster(media, trailer.poster, i)}
            tone={i}
            hovered={hovered && step >= HOVER}
            visible={!(hovered && open)}
            dx={shift}
            transition={hovered ? { duration: 0.14, ease: "linear" } : MAKE_ROOM}
          />
        );
      })}
      <Place x={ROW.x} y={NEXT_ROW_Y} w={400}>
        <span className="text-[15px] font-semibold tracking-tight text-content-primary">{t("common:latestAdditionsShort")}</span>
      </Place>
      {Array.from({ length: POSTER_COUNT }, (_, i) => (
        <FauxCard key={`next-${i}`} x={posterX(i)} y={NEXT_ROW_Y + 26} w={POSTER.w} poster={otherPoster(media, trailer.poster, i + POSTER_COUNT)} tone={i + 2} />
      ))}
      <FauxTrailerPreview
        x={PREVIEW_RECT.x}
        y={PREVIEW_RECT.y}
        trailer={trailer}
        shot={shot}
        settled={open}
        listed={step >= CLICK}
        visible={open}
        scale={open ? 1 : PREVIEW_FROM_SCALE}
        transition={GROW}
      />
      <FauxCursor
        x={step >= AIM ? aim.x : step >= HOVER ? CURSOR_REST.x : 560}
        y={step >= AIM ? aim.y : step >= HOVER ? CURSOR_REST.y : 330}
        pressed={step === CLICK}
        reduced={reduced}
      />
    </SceneStage>
  );
}
