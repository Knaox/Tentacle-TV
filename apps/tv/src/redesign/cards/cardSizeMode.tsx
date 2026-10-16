import { createContext, useContext, useMemo, type ReactNode } from "react";
import { TV_STAGE } from "@tentacle-tv/theme";
import { cardMetricsOf, type CardMetrics, type CardSize } from "@tentacle-tv/tv-core";

/**
 * La taille des cartes vue par les vues de la refonte : les gabarits de la
 * scène (`TV_STAGE.card`) à la taille réglée — vignette 16:9, affiche 2:3, et
 * les colonnes des grilles (`cardMetricsOf`, tv-core).
 *
 * Les vues ne lisent pas le stockage : elles reçoivent les gabarits de ce
 * fournisseur. L'app le branche sur la clé persistée (`lib/cardSize.ts`,
 * monté dans `App.tsx`) ; le banc, sur la taille de sa scène. Sans
 * fournisseur : la taille normale, les gabarits d'avant le réglage.
 */

const BASE = { landscape: TV_STAGE.card.landscape, poster: TV_STAGE.card.poster };

const METRICS: Readonly<Record<CardSize, CardMetrics>> = {
  small: cardMetricsOf("small", BASE),
  normal: cardMetricsOf("normal", BASE),
  large: cardMetricsOf("large", BASE),
};

// Sans fournisseur (le banc) : la taille normale, les gabarits de la scène — pas le défaut de l'app.
const CardSizeContext = createContext<CardMetrics>(METRICS.normal);

export function CardSizeProvider({ size, children }: { size: CardSize; children: ReactNode }) {
  // Trois objets figés : une taille inchangée rend le même objet, rien ne se redessine.
  const value = useMemo(() => METRICS[size], [size]);
  return <CardSizeContext.Provider value={value}>{children}</CardSizeContext.Provider>;
}

/** Les gabarits des cartes à la taille réglée. */
export function useCardMetrics(): CardMetrics {
  return useContext(CardSizeContext);
}
