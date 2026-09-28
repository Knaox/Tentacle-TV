import { motion, useTransform, type MotionValue } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Heart, Star, X } from "lucide-react";

interface SwipeStampsProps {
  x: MotionValue<number>;
  y: MotionValue<number>;
}

/**
 * Les tampons qui disent, pendant le glisser, ce que le geste va décider.
 * Leur opacité suit la position de la carte (opacity seule : rien n'est
 * repeint) ; une icône double la couleur — le sens ne tient jamais à elle.
 */
export function SwipeStamps({ x, y }: SwipeStampsProps) {
  const { t } = useTranslation("swipe");
  const like = useTransform(x, [24, 110], [0, 1]);
  const nope = useTransform(x, [-110, -24], [1, 0]);
  const loveFromY = useTransform(y, [-120, -30], [1, 0]);
  // Le coup de cœur ne s'allume que si le haut domine (cf. verdictFromDrag).
  const love = useTransform([loveFromY, x] as MotionValue<number>[], ([o, dx]: number[]) =>
    Math.abs(dx) > 80 ? 0 : o
  );

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
    </>
  );
}
