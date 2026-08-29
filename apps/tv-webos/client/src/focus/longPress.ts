import { createLongPress as createLongPressCore, type PressActions } from "@tentacle-tv/tv-core";
import { armOkLock } from "./keyLock";

/**
 * La machine d'appui long, câblée pour la LG.
 *
 * La machine elle-même — seuil de 550 ms, filet de silence à 700 ms, distinction
 * appui court / maintien — vit dans `@tentacle-tv/tv-core` et sert les trois
 * cibles. Elle ne connaît pas le verrou de touche : celui-ci a un installeur
 * différent par plateforme, et un module sans DOM ne peut pas en dépendre.
 *
 * Cette enveloppe fait la jonction. Les appelants — cartes, lignes d'épisode,
 * entrées du rail — importent d'ici comme avant et n'ont rien à savoir de la
 * séparation.
 */
export function createLongPress(actions: PressActions) {
  return createLongPressCore({ ...actions, lock: armOkLock });
}

export type { PressActions };
