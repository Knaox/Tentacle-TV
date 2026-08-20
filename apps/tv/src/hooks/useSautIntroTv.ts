import { useCallback, useEffect, useRef, useState } from "react";
import {
  REPOS,
  compteAffiche,
  deciderSautIntro,
  montrerPilule,
  type EntreeSautIntro,
  type EtatSautIntro,
} from "@tentacle-tv/shared";
import { useSautIntroAuto } from "../lib/sautIntroAuto";

const PERIODE_MS = 1000;

interface Options {
  /** La fenêtre d'intro, telle que le bouton la calcule déjà. */
  visible: boolean;
  /** Vrai quand l'utilisateur vise une position : on ne saute pas sous ses pieds. */
  scrubbing?: boolean;
  /** Le saut lui-même. */
  sauter: () => void;
}

interface Etat {
  /** Le bouton se rend-il ? Non pendant un saut : il a déjà été demandé. */
  montrer: boolean;
  /** Secondes restantes, `null` quand le bouton est un simple bouton. */
  compte: number | null;
  /** L'utilisateur s'y oppose, pour ce passage sur l'intro. */
  annuler: () => void;
}

/**
 * Le décompte du saut d'intro, côté téléviseur.
 *
 * Même réducteur que le web (`@tentacle-tv/tv-core`) : les règles de
 * réarmement et de masquage pendant le saut sont écrites et testées une fois,
 * pas trois. Ne reste ici que ce qui est propre au salon — battre la seconde,
 * lire la préférence, et se taire pendant que l'utilisateur vise une position.
 */
export function useSautIntroTv({ visible, scrubbing = false, sauter }: Options): Etat {
  const actif = useSautIntroAuto();
  const [etat, setEtat] = useState<EtatSautIntro>(REPOS);

  const visiblePrecedent = useRef(false);
  const sauterRef = useRef(sauter);
  sauterRef.current = sauter;

  const pousser = useCallback((entree: EntreeSautIntro) => {
    setEtat((precedent) => {
      const [suivant, action] = deciderSautIntro(precedent, entree, visiblePrecedent.current);
      if (action === "sauter") sauterRef.current();
      return suivant;
    });
    if (entree.type === "cadre") visiblePrecedent.current = entree.visible;
  }, []);

  // Viser une position suspend le décompte sans valoir refus : le lâcher le
  // reprend là où il en était.
  const arme = actif && !scrubbing;

  useEffect(() => {
    pousser({ type: "cadre", visible, actif: arme, ecouleMs: 0 });
  }, [visible, arme, pousser]);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      pousser({ type: "cadre", visible: true, actif: arme, ecouleMs: PERIODE_MS });
    }, PERIODE_MS);
    return () => clearInterval(id);
  }, [visible, arme, pousser]);

  return {
    montrer: montrerPilule(etat, visible),
    compte: compteAffiche(etat),
    annuler: useCallback(() => pousser({ type: "croix" }), [pousser]),
  };
}
