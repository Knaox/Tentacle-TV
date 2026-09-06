import { createContext, useContext } from "react";
import type { CardDensity } from "@tentacle-tv/api-client";
import { useResponsive } from "@/theme";

/** La largeur de base d'une carte de rangée (téléphone / tablette), × le facteur du compte. */
const BASE_WIDTH = { phone: 130, tablet: 168 } as const;
const FACTOR: Record<CardDensity, number> = { compact: 0.85, normal: 1, large: 1.2 };

const CardDensityContext = createContext<CardDensity>("normal");

/**
 * La densité des cartes du compte (réglage « Personnalisation », partagé avec
 * le web) : l'accueil l'enveloppe autour de ses rangées ; hors provider, la
 * densité normale — les autres écrans ne changent pas.
 */
export const CardDensityProvider = CardDensityContext.Provider;

export function useCardDensity(): CardDensity {
  return useContext(CardDensityContext);
}

/** LA largeur d'une carte de rangée : base de l'appareil × facteur du compte. */
export function useCardWidth(): number {
  const density = useContext(CardDensityContext);
  const { isTablet } = useResponsive();
  return Math.round((isTablet ? BASE_WIDTH.tablet : BASE_WIDTH.phone) * FACTOR[density]);
}
