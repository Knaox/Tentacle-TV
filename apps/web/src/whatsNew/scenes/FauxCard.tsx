import { motion, type Transition } from "framer-motion";
import type { ReactNode } from "react";
import { CardFrame } from "../../components/cards/CardFrame";
import { CardImage } from "../../components/cards/CardImage";
import { CardProgressBar } from "../../components/cards/CardProgressBar";
import { CardRatingBadge } from "../../components/cards/CardRatingBadge";
import type { ScenePoster } from "../sceneMedia";
import { Place, type Animated, type Placed } from "./Place";
import { sceneTween } from "./sceneMotion";

interface FauxCardProps extends Placed, Animated {
  /** Une vraie affiche de la bibliothèque ; sans donnée, un dégradé de jetons. */
  poster?: ScenePoster | null;
  tone?: number;
  /** Survolée : la vraie levée de `.media-tile` (transform, ombres en fondu d'opacité). */
  hovered?: boolean;
  /** En retrait (filtrée) : opacité réduite, toujours en place. */
  dimmed?: boolean;
  /** Bloc titre + année sous l'affiche, comme sur l'accueil. */
  showTitle?: boolean;
  /** 0..100 ; par défaut la reprise de l'affiche. */
  progress?: number | null;
  transition?: Transition;
  /** Surimpression (étoiles, pastille Lecture, voile). */
  children?: ReactNode;
}

/** Repli sans donnée : des dégradés tirés des jetons, jamais une image inventée. */
export const CARD_TONES = [
  "linear-gradient(160deg, var(--brand) 0%, var(--brand-accent) 100%)",
  "linear-gradient(160deg, var(--brand-dark) 0%, var(--brand) 100%)",
  "linear-gradient(160deg, var(--brand-accent) 0%, var(--brand-accent-light) 100%)",
  "linear-gradient(160deg, var(--fill-strong) 0%, var(--fill-medium) 100%)",
  "linear-gradient(160deg, rgba(var(--brand-rgb), 0.55) 0%, var(--fill-strong) 100%)",
  "linear-gradient(160deg, rgba(var(--brand-accent-rgb), 0.5) 0%, var(--fill-medium) 100%)",
];

/**
 * LA carte de l'accueil, telle quelle : `CardFrame` (levée `.media-tile`),
 * `CardImage`, badge de note, barre de progression et le bloc titre de
 * `PosterCard`. Seule différence : elle ne réagit à rien — c'est la scène
 * qui la « survole ».
 */
export function FauxCard({
  poster = null, tone = 0, hovered = false, dimmed = false, showTitle = false, progress, transition,
  w = 72, children, ...place
}: FauxCardProps) {
  return (
    <Place {...place} w={w} transition={transition}>
      <motion.div className="group/card" initial={false} animate={{ opacity: dimmed ? 0.3 : 1 }} transition={sceneTween}>
        <CardFrame hovered={hovered} aspect="aspect-[2/3]">
          {poster ? (
            <CardImage src={poster.url} alt="" />
          ) : (
            <div className="h-full w-full" style={{ background: CARD_TONES[tone % CARD_TONES.length] }} />
          )}
          {poster && <CardRatingBadge rating={poster.rating} />}
          <CardProgressBar percent={progress ?? poster?.progress} />
          {children && <div className="absolute inset-0 z-20">{children}</div>}
        </CardFrame>
        {showTitle && (
          <div className="mt-2.5 px-0.5">
            {poster ? (
              <>
                <h3 className="truncate text-sm font-semibold tracking-tight text-content-primary">{poster.title}</h3>
                <p className="mt-0.5 text-xs text-content-quaternary">{poster.year ?? " "}</p>
              </>
            ) : (
              <>
                <span className="block h-3 w-3/4 rounded bg-fill-medium" />
                <span className="mt-1.5 block h-2.5 w-1/3 rounded bg-fill-soft" />
              </>
            )}
          </div>
        )}
      </motion.div>
    </Place>
  );
}
