import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { fadeUp, textCascade } from "../../theme/motion";

/** Un nombre de l'en-tête : « 1 284 titres », « 212 non vus ». Déjà formaté et traduit. */
export interface BannerStat {
  key: string;
  label: string;
}

interface BannerHeadingProps {
  /** Sur-titre : « Bibliothèques », « Ma liste » — déjà traduit. */
  kicker: string;
  title: string;
  /** Les nombres de la page, dans l'ordre ; le premier est le total, écrit en clair. */
  stats?: readonly BannerStat[];
  /** Une ligne libre à la place des nombres (compte déjà rédigé par l'appelant). */
  subtitle?: ReactNode;
}

/**
 * Le bloc titre d'une bannière de catalogue — bibliothèque, Ma liste, Mes favoris : le
 * sur-titre, le nom en Bricolage, et SES NOMBRES sur une ligne. Une page qui dit d'emblée
 * combien elle contient a de la tenue ; le prototype sans chiffres paraissait vide.
 *
 * Tout est posé sur l'image : jetons `on-media`, identiques dans les deux thèmes. Plus de
 * barre dégradée ni de lueur devant le sur-titre — le dégradé ne sert qu'à lire et à mesurer.
 *
 * ⚠️ `bottom-[18%]` et `titre-bibliotheque` sont lus par la feuille du client LG
 * (`library-tv.css`, `tv.css`) : ces deux classes ne se renomment pas.
 */
export function BannerHeading({ kicker, title, stats, subtitle }: BannerHeadingProps) {
  const reduced = useReducedMotion();
  const line = reduced ? undefined : fadeUp;
  const [total, ...others] = stats ?? [];

  return (
    <motion.div
      className="absolute inset-x-0 bottom-[18%] z-10 px-4 sm:px-8 md:px-14"
      variants={reduced ? undefined : textCascade}
      initial="hidden"
      animate="show"
    >
      {/* L'assise du bloc, en thème CLAIR seulement (`--banner-heading-focus`, theme/scrims.css) : derrière le
          texte, devant l'image. Absente ailleurs (`hidden`) : aucune couche de plus en sombre ni sur le téléviseur. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-y-20 left-0 -z-10 hidden w-[min(52rem,78%)] [[data-theme=light]_&]:block"
        style={{ background: "var(--banner-heading-focus)" }}
      />
      <motion.span variants={line} className="mb-2.5 block text-xs font-semibold uppercase tracking-[0.06em] text-on-media-secondary">
        {kicker}
      </motion.span>

      <motion.h1 variants={line} className="titre-bibliotheque font-bold text-on-media-primary drop-shadow-[0_3px_14px_var(--on-media-shadow)]">
        {title}
      </motion.h1>

      {total && (
        <motion.p variants={line} className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-sm tabular-nums text-on-media-secondary">
          <span className="text-[15px] font-semibold text-on-media-primary">{total.label}</span>
          {others.map((stat) => (
            <span key={stat.key} className="inline-flex items-baseline gap-2.5">
              <span aria-hidden className="text-on-media-muted">·</span>
              {stat.label}
            </span>
          ))}
        </motion.p>
      )}

      {subtitle && !total && (
        <motion.p variants={line} className="mt-3 text-sm font-medium tabular-nums text-on-media-secondary">
          {subtitle}
        </motion.p>
      )}
    </motion.div>
  );
}
