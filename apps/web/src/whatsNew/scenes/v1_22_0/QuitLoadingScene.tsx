import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import { CARD_TONES, FauxCard, FauxChip, FauxCursor, Place, SceneStage, STAGE_H, STAGE_W, sceneTween, useSceneClock } from "..";

const STEPS = [800, 650, 1300, 700, 550] as const;
const PLAY = { x: 216, y: 160 } as const;
/** « Retour », au coin haut-gauche — là où l'écran de chargement le pose. */
const BACK = { x: 16, y: 16, h: 32 } as const;
const TRACK = { x: 40, y: 318, w: 560 } as const;
const SEGMENT_W = TRACK.w / 4;
/** La course du segment de la barre, pas après pas. */
const SWEEP = [0, 0, 0.55, 0.85, 1] as const;

/**
 * « Retour » dès l'écran de chargement : la fiche, « Lecture », un
 * chargement qui traîne — et le bouton qui ramène sans attendre. La boucle se
 * referme sur la fiche : c'est le retour. En mouvement réduit, l'image finale
 * est le clic sur « Retour ».
 */
export function QuitLoadingScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const media = useSceneMedia();
  // Le fond du chargement et l'affiche de la fiche : la même œuvre.
  const poster = posterAt(media, 0);
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const loading = step >= 2;
  const aimBack = step >= 3;
  const title = media.backdrop?.title ?? poster?.title ?? t("whatsNew:sceneNowPlaying");
  const cursor = aimBack ? { x: BACK.x + 44, y: BACK.y + 18 } : step >= 1 ? { x: PLAY.x + 42, y: PLAY.y + 14 } : { x: 470, y: 300 };
  return (
    <SceneStage cycle={cycle}>
      {/* La fiche, isolée : le badge de note de la carte a son propre
          `z-index`, qui passerait sinon par-dessus l'écran de chargement. */}
      <div className="absolute inset-0 isolate">
        <FauxCard x={56} y={66} w={132} poster={poster} />
        <Place x={216} y={88} w={380}>
          <p className="truncate text-[24px] font-bold tracking-tight text-content-primary">{title}</p>
          {poster?.year != null && <p className="mt-1 text-[13px] text-content-tertiary">{poster.year}</p>}
        </Place>
        <FauxChip x={PLAY.x} y={PLAY.y} label={t("common:play")} icon="play" variant="primary" />
      </div>

      <Place x={0} y={0} w={STAGE_W} h={STAGE_H} visible={loading}>
        {media.backdrop ? (
          <img src={media.backdrop.url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: CARD_TONES[1] }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/35" />
        <div
          className="absolute flex items-center gap-1.5 overflow-hidden rounded-full border border-white/20 bg-black/45 pl-2.5 pr-3.5 text-[12px] font-semibold text-white"
          style={{ left: BACK.x, top: BACK.y, height: BACK.h }}
        >
          {/* Le survol de l'app (`hover:bg-black/70`), en fondu d'opacité. */}
          <motion.span className="absolute inset-0 bg-black/40" initial={false} animate={{ opacity: aimBack ? 1 : 0 }} transition={sceneTween} />
          <svg className="relative h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="relative">{t("player:back")}</span>
        </div>
        <p className="absolute left-10 top-[270px] max-w-[560px] truncate text-[22px] font-bold tracking-tight text-white">{title}</p>
        <div className="absolute overflow-hidden rounded-full bg-white/10" style={{ left: TRACK.x, top: TRACK.y, width: TRACK.w, height: 3 }}>
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-transparent via-[var(--brand-light)] to-transparent"
            style={{ width: SEGMENT_W }}
            initial={false}
            animate={{ x: SWEEP[step] * (TRACK.w - SEGMENT_W) }}
            transition={{ duration: 1.2, ease: "linear" }}
          />
        </div>
      </Place>

      <FauxCursor x={cursor.x} y={cursor.y} pressed={step === 2 || step === 4} reduced={reduced} />
    </SceneStage>
  );
}
