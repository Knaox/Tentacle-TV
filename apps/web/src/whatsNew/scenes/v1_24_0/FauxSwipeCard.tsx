import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Check, Heart, Star } from "lucide-react";
import type { ScenePoster } from "../../sceneMedia";
import { CARD_TONES } from "../FauxCard";
import { sceneSpring } from "../sceneMotion";

/** Où est la carte : dans la pile (profondeur), en train d'être glissée, ou partie. */
export type SwipePose =
  | { kind: "stack"; depth: number }
  | { kind: "drag" }
  | { kind: "gone"; verdict: "like" | "superlike" };

const BOX = { x: 260, y: 66, w: 120, h: 180 } as const;

function target(pose: SwipePose) {
  if (pose.kind === "drag") return { x: 64, y: -4, rotate: 4, scale: 1, opacity: 1 };
  if (pose.kind === "gone") {
    return pose.verdict === "like"
      ? { x: 420, y: 20, rotate: 14, scale: 1, opacity: 0 }
      : { x: 0, y: -320, rotate: 0, scale: 1, opacity: 0 };
  }
  // La pile : un peu plus petites et plus bas ; au-delà de trois, rien n'est monté chez l'app.
  return { x: 0, y: pose.depth * 12, rotate: 0, scale: 1 - pose.depth * 0.05, opacity: pose.depth <= 2 ? 1 : 0 };
}

/**
 * Une carte de la pile « Affiner » (`SwipeStackCard` + `SwipeCardFace` +
 * `SwipeCardRecto`) : l'affiche, puis sur un dégradé le titre, le format et la
 * présence en bibliothèque. Glissée à droite, le tampon « J'aime » paraît ;
 * tout mouvement est en `transform` et en opacité.
 */
export function FauxSwipeCard({ poster, tone, pose }: { poster: ScenePoster | null; tone: number; pose: SwipePose }) {
  const { t } = useTranslation("swipe");
  const depth = pose.kind === "stack" ? pose.depth : 0;
  const format = [t("movie"), poster?.year ? String(poster.year) : null].filter(Boolean).join(" · ");
  return (
    <motion.div
      className="absolute overflow-hidden rounded-[14px] border border-white/10 bg-surface-2 shadow-[0_14px_36px_-12px_rgba(0,0,0,0.8)]"
      style={{ left: BOX.x, top: BOX.y, width: BOX.w, height: BOX.h, zIndex: 10 - depth }}
      initial={false}
      animate={target(pose)}
      transition={pose.kind === "gone" ? { duration: 0.32, ease: [0.4, 0, 1, 1] } : sceneSpring}
    >
      {poster ? (
        <img src={poster.url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: CARD_TONES[tone % CARD_TONES.length] }} />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2.5 pb-2.5 pt-10 text-white">
        <p className="line-clamp-2 text-[12px] font-bold leading-tight">{poster?.title ?? " "}</p>
        <p className="mt-0.5 text-[8px] text-white/80">{format}</p>
        <p className="mt-1.5 inline-flex items-center gap-1 text-[8px] font-medium text-white/85">
          <Check size={9} aria-hidden />
          {t("inLibrary")}
        </p>
      </div>
      {poster?.rating != null && poster.rating > 0 && (
        <span className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-full border border-white/25 bg-black/65 px-1.5 py-0.5 text-[8px] font-semibold tabular-nums text-white">
          <Star size={8} className="fill-current text-amber-300" aria-hidden />
          {poster.rating.toFixed(1)}
        </span>
      )}
      <motion.span
        className="absolute left-3 top-4 inline-flex -rotate-12 items-center gap-1 rounded-lg border-2 border-emerald-400 bg-black/55 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300"
        initial={false}
        animate={{ opacity: pose.kind === "drag" ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <Heart size={10} className="fill-current" aria-hidden />
        {t("stampLike")}
      </motion.span>
    </motion.div>
  );
}
