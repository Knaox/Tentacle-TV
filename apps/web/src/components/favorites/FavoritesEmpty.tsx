import { memo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { Heart, Layers, Share2 } from "lucide-react";
import { fadeUp, textCascade } from "../../theme/motion";

const STEPS = [
  { icon: Heart, key: "emptyStepLike" },
  { icon: Layers, key: "emptyStepGroup" },
  { icon: Share2, key: "emptyStepShare" },
] as const;

/**
 * Mes favoris, VIDE — la liste n'a encore jamais rien reçu.
 *
 * Un emblème (cœur sur halo de marque, statique : rien n'y tourne en boucle),
 * ce que la page fera une fois remplie en trois étapes, et deux sorties :
 * le catalogue (appel principal, `cta-primary` comme `LibraryGridEmpty`, que
 * le moteur de focus du téléviseur reconnaît) et les recommandations.
 * Une liste filtrée à zéro n'arrive jamais ici : elle a son propre message.
 * `extra` garde le partage : le lien public montre aussi les likes du
 * catalogue, il a un sens même quand cette liste-ci est vide.
 */
export const FavoritesEmpty = memo(function FavoritesEmpty({ extra }: { extra?: ReactNode }) {
  const { t } = useTranslation("favorites");
  const navigate = useNavigate();
  const reduced = useReducedMotion();

  return (
    <motion.section
      className="mx-auto flex max-w-2xl flex-col items-center px-4 pb-24 pt-10 text-center md:pt-16"
      variants={reduced ? undefined : textCascade}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={reduced ? undefined : fadeUp} className="relative mb-8 flex h-28 w-28 items-center justify-center">
        <span
          aria-hidden
          className="absolute -inset-6 rounded-full opacity-80"
          style={{ background: "radial-gradient(circle, rgba(var(--brand-accent-rgb),0.45) 0%, rgba(var(--brand-rgb),0.25) 45%, transparent 70%)" }}
        />
        <span
          aria-hidden
          className="relative flex h-20 w-20 items-center justify-center rounded-[28px] border border-[rgba(var(--brand-rgb),0.35)]"
          style={{ background: "linear-gradient(135deg, rgba(var(--brand-rgb),0.28), rgba(var(--brand-accent-rgb),0.22))" }}
        >
          <Heart size={36} strokeWidth={1.8} className="text-[var(--brand-light)]" fill="currentColor" fillOpacity={0.25} />
        </span>
      </motion.div>

      <motion.h2 variants={reduced ? undefined : fadeUp} className="text-2xl font-bold tracking-[-0.3px] text-content-primary md:text-3xl">
        {t("emptyTitle")}
      </motion.h2>
      <motion.p variants={reduced ? undefined : fadeUp} className="mt-3 max-w-md text-[15px] leading-relaxed text-content-tertiary">
        {t("emptyBody")}
      </motion.p>

      <motion.ol variants={reduced ? undefined : fadeUp} className="mt-8 grid w-full gap-2 sm:grid-cols-3 sm:gap-3">
        {STEPS.map(({ icon: Icon, key }, i) => (
          <li key={key} className="flex items-center gap-3 rounded-2xl border border-line-subtle bg-fill-subtle px-4 py-3 text-left sm:flex-col sm:items-start sm:gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[rgba(var(--brand-rgb),0.14)] text-[var(--brand-light)]">
              <Icon size={16} aria-hidden />
            </span>
            <span className="text-sm text-content-secondary">
              <span className="mr-1 font-semibold tabular-nums text-content-quaternary">{i + 1}.</span>
              {t(key)}
            </span>
          </li>
        ))}
      </motion.ol>

      <motion.div variants={reduced ? undefined : fadeUp} className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="inline-flex h-11 cursor-pointer items-center justify-center rounded-full border border-cta-primary-border bg-cta-primary-bg px-7 text-sm font-bold text-cta-primary-fg transition-colors duration-150 hover:bg-cta-primary-bg-hover"
        >
          {t("emptyBrowse")}
        </button>
        <button
          type="button"
          onClick={() => navigate("/recommendations")}
          className="inline-flex h-11 cursor-pointer items-center justify-center rounded-full border border-line-subtle bg-fill-subtle px-6 text-sm font-semibold text-content-secondary transition-colors duration-150 hover:text-content-primary"
        >
          {t("emptyForYou")}
        </button>
      </motion.div>
      {extra && <motion.div variants={reduced ? undefined : fadeUp} className="mt-6">{extra}</motion.div>}
    </motion.section>
  );
});
