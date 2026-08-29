import { isSelectKey } from "./keys";

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
 * - **l'installeur**, propre à chaque plateforme, qui branche cette machine sur
 *   la vraie source d'événements. Il ne peut pas être ici : la LG écoute
 *   `window` en capture, React Native passe par `TVEventHandler`. Voir
 *   `apps/tv-webos/client/src/focus/verrouTouche.ts` pour la version LG.
 */

/** Silence après lequel la touche est réputée relâchée, faute de `keyup`. */
const SILENCE_MS = 700;

interface LockState {
  armed: boolean;
  silenceTimer: ReturnType<typeof setTimeout> | null;
  onDisarm: (() => void) | null;
}

/** La machine seule, pour les tests ; l'application passe par `armerVerrouOk`. */
export function createSelectKeyLock(silenceMs: number = SILENCE_MS) {
  const state: LockState = { armed: false, silenceTimer: null, onDisarm: null };

  function disarm(): void {
    if (!state.armed) return;
    state.armed = false;
    if (state.silenceTimer !== null) clearTimeout(state.silenceTimer);
    state.silenceTimer = null;
    const callback = state.onDisarm;
    state.onDisarm = null;
    callback?.();
  }

  function armSilence(): void {
    if (state.silenceTimer !== null) clearTimeout(state.silenceTimer);
    state.silenceTimer = setTimeout(disarm, silenceMs);
  }

  return {
    arm(onDisarm?: () => void): void {
      state.armed = true;
      state.onDisarm = onDisarm ?? null;
      armSilence();
    },

    /** Vrai si l'événement doit être avalé ; chaque répétition avalée
     *  rafraîchit le silence — elle prouve que la touche est encore tenue. */
    onKeyDown(event: { keyCode?: number; key?: string }): boolean {
      if (!state.armed) return false;
      if (!isSelectKey(event)) return false;
      armSilence();
      return true;
    },

    /** Vrai si c'était le relâchement d'OK : le verrou vient de se désarmer. */
    onKeyUp(event: { keyCode?: number; key?: string }): boolean {
      if (!state.armed) return false;
      if (!isSelectKey(event)) return false;
      disarm();
      return true;
    },

    isArmed(): boolean {
      return state.armed;
    },
  };
}
