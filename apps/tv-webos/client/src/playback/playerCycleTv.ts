import { useEffect, useRef } from "react";
import { registerBack } from "../focus/back";
import { forgetOsdButton } from "./focusOsd";
import { ScrubMachine, readState, setMounted, setPanel, type PlayerMode } from "@tentacle-tv/tv-core";
import { installTvPlayerKeys, type PlayerActionsTv } from "./playerKeysTv";
import { setPlayerExit } from "./playerExitTv";

/**
 * Ce que le lecteur déclare au reste de l'application, et qu'il retire en
 * partant.
 *
 * Quatre attaches, aucune n'étant du dessin — d'où leur sortie de
 * `ControlsTv`, qui touchait les trois cents lignes. Elles ont en commun de
 * vivre HORS de l'arbre React du lecteur : un magasin externe, un écouteur en
 * capture sur le document, un attribut sur la racine, une pile de
 * consommateurs. C'est précisément ce qui les rend faciles à oublier au
 * démontage, et pourquoi elles gagnent à être lues ensemble.
 */

export interface PlayerBindingsTv {
  /** Le mode courant, publié sur la racine du document. */
  mode: PlayerMode;
  /** Relues à chaque touche : les rappels changent d'identité à chaque rendu. */
  actions: PlayerActionsTv;
  /** Pour annuler un déplacement en cours sur la touche Retour. */
  scrub: ScrubMachine;
}

export function usePlayerCycleTv({ mode, actions, scrub }: PlayerBindingsTv): void {
  const vivid = useRef(actions);
  vivid.current = actions;

  // La sortie, déposée pour les surcouches : elles vivent dans l'autre arbre
  // React et ne reçoivent pas `onBack`.
  useEffect(() => {
    setPlayerExit(() => vivid.current.quitter());
    return () => setPlayerExit(null);
  }, []);

  // Monté et démonté avec le lecteur : c'est cet indicateur que lisent le
  // moteur de focus et les touches de transport globales pour se retirer.
  useEffect(() => {
    setMounted(true);
    return () => {
      setMounted(false);
      document.documentElement.removeAttribute("data-tv-lecteur");
      // La mémoire du focus ne survit pas au lecteur : rouvrir un film repart
      // de Lecture, comme une première fois.
      forgetOsdButton();
    };
  }, []);

  useEffect(() => installTvPlayerKeys(() => vivid.current), []);

  /**
   * Le mode, publié sur la racine du document.
   *
   * Deux choses en dépendent, et aucune n'est un enfant de l'habillage : le
   * retrait d'overscan de `#root`, qu'il faut annuler tant que le lecteur est
   * là, et les surcouches — bouton « passer », carte « à suivre » —, qui vivent
   * dans l'autre arbre et doivent s'écarter quand les commandes paraissent.
   * Un attribut est la seule prise que le CSS ait sur un état qui n'est nulle
   * part dans son sous-arbre.
   */
  useEffect(() => {
    document.documentElement.setAttribute("data-tv-lecteur", mode);
  }, [mode]);

  /**
   * Le retour, en cascade : un panneau ouvert se ferme, un déplacement en cours
   * s'annule SANS déplacer, et sinon on laisse la pile faire son travail — elle
   * signale la sortie du lecteur avant de reculer, ce dont dépend la transition
   * de retour vers la fiche.
   */
  useEffect(
    () =>
      registerBack(() => {
        const current = readState();
        if (current.panel !== "none") {
          setPanel("none");
          return true;
        }
        if (current.mode === "scrub") {
          scrub.cancel();
          return true;
        }
        return false;
      }),
    [scrub],
  );
}
