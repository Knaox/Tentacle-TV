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

/**
 * L'empilement suit l'ordre d'ARRIVÉE des cartes, jamais leur place dans le
 * DOM : la plus ancienne est dessus — en tête de pile comme en partance.
 * AnimatePresence réinsère une carte qui part à son ancien rang ; à z-index
 * égal, elle passait sous la suivante. Le rang est gardé hors de React, par
 * objet : les cartes de la file sont stables (celle que rend « annuler » est
 * le même objet), une carte neuve prend le rang suivant. Le conteneur isole
 * ces z-index du reste de la page.
 */
const arrival = new WeakMap<SwipeCard, number>();
let nextArrival = 0;
const TOP_Z = 1_000_000;
function stackZ(card: SwipeCard): number {
  let rank = arrival.get(card);
  if (rank === undefined) {
    rank = nextArrival++;
    arrival.set(card, rank);
  }
  return TOP_Z - rank;
}

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

  // Ordre naturel (le dessus d'abord) : une carte jugée sort en tête de liste
  // sans qu'aucune autre ne soit DÉPLACÉE — un nœud déplacé rejoue ses effets
  // en mode strict, ce qui coupait net son animation d'échelle.
  return (
    <div className="relative isolate mx-auto aspect-[2/3]" style={{ width: CARD_WIDTH }}>
      <AnimatePresence initial={false} custom={exitVerdict}>
        {shown.map((card, depth) => (
          <SwipeStackCard
            key={card.key}
            card={card}
            depth={depth}
            zIndex={stackZ(card)}
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
        ))}
      </AnimatePresence>
    </div>
  );
}
