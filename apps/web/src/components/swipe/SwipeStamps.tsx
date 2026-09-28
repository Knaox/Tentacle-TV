import { motion, useTransform, type MotionValue } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Heart, SkipForward, Star, X } from "lucide-react";
import { stampStrength } from "@tentacle-tv/api-client";
import type { SwipeVerdict } from "@tentacle-tv/api-client";

interface SwipeStampsProps {
  x: MotionValue<number>;
  y: MotionValue<number>;
}

/** L'opacité d'un tampon suit la règle du verdict (`stampStrength`) : un seul
 *  s'allume, celui de l'axe qui domine, et il est plein quand le lâcher
 *  jugera — ce que le tampon dit est ce que le geste fera. */
function useStamp(x: MotionValue<number>, y: MotionValue<number>, verdict: SwipeVerdict) {
  return useTransform([x, y] as MotionValue<number>[], ([dx, dy]: number[]) => stampStrength(verdict, dx, dy));
}

/**
 * Les tampons qui disent, pendant le glisser, ce que le geste va décider.
 * Leur opacité suit la position de la carte (opacity seule : rien n'est
 * repeint) ; une icône double la couleur — le sens ne tient jamais à elle.
 * « Passer » s'affiche en haut : la carte tirée vers le bas y reste visible.
 */
export function SwipeStamps({ x, y }: SwipeStampsProps) {
  const { t } = useTranslation("swipe");
  const like = useStamp(x, y, "like");
  const nope = useStamp(x, y, "dislike");
  const love = useStamp(x, y, "superlike");
  const skip = useStamp(x, y, "skip");

  const base =
    "pointer-events-none absolute z-20 inline-flex items-center gap-2 rounded-xl border-[3px] px-3 py-1.5 text-xl font-extrabold uppercase tracking-wider shadow-lg";
  return (
    <>
      <motion.div style={{ opacity: like }} className={`${base} left-6 top-8 -rotate-12 border-emerald-400 bg-black/55 text-emerald-300`}>
        <Heart size={20} className="fill-current" aria-hidden />
        {t("stampLike")}
      </motion.div>
      <motion.div style={{ opacity: nope }} className={`${base} right-6 top-8 rotate-12 border-rose-400 bg-black/55 text-rose-300`}>
        <X size={20} strokeWidth={3} aria-hidden />
        {t("stampNope")}
      </motion.div>
      <motion.div
        style={{ opacity: love }}
        className={`${base} bottom-40 left-1/2 -translate-x-1/2 border-fuchsia-400 bg-black/55 text-fuchsia-200`}
      >
        <Star size={20} className="fill-current" aria-hidden />
        {t("stampSuper")}
      </motion.div>
      <motion.div
        style={{ opacity: skip }}
        className={`${base} left-1/2 top-8 -translate-x-1/2 border-slate-300 bg-black/55 text-slate-100`}
      >
        <SkipForward size={20} aria-hidden />
        {t("stampSkip")}
      </motion.div>
    </>
  );
}
