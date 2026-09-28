import type { SceneProps } from "../../types";
import { FauxCursor, SceneStage, useSceneClock } from "..";
import { FauxDetailStage, FauxStageButton } from "./FauxDetailStage";
import { FauxImageViewer } from "./FauxImageViewer";
import { useFauxDetail } from "./useFauxDetail";

const STEPS = [600, 700, 1200, 700, 300, 1000, 300, 1900] as const;
const IMAGES_BUTTON = { x: 594, y: 16 } as const;
const THUMB = { w: 48, gap: 6, y: 334 } as const;

/** Le centre de la vignette `index` d'une pellicule de `count` images, centrée. */
function thumbCenter(index: number, count: number): { x: number; y: number } {
  const width = count * THUMB.w + (count - 1) * THUMB.gap;
  return { x: 320 - width / 2 + index * (THUMB.w + THUMB.gap) + THUMB.w / 2, y: THUMB.y };
}

/**
 * La fiche en scène : le décor sur tout le cadre, puis le logo du titre, la
 * note en grand avec ses marqueurs, « Reprendre » au dégradé avec son anneau
 * et le temps restant, la capsule des bascules. Le curseur ouvre « Voir les
 * images » : la visionneuse plein écran, puis l'image suivante.
 */
export function DetailStageScene({ active, reduced }: SceneProps) {
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const data = useFauxDetail();
  const count = data.gallery.length;
  const viewer = step >= 5;
  const browse = count > 1;
  const index = browse && step >= 7 ? 1 : 0;
  const cursor = step >= 5 ? thumbCenter(1, count) : step >= 3 ? { x: IMAGES_BUTTON.x + 14, y: IMAGES_BUTTON.y + 14 } : { x: 560, y: 330 };
  return (
    <SceneStage cycle={cycle}>
      <FauxDetailStage data={data} logo={step >= 1} meta={step >= 2} />
      <FauxStageButton x={IMAGES_BUTTON.x} y={IMAGES_BUTTON.y} icon={<ImagesIcon />} />
      {/* Monté pour de bon dès qu'il y a une image : c'est l'opacité qui l'ouvre. */}
      {count > 0 && <FauxImageViewer visible={viewer} title={data.title} gallery={data.gallery} index={index} />}
      <FauxCursor
        x={cursor.x}
        y={cursor.y}
        pressed={step === 4 || (browse && step === 6)}
        hidden={step >= 7 || (step >= 5 && !browse)}
        reduced={reduced}
      />
    </SceneStage>
  );
}

function ImagesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <path d="M8 15l2.5-3 2 2.2L15 11l2 4H8z" />
    </svg>
  );
}
