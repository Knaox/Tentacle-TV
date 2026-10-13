import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { recoMatchOf, type RecoRowItem } from "@tentacle-tv/api-client";
import { formatDuration, type MediaItem } from "@tentacle-tv/shared";
import { HeroEyebrow } from "../../hero/HeroEyebrow";
import { StarIcon } from "../../icons/HeroIcons";
import { fadeUp, textCascade } from "../../../theme/motion";
import { SpotlightActions } from "./SpotlightActions";

interface SpotlightContentProps {
  item: RecoRowItem;
  media: MediaItem | undefined;
  /** LA raison, déjà en mots (recoItemReasonText) — rien quand le moteur ne dit rien. */
  reason: string | null;
  onOpenDetail: (e: MouseEvent<HTMLElement>) => void;
  onDismiss: () => void;
}

/**
 * Ce que la une dit, dans l'ordre où l'œil le cherche : POURQUOI (la raison,
 * en une phrase, et la correspondance quand le moteur s'y engage), QUOI (le
 * titre), COMMENT (année, durée, genres, note), DE QUOI ÇA PARLE (deux lignes
 * de synopsis, bibliothèque), puis les gestes. Posé sur les voiles noirs
 * constants du fond : tokens `on-media-*` dans les deux thèmes. La cascade
 * d'entrée rejoue à chaque titre mis à la une (un geste), jamais toute seule.
 */
export function SpotlightContent({ item, media, reason, onOpenDetail, onDismiss }: SpotlightContentProps) {
  const { t } = useTranslation("reco");
  const reduced = useReducedMotion();
  const match = recoMatchOf(item);
  const runtime = media ? formatDuration(media.RunTimeTicks) : null;
  const genres = media?.Genres?.slice(0, 2) ?? [];
  const rating = media?.CommunityRating ?? item.voteAverage;
  const meta = [item.year ?? media?.ProductionYear, runtime, genres.join(" · ")].filter(Boolean).join("  ·  ");
  const variants = reduced ? undefined : textCascade;
  const line = reduced ? undefined : fadeUp;

  return (
    <motion.div key={item.key} className="max-w-xl" variants={variants} initial="hidden" animate="show">
      <motion.div variants={line} className="mb-3.5 flex flex-wrap items-center gap-3">
        <HeroEyebrow label={t("spotlightKicker")} />
        {match !== null && (
          <span className="rounded-full bg-[rgba(var(--brand-rgb),0.9)] px-2.5 py-0.5 text-xs font-bold text-cta-brand-fg">
            {t("spotlightMatch", { match })}
          </span>
        )}
      </motion.div>

      {reason && (
        <motion.p
          variants={line}
          className="mb-2.5 flex items-start gap-2 text-base font-semibold text-on-media-primary drop-shadow-[0_1px_6px_var(--on-media-shadow)] md:text-lg"
        >
          <Sparkles size={18} aria-hidden className="mt-1 shrink-0 text-[var(--brand-accent-light)]" />
          <span>{reason}</span>
        </motion.p>
      )}

      <motion.h1
        variants={line}
        className="titre-banniere mb-3 line-clamp-2 break-words font-bold text-on-media-primary drop-shadow-[0_3px_12px_var(--on-media-shadow)]"
      >
        {item.title}
      </motion.h1>

      <motion.div variants={line} className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-on-media-secondary">
        {meta && <span>{meta}</span>}
        {rating != null && (
          <span className="flex items-center gap-1 font-semibold text-on-media-primary">
            <span aria-hidden className="text-[var(--brand-accent)]">
              <StarIcon />
            </span>
            {rating.toFixed(1)}
          </span>
        )}
        {!item.jellyfinItemId && (
          <span className="rounded-full border border-on-media-muted px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
            {t("onDemandBadge")}
          </span>
        )}
      </motion.div>

      {media?.Overview && (
        <motion.p variants={line} className="mb-5 line-clamp-2 max-w-lg text-sm leading-relaxed text-on-media-secondary">
          {media.Overview}
        </motion.p>
      )}

      <motion.div variants={line} className={media?.Overview ? undefined : "mt-2"}>
        <SpotlightActions item={item} media={media} onOpenDetail={onOpenDetail} onDismiss={onDismiss} />
      </motion.div>
    </motion.div>
  );
}
