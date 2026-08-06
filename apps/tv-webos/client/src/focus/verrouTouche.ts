import { estValidation } from "./touches";

/**
 * Le verrou d'OK : un maintien qui a agi avale la touche jusqu'au relâchement.
 *
 * Une action longue se déclenche AU SEUIL, touche encore enfoncée — c'est ce
 * qui donne la sensation d'un appareil qui répond. Mais la touche tenue
 * continue d'émettre : ses répétitions automatiques atteignaient l'écran que
 * l'action venait d'ouvrir, où le focus se pose sur un `<button>` natif —
 * « Lecture » sur une fiche — qui synthétise un `click` par Entrée. Maintenir
 * OK sur une carte d'épisode TRAVERSAIT donc la fiche jusqu'au lecteur, et le
 * masquage d'une entrée du rail sur-naviguait de la même façon. Le
 * `preventDefault` de la machine d'appui ne protège que l'élément de DÉPART :
 * rien ne protégeait l'élément d'ARRIVÉE, sur un écran qui n'existait pas
 * encore au moment de l'appui.
 *
 * D'où ce verrou, en deux couches :
 *
 * - **la machine**, pure et testable : armée par l'action longue, elle dit
 *   quels événements avaler, et se désarme au `keyup` d'OK — ou au SILENCE de
 *   la répétition automatique, les mêmes 700 ms que la machine d'appui et
 *   pour la même raison : certains modèles ne notifient pas le relâchement,
 *   et un verrou fantôme avalerait l'appui suivant ;
 * - **l'installeur**, minimal : des écouteurs en CAPTURE sur `window`, que la
 *   phase de capture place AVANT ceux du moteur et de React quel que soit
 *   l'ordre d'installation. Un OK avalé là n'atteint ni `noterAppui` — donc
 *   l'affinage d'entrée du nouvel écran survit au maintien — ni l'activation
 *   native du bouton d'arrivée, ni aucun gestionnaire de l'écran monté. Les
 *   flèches passent : elles appartiennent au déplacement, pas au maintien.
 *   Le `keyup` passe aussi — inoffensif, et c'est lui qui désarme.
 */

/** Silence après lequel la touche est réputée relâchée, faute de `keyup`. */
const SILENCE_MS = 700;

interface EtatVerrou {
  arme: boolean;
  minuteurSilence: ReturnType<typeof setTimeout> | null;
  surDesarmement: (() => void) | null;
}

/** La machine seule, pour les tests ; l'application passe par `armerVerrouOk`. */
export function creerVerrouOk(silenceMs: number = SILENCE_MS) {
  const etat: EtatVerrou = { arme: false, minuteurSilence: null, surDesarmement: null };

  function desarmer(): void {
    if (!etat.arme) return;
    etat.arme = false;
    if (etat.minuteurSilence !== null) clearTimeout(etat.minuteurSilence);
    etat.minuteurSilence = null;
    const rappel = etat.surDesarmement;
    etat.surDesarmement = null;
    rappel?.();
  }

  function armerSilence(): void {
    if (etat.minuteurSilence !== null) clearTimeout(etat.minuteurSilence);
    etat.minuteurSilence = setTimeout(desarmer, silenceMs);
  }

  return {
    armer(surDesarmement?: () => void): void {
      etat.arme = true;
      etat.surDesarmement = surDesarmement ?? null;
      armerSilence();
    },

    /** Vrai si l'événement doit être avalé ; chaque répétition avalée
     *  rafraîchit le silence — elle prouve que la touche est encore tenue. */
    surKeydown(evenement: { keyCode?: number; key?: string }): boolean {
      if (!etat.arme) return false;
      if (!estValidation(evenement)) return false;
      armerSilence();
      return true;
    },

    /** Vrai si c'était le relâchement d'OK : le verrou vient de se désarmer. */
    surKeyup(evenement: { keyCode?: number; key?: string }): boolean {
      if (!etat.arme) return false;
      if (!estValidation(evenement)) return false;
      desarmer();
      return true;
    },

    estArme(): boolean {
      return etat.arme;
    },
  };
}

const machine = creerVerrouOk();
let retirerEcouteurs: (() => void) | null = null;

/**
 * À appeler juste AVANT une action longue : la touche tenue est avalée d'un
 * écran à l'autre, jusqu'au relâchement. Sans effet hors navigateur — les
 * tests de la machine d'appui tournent en environnement node.
 */
export function armerVerrouOk(): void {
  if (typeof window === "undefined") return;

  machine.armer(() => {
    retirerEcouteurs?.();
    retirerEcouteurs = null;
  });
  if (retirerEcouteurs) return;

  const surKeydown = (evenement: KeyboardEvent) => {
    if (machine.surKeydown(evenement)) {
      evenement.preventDefault();
      evenement.stopPropagation();
    }
  };
  const surKeyup = (evenement: KeyboardEvent) => {
    machine.surKeyup(evenement);
  };

  window.addEventListener("keydown", surKeydown, true);
  window.addEventListener("keyup", surKeyup, true);
  retirerEcouteurs = () => {
    window.removeEventListener("keydown", surKeydown, true);
    window.removeEventListener("keyup", surKeyup, true);
  };
}
