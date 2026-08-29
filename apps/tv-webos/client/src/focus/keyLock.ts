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
 * avalé là n'atteint ni `noterAppui` — donc l'affinage d'entrée du nouvel écran
 * survit au maintien — ni l'activation native du bouton d'arrivée, ni aucun
 * gestionnaire de l'écran monté. Les flèches passent : elles appartiennent au
 * déplacement, pas au maintien. Le `keyup` passe aussi — inoffensif, et c'est
 * lui qui désarme.
 */

const machine = createSelectKeyLock();
let retirerEcouteurs: (() => void) | null = null;

/**
 * À appeler juste AVANT une action longue : la touche tenue est avalée d'un
 * écran à l'autre, jusqu'au relâchement. Sans effet hors navigateur — les
 * tests de la machine d'appui tournent en environnement node.
 */
export function armerVerrouOk(): void {
  if (typeof window === "undefined") return;

  machine.arm(() => {
    retirerEcouteurs?.();
    retirerEcouteurs = null;
  });
  if (retirerEcouteurs) return;

  const onKeyDown = (evenement: KeyboardEvent) => {
    if (machine.onKeyDown(evenement)) {
      evenement.preventDefault();
      evenement.stopPropagation();
    }
  };
  const onKeyUp = (evenement: KeyboardEvent) => {
    machine.onKeyUp(evenement);
  };

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  retirerEcouteurs = () => {
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
  };
}
