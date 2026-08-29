import { createSelectKeyLock } from "@tentacle-tv/tv-core";

/**
 * L'installeur LG du verrou d'OK.
 *
 * La machine — quels événements avaler, quand se désarmer — vit dans
 * `@tentacle-tv/tv-core` : elle est identique sur les trois cibles. Ce qui
 * change d'une plateforme à l'autre, et qui est donc resté ici, c'est la façon
 * de l'alimenter.
 *
 * Ici : des écouteurs en CAPTURE sur `window`, que la phase de capture place
 * AVANT ceux du moteur et de React quel que soit l'ordre d'installation. Un OK
 * avalé là n'atteint ni `notePress` — donc l'affinage d'entrée du nouvel écran
 * survit au maintien — ni l'activation native du bouton d'arrivée, ni aucun
 * gestionnaire de l'écran monté. Les flèches passent : elles appartiennent au
 * déplacement, pas au maintien. Le `keyup` passe aussi — inoffensif, et c'est
 * lui qui désarme.
 */

const machine = createSelectKeyLock();
let removeListeners: (() => void) | null = null;

/**
 * À appeler juste AVANT une action longue : la touche tenue est avalée d'un
 * écran à l'autre, jusqu'au relâchement. Sans effet hors navigateur — les
 * tests de la machine d'appui tournent en environnement node.
 */
export function armOkLock(): void {
  if (typeof window === "undefined") return;

  machine.arm(() => {
    removeListeners?.();
    removeListeners = null;
  });
  if (removeListeners) return;

  const onKeyDown = (event: KeyboardEvent) => {
    if (machine.onKeyDown(event)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const onKeyUp = (event: KeyboardEvent) => {
    machine.onKeyUp(event);
  };

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  removeListeners = () => {
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
  };
}
