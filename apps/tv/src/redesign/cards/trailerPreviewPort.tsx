import { createContext, useContext, type ReactNode } from "react";
import type { TrailerPreviewSubject } from "@tentacle-tv/shared";

/**
 * Le PORT de l'aperçu de bande-annonce au focus d'une carte : la vue dit
 * QUAND (le focus de la carte) et DE QUOI (`card.trailer`) ; l'intégration
 * décide du reste — demander au serveur, charger la vidéo cachée, dire quand
 * la carte peut grandir (`redesignWiring/cards/TrailerPreviewHost`). La vue
 * ne sait ni d'où vient la vidéo ni comment elle se lit : elle place ce qu'on
 * lui rend dans sa grande carte.
 *
 * Sans fournisseur (le banc), aucune carte ne grandit jamais.
 */
export interface CardPreview {
  /** La grande carte se montre : la vidéo a sa première image (jamais un cadre noir). */
  expanded: boolean;
  /**
   * La vidéo, à poser dans la grande carte : montée CACHÉE pendant qu'elle se
   * charge, montrée quand `expanded`, gardée le temps du repli. `null` : rien
   * à monter.
   */
  video: ReactNode | null;
}

/** Le crochet que l'intégration fournit : appelé à CHAQUE rendu d'une carte qui peut grandir. */
export type CardPreviewHook = (subject: TrailerPreviewSubject | null, focused: boolean) => CardPreview | null;

const NO_PREVIEW = (): CardPreview | null => null;

const PortContext = createContext<CardPreviewHook | null>(null);

/**
 * Fournit le crochet à tout ce qu'il enveloppe. `usePreview` ne change JAMAIS
 * d'identité (une fonction de module) : chaque carte l'appelle comme un
 * crochet, à chaque rendu.
 */
export function TrailerPreviewProvider({ usePreview, children }: { usePreview: CardPreviewHook; children: ReactNode }) {
  return <PortContext.Provider value={usePreview}>{children}</PortContext.Provider>;
}

/**
 * L'aperçu d'une carte : `subject` (`null` : une carte qui ne grandit pas —
 * hors d'une rangée, ou sans bande-annonce possible), son focus. Rend `null`
 * sans fournisseur.
 */
export function useCardPreview(subject: TrailerPreviewSubject | null, focused: boolean): CardPreview | null {
  const usePortPreview = useContext(PortContext) ?? NO_PREVIEW;
  return usePortPreview(subject, focused);
}
