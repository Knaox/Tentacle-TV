import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import {
  useDeleteRating,
  useItemRating,
  useRateItem,
  useSendRecoFeedback,
} from "@tentacle-tv/api-client";
import type { RatingIdentity, RecoRowItem } from "@tentacle-tv/api-client";
import { HeroEyebrow } from "../../hero/HeroEyebrow";
import { StarIcon } from "../../icons/HeroIcons";
import { StarRating } from "../../rating/StarRating";
import { useRecoNavigation } from "../../../lib/recoNavigation";
import { fadeUp, textCascade } from "../../../theme/motion";
import { reasonToText } from "../RecoReasonText";

interface RecoHeroContentProps {
  item: RecoRowItem;
  /** Rejoue la cascade d'entrée à chaque diapositive (cf. HeroContent). */
  animationKey: number;
}

/**
 * Bloc texte et actions d'une diapositive de recommandation. Posé sur les
 * scrims noirs constants du fond : tokens `on-media-*` dans les deux thèmes.
 * Le sur-titre porte la RAISON de la recommandation (« Parce que vous avez
 * aimé… ») — c'est l'identité du carrousel ; la notation rapide vit ici,
 * toujours montée (UN héros = un seul abonnement aux notes, rien à voir avec
 * le coût d'une grille de cartes).
 */
export function RecoHeroContent({ item, animationKey }: RecoHeroContentProps) {
  const { t, i18n } = useTranslation("reco");
  const reduced = useReducedMotion();
  const { open, canOpen } = useRecoNavigation();
  const feedback = useSendRecoFeedback();

  const identity: RatingIdentity = {
    mediaType: item.mediaType === "tv" ? "series" : "movie",
    tmdbId: item.tmdbId,
  };
  const rating = useItemRating(identity);
  const rate = useRateItem();
  const remove = useDeleteRating();

  // La première raison qui fait une phrase — sinon le libellé générique.
  const kicker = useMemo(() => {
    for (const reason of item.reasons) {
      const text = reasonToText(reason, t, i18n.language);
      if (text) return text;
    }
    return t("heroKicker");
  }, [item.reasons, t, i18n.language]);

  // Constantes de module (theme/motion) : un objet neuf rejouerait la cascade.
  const groupVariants = reduced ? undefined : textCascade;
  const itemVariants = reduced ? undefined : fadeUp;
  const openable = canOpen(item);

  return (
    <div className="absolute inset-x-0 bottom-[15%] z-10 px-4 sm:px-8 md:bottom-[18%] md:px-14 lg:bottom-[20%]">
      <motion.div
        key={animationKey}
        className="max-w-xl"
        variants={groupVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants} className="mb-3.5">
          <HeroEyebrow label={kicker} />
        </motion.div>

        <motion.h1
          variants={itemVariants}
          className="titre-banniere mb-3.5 font-bold text-on-media-primary drop-shadow-[0_3px_12px_var(--on-media-shadow)] line-clamp-2 break-words"
        >
          {item.title}
        </motion.h1>

        <motion.div
          variants={itemVariants}
          className="mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-on-media-secondary"
        >
          {item.year != null && <span>{item.year}</span>}
          {item.voteAverage != null && (
            <span className="flex items-center gap-1 font-semibold text-on-media-primary">
              {/* Étoile de MARQUE — jamais dorée. */}
              <span aria-hidden className="text-[var(--brand-accent)]">
                <StarIcon />
              </span>
              {item.voteAverage.toFixed(1)}
            </span>
          )}
          {!item.jellyfinItemId && (
            <span className="rounded-full border border-on-media-muted px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-on-media-secondary">
              {t("onDemandBadge")}
            </span>
          )}
        </motion.div>

        <motion.div variants={itemVariants} className="mb-6 flex items-center gap-2.5">
          <span className="text-sm text-on-media-secondary drop-shadow-[0_1px_4px_var(--on-media-shadow)]">
            {t("yourRating")}
          </span>
          <StarRating
            size="md"
            tone="onMedia"
            value={rating?.score ?? null}
            onRate={(score) =>
              rate.mutate({ ...identity, jellyfinItemId: item.jellyfinItemId ?? undefined, score })
            }
            onClear={() => remove.mutate(identity)}
          />
        </motion.div>

        <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-2.5">
          {openable && (
            <button
              type="button"
              onClick={() => open(item)}
              className="rounded-full border border-cta-primary-border bg-cta-primary-bg px-6 py-2.5 font-bold text-cta-primary-fg transition-colors hover:bg-cta-primary-bg-hover"
              style={{ boxShadow: "var(--elev-2)" }}
            >
              {item.jellyfinItemId ? t("heroOpenDetail") : t("heroOpenVigie")}
            </button>
          )}
          <button
            type="button"
            onClick={() => feedback.mutate({ itemKey: item.key, action: "dismissed" })}
            className="rounded-full border border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.42)] px-4 py-2 text-sm text-on-media-primary transition-colors hover:bg-[rgba(var(--scrim-media-rgb),0.62)]"
          >
            {t("dismissAction")}
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
