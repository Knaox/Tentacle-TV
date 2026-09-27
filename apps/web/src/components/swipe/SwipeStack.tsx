import { AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { recoPosterUrl, useJellyfinClient } from "@tentacle-tv/api-client";
import type { SwipeCard, SwipeCardDetails, SwipeVerdict } from "@tentacle-tv/api-client";
import { SwipeStackCard } from "./SwipeStackCard";

/** Cartes rendues : celle du dessus et deux en attente (leurs affiches se
 *  chargent d'avance). Au-delà, rien n'est monté. */
const VISIBLE = 3;

/** Largeur de la carte : bornée par l'écran ET par la hauteur disponible
 *  (barres, en-tête, boutons et aide y tiennent sans défilement), avec un
 *  plancher pour les fenêtres très basses. `--swipe-chrome` est la hauteur
 *  de tout ce qui n'est pas la carte — posée par la page, selon la largeur. */
export const CARD_WIDTH = "max(13rem, min(22rem, 86vw, calc((100dvh - var(--swipe-chrome, 24rem)) * 2 / 3)))";

interface SwipeStackProps {
  cards: SwipeCard[];
  /** Verdict de la dernière carte partie : il oriente sa sortie. */
  exitVerdict: SwipeVerdict | null;
  infoOpen: boolean;
  details: SwipeCardDetails | undefined;
  onJudge: (verdict: SwipeVerdict) => void;
  onToggleInfo: () => void;
}

export function SwipeStack({ cards, exitVerdict, infoOpen, details, onJudge, onToggleInfo }: SwipeStackProps) {
  const { t } = useTranslation("swipe");
  const client = useJellyfinClient();
  const reduced = useReducedMotion() ?? false;
  const shown = cards.slice(0, VISIBLE);

  return (
    <div className="relative mx-auto aspect-[2/3]" style={{ width: CARD_WIDTH }}>
      <AnimatePresence initial={false} custom={exitVerdict}>
        {shown
          .map((card, depth) => (
            <SwipeStackCard
              key={card.key}
              card={card}
              depth={depth}
              posterUrl={recoPosterUrl(
                card,
                (id) => client.getImageUrl(id, "Primary", { height: 900, quality: 85 }),
                "w500"
              )}
              reducedMotion={reduced}
              infoOpen={infoOpen}
              details={depth === 0 ? details : undefined}
              label={card.year ? t("cardLabel", { title: card.title, year: card.year }) : card.title}
              onJudge={onJudge}
              onToggleInfo={onToggleInfo}
            />
          ))
          .reverse()}
      </AnimatePresence>
    </div>
  );
}
