import type { ReactNode } from "react";
import { CardFrame as CadreWeb } from "@/components/cards/CardFrame";

interface ProprietesCadreCarte {
  hovered: boolean;
  aspect: string;
  lift?: { scale: number; y: number };
  suppressLift?: boolean;
  concealed?: boolean;
  children: ReactNode;
}

/**
 * Cadre de carte, privé de son survol.
 *
 * `passeSurvol` retire les règles `:hover` de la feuille, mais les deux calques
 * d'élévation de `.media-tile` sont pilotés par un **attribut**,
 * `data-hovered` (cf. `theme/cards.css`), qu'aucune passe CSS n'atteint. Le
 * lift, lui, est un `transform` en style en ligne. Les deux viennent d'un
 * `useState` local à chaque type de carte, réveillé par `onMouseEnter` — mesuré
 * en direct sur la dalle de test : l'attribut basculait bien à `true`.
 *
 * Envelopper le cadre plutôt que chaque carte tient à ce qu'il est le point de
 * passage unique : affiches, vignettes d'épisode, cartes de bibliothèque et de
 * collection le traversent toutes. Une seule substitution les couvre.
 *
 * `concealed` est également neutralisé : il efface la carte au profit du
 * panneau d'aperçu, qui ne s'ouvre plus (`shims/survolInerte.ts`). Le laisser
 * passer rendrait des cartes invisibles sans rien pour les remplacer.
 *
 * Ce qui reste intact : `data-card-visual`, le repère que le calque d'ouverture
 * de la fiche fait voyager, et la boîte de ratio. On retire un comportement, pas
 * une structure.
 */
export function CardFrame({ aspect, lift, children }: ProprietesCadreCarte) {
  return (
    <CadreWeb hovered={false} aspect={aspect} lift={lift} concealed={false}>
      {children}
    </CadreWeb>
  );
}
