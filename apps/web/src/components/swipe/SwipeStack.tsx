import { AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { recoPosterUrl, swipeStackZ, useJellyfinClient } from "@tentacle-tv/api-client";
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
  /** Verso de la carte du dessus. */
  details: SwipeCardDetails | undefined;
  /** Verso de la suivante : elle monte en tête déjà habillée (titre localisé,
   *  durée) — son texte ne change pas sous les yeux au changement de carte. */
  nextDetails?: SwipeCardDetails;
  onJudge: (verdict: SwipeVerdict) => void;
  onToggleInfo: () => void;
  /** Deux verdicts seulement — j'aime (droite), pas pour moi (gauche) : ni
   *  coup de cœur, ni « passer », ni verso. Le swipe de groupe (Watch
   *  Together) ; « Affiner » garde ses cinq gestes. */
  binary?: boolean;
}

export function SwipeStack({ cards, exitVerdict, infoOpen, details, nextDetails, onJudge, onToggleInfo, binary = false }: SwipeStackProps) {
  const { t } = useTranslation("swipe");
  const client = useJellyfinClient();
  const reduced = useReducedMotion() ?? false;
  const shown = cards.slice(0, VISIBLE);

  // Empilement par rang d'arrivée (`swipeStackZ`), jamais par place dans le
  // DOM : AnimatePresence réinsère une carte qui part à son ancien rang, et à
  // z-index égal elle passait sous la suivante. Ordre naturel (le dessus
  // d'abord) : une carte jugée sort en tête de liste sans qu'aucune autre ne
  // soit DÉPLACÉE — un nœud déplacé rejoue ses effets en mode strict, ce qui
  // coupait net son animation d'échelle. `isolate` garde ces z-index ici.
  return (
    <div className="relative isolate mx-auto aspect-[2/3]" style={{ width: CARD_WIDTH }}>
      <AnimatePresence initial={false} custom={exitVerdict}>
        {shown.map((card, depth) => (
          <SwipeStackCard
            key={card.key}
            card={card}
            depth={depth}
            zIndex={swipeStackZ(card)}
            posterUrl={recoPosterUrl(
              card,
              (id) => client.getImageUrl(id, "Primary", { height: 900, quality: 85 }),
              "w500"
            )}
            reducedMotion={reduced}
            infoOpen={infoOpen}
            details={depth === 0 ? details : depth === 1 ? nextDetails : undefined}
            label={card.year ? t("cardLabel", { title: card.title, year: card.year }) : card.title}
            onJudge={onJudge}
            onToggleInfo={onToggleInfo}
            binary={binary}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
