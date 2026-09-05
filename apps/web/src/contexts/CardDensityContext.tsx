import { createContext, useContext } from "react";
import type { CardDensity } from "@tentacle-tv/api-client";
import type { CardSize } from "../components/cards/cardSizes";

/**
 * Densité des cartes de rangée, choisie dans Personnalisation et portée par la
 * page (l'accueil aujourd'hui). Consommée au POINT DE MESURE unique
 * (`useRowCardWidth`) : ni MediaRow ni les cartes n'ont à transporter la prop.
 */
const CardDensityContext = createContext<CardDensity>("normal");

export const CardDensityProvider = CardDensityContext.Provider;

const DENSITY_TO_SIZE: Record<CardDensity, CardSize> = {
  compact: "sm",
  normal: "md",
  large: "lg",
};

export function useCardSize(): CardSize {
  return DENSITY_TO_SIZE[useContext(CardDensityContext)];
}
