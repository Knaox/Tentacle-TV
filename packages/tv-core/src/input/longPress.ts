import { estValidation } from "./keys";

/**
 * Appui court et maintien de OK.
 *
 * Sur une carte d'épisode, un appui bref lance la lecture et un maintien ouvre
 * la fiche — la convention d'Apple TV, celle que le geste rend naturelle.
 *
 * Quatre partis pris.
 *
 * **On déclenche AU SEUIL, pas au relâchement.** La fiche s'ouvre pendant qu'on
 * tient encore la touche : c'est ce qui donne la sensation d'un appareil qui
 * répond. Et cela supprime par construction la question « comment ne pas lancer
 * la lecture en relâchant après un maintien » — il n'y a plus rien à décider à
 * ce moment-là.
 *
 * **Une action longue arme le VERROU avant d'agir.** Déclencher au seuil a un
 * revers : la touche encore tenue continue d'émettre, et ses répétitions
 * atteignaient l'écran que l'action venait d'ouvrir — le bouton « Lecture »
 * d'une fiche synthétise un `click` par Entrée, et le maintien TRAVERSAIT la
 * fiche jusqu'au lecteur. Le `preventDefault` d'ici ne protège que l'élément
 * de départ ; le verrou (`verrouTouche.ts`) avale OK au niveau de la fenêtre,
 * d'un écran à l'autre, jusqu'au relâchement.
 *
 * **Le relâchement n'est pas garanti.** Certains modèles ne notifient pas de
 * `keyup`. On le déduit alors du silence : la répétition automatique s'arrête
 * au relâchement, donc un intervalle sans répétition vaut relâchement. Le
 * chien de garde n'est armé qu'après avoir observé une première répétition —
 * sur un modèle qui ne répète pas du tout, il ne se déclenche jamais et le
 * `keyup` reste seul maître.
 *
 * **Tout est annulé par un déplacement.** Une flèche pendant l'appui abandonne
 * les deux actions : l'utilisateur a changé d'avis, pas confirmé.
 *
 * OK se reconnaît par `estValidation` — le code, sinon le nom. Ne lire que
 * `keyCode` prenait, au banc d'essai où il vaut zéro, chaque répétition
 * d'Entrée pour un déplacement : la première annulait le maintien qu'elle
 * était censée prouver.
 */

/** Au-delà, c'est un maintien. En deçà de ~450 ms, un appui appuyé le
 *  déclencherait par mégarde ; au-delà de ~600 ms, on a l'impression d'attendre. */
const SEUIL_MS = 550;

/** Silence après lequel on considère la touche relâchée, faute de `keyup`. */
const SILENCE_MS = 700;

export interface ActionsAppui {
  court: () => void;
  long?: () => void;
  /**
   * Appelé juste AVANT l'action longue, pour armer le verrou de touche.
   *
   * Injecté plutôt qu'importé : le verrou a une machine commune mais un
   * installeur par plateforme (écouteurs `window` en capture sur la LG,
   * `TVEventHandler` en React Native), et ce module doit rester sans DOM.
   * Côté LG, `focus/appuiLong.ts` le câble pour que les appelants n'aient
   * rien à savoir de tout ceci.
   */
  verrouiller?: () => void;
}

interface EtatAppui {
  /** La touche OK est enfoncée. **Suivi à part du minuteur**, et c'est le
   *  correctif : quand aucune action longue n'est déclarée — une affiche, dont
   *  l'appui court ouvre déjà la fiche — il n'y a pas de minuteur à armer. Le
   *  déduire de `minuteurLong !== null` faisait donc croire à un relâchement
   *  sans appui, et **tout OK maintenu plus d'une demi-seconde ne faisait
   *  rien**. Sur une télécommande, tenir OK une demi-seconde est le geste
   *  ordinaire, pas un cas limite. */
  enfonce: boolean;
  minuteurLong: ReturnType<typeof setTimeout> | null;
  minuteurSilence: ReturnType<typeof setTimeout> | null;
  longDeclenche: boolean;
  aRepete: boolean;
}

/**
 * Rend les gestionnaires à poser sur l'élément focusable.
 *
 * L'élément doit être un `div[role="button"]` et non un `<button>` : ce dernier
 * synthétise un `click` sur Entrée, et l'action serait jouée deux fois — une
 * par ici, une par le `onClick` du composant enveloppé.
 */
export function creerAppuiLong(actions: ActionsAppui) {
  const etat: EtatAppui = {
    enfonce: false,
    minuteurLong: null,
    minuteurSilence: null,
    longDeclenche: false,
    aRepete: false,
  };

  function nettoyer(): void {
    if (etat.minuteurLong !== null) clearTimeout(etat.minuteurLong);
    if (etat.minuteurSilence !== null) clearTimeout(etat.minuteurSilence);
    etat.enfonce = false;
    etat.minuteurLong = null;
    etat.minuteurSilence = null;
    etat.longDeclenche = false;
    etat.aRepete = false;
  }

  function armerSilence(): void {
    if (etat.minuteurSilence !== null) clearTimeout(etat.minuteurSilence);
    etat.minuteurSilence = setTimeout(() => {
      // Silence : la touche est relâchée. Si le maintien n'a pas encore
      // atteint son seuil, c'était un appui court.
      if (!etat.longDeclenche) actions.court();
      nettoyer();
    }, SILENCE_MS);
  }

  return {
    onKeyDown(evenement: { keyCode?: number; key?: string; preventDefault(): void }): void {
      if (!estValidation(evenement)) {
        // Un déplacement pendant l'appui annule tout.
        if (etat.enfonce) nettoyer();
        return;
      }
      evenement.preventDefault();

      if (etat.enfonce) {
        // Répétition automatique : elle ne relance rien, mais elle prouve que
        // la touche est toujours enfoncée.
        etat.aRepete = true;
        armerSilence();
        return;
      }

      etat.enfonce = true;

      // Le minuteur n'est armé que s'il y a un maintien à déclencher. Sans
      // action longue, l'appui reste un appui court quelle que soit sa durée —
      // c'est le relâchement qui le joue.
      if (!actions.long) return;

      etat.minuteurLong = setTimeout(() => {
        etat.minuteurLong = null;
        etat.longDeclenche = true;
        // Le verrou d'abord : si l'action navigue, la touche encore tenue ne
        // doit rien atteindre du nouvel écran.
        actions.verrouiller?.();
        actions.long?.();
      }, SEUIL_MS);
    },

    onKeyUp(evenement: { keyCode?: number; key?: string }): void {
      if (!estValidation(evenement)) return;
      const long = etat.longDeclenche;
      const enfonce = etat.enfonce;
      nettoyer();
      // Rien à faire si le maintien a déjà agi ; sinon c'était un appui court,
      // long ou bref — la durée ne le distingue que lorsqu'un maintien existe.
      if (enfonce && !long) actions.court();
    },

    /** À appeler sur `blur` : après une navigation, le `keyup` arriverait sur
     *  un élément démonté et laisserait l'état armé pour la carte suivante. */
    onBlur(): void {
      nettoyer();
    },

    /** Exposé pour les tests : la répétition a-t-elle été observée ? */
    aRepete(): boolean {
      return etat.aRepete;
    },
  };
}
