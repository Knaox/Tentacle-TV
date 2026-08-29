import { isSelectKey } from "./keys";

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
 * OK se reconnaît par `isSelectKey` — le code, sinon le nom. Ne lire que
 * `keyCode` prenait, au banc d'essai où il vaut zéro, chaque répétition
 * d'Entrée pour un déplacement : la première annulait le maintien qu'elle
 * était censée prouver.
 */

/** Au-delà, c'est un maintien. En deçà de ~450 ms, un appui appuyé le
 *  déclencherait par mégarde ; au-delà de ~600 ms, on a l'impression d'attendre. */
/** Seuil du maintien, en millisecondes.
 *
 * Exporté parce que React Native ne peut pas réutiliser la machine telle
 * quelle : `Pressable` mesure lui-même le maintien et prend le seuil en prop
 * (`delayLongPress`). Partager la constante garde le geste identique sur les
 * trois cibles même si le mécanisme diffère. */
export const LONG_PRESS_THRESHOLD_MS = 550;

const THRESHOLD_MS = LONG_PRESS_THRESHOLD_MS;

/** Silence après lequel on considère la touche relâchée, faute de `keyup`. */
const SILENCE_MS = 700;

export interface PressActions {
  short: () => void;
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
  lock?: () => void;
}

interface PressState {
  /** La touche OK est enfoncée. **Suivi à part du minuteur**, et c'est le
   *  correctif : quand aucune action longue n'est déclarée — une affiche, dont
   *  l'appui court ouvre déjà la fiche — il n'y a pas de minuteur à armer. Le
   *  déduire de `longTimer !== null` faisait donc croire à un relâchement
   *  sans appui, et **tout OK maintenu plus d'une demi-seconde ne faisait
   *  rien**. Sur une télécommande, tenir OK une demi-seconde est le geste
   *  ordinaire, pas un cas limite. */
  down: boolean;
  longTimer: ReturnType<typeof setTimeout> | null;
  silenceTimer: ReturnType<typeof setTimeout> | null;
  longFired: boolean;
  didRepeat: boolean;
}

/**
 * Rend les gestionnaires à poser sur l'élément focusable.
 *
 * L'élément doit être un `div[role="button"]` et non un `<button>` : ce dernier
 * synthétise un `click` sur Entrée, et l'action serait jouée deux fois — une
 * par ici, une par le `onClick` du composant enveloppé.
 */
export function createLongPress(actions: PressActions) {
  const state: PressState = {
    down: false,
    longTimer: null,
    silenceTimer: null,
    longFired: false,
    didRepeat: false,
  };

  function reset(): void {
    if (state.longTimer !== null) clearTimeout(state.longTimer);
    if (state.silenceTimer !== null) clearTimeout(state.silenceTimer);
    state.down = false;
    state.longTimer = null;
    state.silenceTimer = null;
    state.longFired = false;
    state.didRepeat = false;
  }

  function armSilence(): void {
    if (state.silenceTimer !== null) clearTimeout(state.silenceTimer);
    state.silenceTimer = setTimeout(() => {
      // Silence : la touche est relâchée. Si le maintien n'a pas encore
      // atteint son seuil, c'était un appui court.
      if (!state.longFired) actions.short();
      reset();
    }, SILENCE_MS);
  }

  return {
    onKeyDown(event: { keyCode?: number; key?: string; preventDefault(): void }): void {
      if (!isSelectKey(event)) {
        // Un déplacement pendant l'appui annule tout.
        if (state.down) reset();
        return;
      }
      event.preventDefault();

      if (state.down) {
        // Répétition automatique : elle ne relance rien, mais elle prouve que
        // la touche est toujours enfoncée.
        state.didRepeat = true;
        armSilence();
        return;
      }

      state.down = true;

      // Le minuteur n'est armé que s'il y a un maintien à déclencher. Sans
      // action longue, l'appui reste un appui court quelle que soit sa durée —
      // c'est le relâchement qui le joue.
      if (!actions.long) return;

      state.longTimer = setTimeout(() => {
        state.longTimer = null;
        state.longFired = true;
        // Le verrou d'abord : si l'action navigue, la touche encore tenue ne
        // doit rien atteindre du nouvel écran.
        actions.lock?.();
        actions.long?.();
      }, THRESHOLD_MS);
    },

    onKeyUp(event: { keyCode?: number; key?: string }): void {
      if (!isSelectKey(event)) return;
      const long = state.longFired;
      const down = state.down;
      reset();
      // Rien à faire si le maintien a déjà agi ; sinon c'était un appui court,
      // long ou bref — la durée ne le distingue que lorsqu'un maintien existe.
      if (down && !long) actions.short();
    },

    /** À appeler sur `blur` : après une navigation, le `keyup` arriverait sur
     *  un élément démonté et laisserait l'état armé pour la carte suivante. */
    onBlur(): void {
      reset();
    },

    /** Exposé pour les tests : la répétition a-t-elle été observée ? */
    didRepeat(): boolean {
      return state.didRepeat;
    },
  };
}
