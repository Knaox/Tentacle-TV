import { useCallback, useEffect, useRef, useState } from "react";
import { useAutoSkipIntro } from "../../hooks/useAutoSkipIntro";
import {
  REPOS,
  compteAffiche,
  deciderSautIntro,
  montrerPilule,
  type EntreeSautIntro,
  type EtatSautIntro,
} from "./sautIntro";

const PERIODE_MS = 1000;

interface Options {
  /** La fenêtre d'intro, telle que le lecteur la calcule déjà. */
  visible: boolean;
  /** Le saut lui-même — le geste du clic sur la pilule. */
  sauter: () => void;
  /** Un autre membre du groupe s'est opposé : on s'aligne, sans le rediffuser. */
  refusDistant?: number;
}

interface Etat {
  /** La pilule se rend-elle ? Non pendant un saut : il a déjà été demandé. */
  montrer: boolean;
  /** Secondes restantes, `null` quand la pilule est un simple bouton. */
  compte: number | null;
  /** L'utilisateur s'y oppose, pour ce passage sur l'intro. */
  annuler: () => void;
  /** Le saut demandé à la main — même masquage que le saut automatique. */
  sauterMaintenant: () => void;
}

/**
 * La coquille React autour de `sautIntro.ts` — partagée par les deux moteurs de
 * lecture (web HLS et bureau mpv).
 *
 * Elle ne décide de rien : elle bat la seconde, lit la préférence, et pousse au
 * réducteur les fronts de `visible`. Toute la logique — et les deux défauts
 * qu'elle corrige — est décrite et testée dans le module pur.
 */
export function useSkipIntroCountdown({ visible, sauter, refusDistant }: Options): Etat {
  const actif = useAutoSkipIntro();
  const [etat, setEtat] = useState<EtatSautIntro>(REPOS);

  // Le réducteur a besoin du `visible` PRÉCÉDENT pour reconnaître une entrée
  // dans l'intro ; l'état React, lui, ne le porte pas.
  const visiblePrecedent = useRef(false);
  // `sauter` est une fonction fraîche à chaque rendu : la lire dans une ref
  // évite de relancer la minuterie à chaque image du lecteur.
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

  // Les fronts, tout de suite : entrer dans l'intro doit armer le décompte sans
  // attendre le prochain battement, et en sortir doit tout éteindre net.
  useEffect(() => {
    pousser({ type: "cadre", visible, actif, ecouleMs: 0 });
  }, [visible, actif, pousser]);

  // La seconde, seulement quand il y a quelque chose à décompter.
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      pousser({ type: "cadre", visible: true, actif, ecouleMs: PERIODE_MS });
    }, PERIODE_MS);
    return () => clearInterval(id);
  }, [visible, actif, pousser]);

  // Watch Together : le refus d'un autre membre vaut pour la séance.
  useEffect(() => {
    if (refusDistant) pousser({ type: "croix" });
  }, [refusDistant, pousser]);

  return {
    montrer: montrerPilule(etat, visible),
    compte: compteAffiche(etat),
    annuler: useCallback(() => pousser({ type: "croix" }), [pousser]),
    sauterMaintenant: useCallback(() => pousser({ type: "sauteMaintenant" }), [pousser]),
  };
}
