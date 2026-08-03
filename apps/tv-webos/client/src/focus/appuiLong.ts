/**
 * Appui court et maintien de OK.
 *
 * Sur une carte d'épisode, un appui bref lance la lecture et un maintien ouvre
 * la fiche — la convention d'Apple TV, celle que le geste rend naturelle.
 *
 * Trois partis pris.
 *
 * **On déclenche AU SEUIL, pas au relâchement.** La fiche s'ouvre pendant qu'on
 * tient encore la touche : c'est ce qui donne la sensation d'un appareil qui
 * répond. Et cela supprime par construction la question « comment ne pas lancer
 * la lecture en relâchant après un maintien » — il n'y a plus rien à décider à
 * ce moment-là.
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
 */

/** Au-delà, c'est un maintien. En deçà de ~450 ms, un appui appuyé le
 *  déclencherait par mégarde ; au-delà de ~600 ms, on a l'impression d'attendre. */
const SEUIL_MS = 550;

/** Silence après lequel on considère la touche relâchée, faute de `keyup`. */
const SILENCE_MS = 700;

const CODE_OK = 13;

export interface ActionsAppui {
  court: () => void;
  long?: () => void;
}

interface EtatAppui {
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
    minuteurLong: null,
    minuteurSilence: null,
    longDeclenche: false,
    aRepete: false,
  };

  function nettoyer(): void {
    if (etat.minuteurLong !== null) clearTimeout(etat.minuteurLong);
    if (etat.minuteurSilence !== null) clearTimeout(etat.minuteurSilence);
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
    onKeyDown(evenement: { keyCode: number; preventDefault(): void }): void {
      if (evenement.keyCode !== CODE_OK) {
        // Un déplacement pendant l'appui annule tout.
        if (etat.minuteurLong !== null) nettoyer();
        return;
      }
      evenement.preventDefault();

      if (etat.minuteurLong !== null || etat.longDeclenche) {
        // Répétition automatique : elle ne relance rien, mais elle prouve que
        // la touche est toujours enfoncée.
        etat.aRepete = true;
        armerSilence();
        return;
      }

      etat.minuteurLong = setTimeout(() => {
        etat.minuteurLong = null;
        if (!actions.long) return;
        etat.longDeclenche = true;
        actions.long();
      }, SEUIL_MS);
    },

    onKeyUp(evenement: { keyCode: number }): void {
      if (evenement.keyCode !== CODE_OK) return;
      const long = etat.longDeclenche;
      const enCours = etat.minuteurLong !== null;
      nettoyer();
      // Rien à faire si le maintien a déjà agi ; sinon c'était un appui court.
      if (!long && enCours) actions.court();
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
