import type { ResolvedScheme, ThemeMode } from "@tentacle-tv/theme";

/**
 * L'apparence, figée en sombre.
 *
 * Substitué à `theme/colorScheme.ts`, qui est le point de passage unique de
 * l'apparence côté client : `useThemeMode`, `ThemeProvider` et la section
 * Apparence des réglages en dépendent tous. Le remplacer d'un bloc évite d'aller
 * poser une condition dans chacun d'eux — et permet à `apps/web` de continuer
 * d'ignorer l'existence du téléviseur.
 *
 * **Un téléviseur n'a pas de réglage système clair/sombre à suivre.** La
 * détection d'origine repose sur `prefers-color-scheme`, que webOS ne renseigne
 * pas ; le mode `auto` y répondait donc toujours la même chose, et le mode clair
 * n'a de toute façon aucun emploi dans une pièce dont on a baissé la lumière
 * pour regarder un film. Ce qui était un choix devient une constante, et la
 * section qui l'exposait disparaît des réglages.
 *
 * L'API est celle de l'original, à la lettre : `tsc` ne connaît pas les
 * substitutions, et un remplaçant qui recopie les signatures de mémoire est
 * libre de diverger en silence. Les types viennent donc du paquet partagé, comme
 * chez l'original.
 */

export const THEME_MODE_STORAGE_KEY = "tentacle_theme_mode";

const MODE: ThemeMode = "dark";
const SCHEMA: ResolvedScheme = "dark";

export const getMode = (): ThemeMode => MODE;
export const getScheme = (): ResolvedScheme => SCHEMA;

/**
 * Sans effet, et ce n'est pas une omission : il n'y a rien à changer. Les
 * appelants qui le proposaient — la section Apparence — ne sont plus compilés.
 */
export function setMode(_next: ThemeMode): void {
  /* L'apparence ne se règle pas sur un téléviseur. */
}

/**
 * Aucun abonné ne sera jamais notifié, puisque rien ne change. On rend tout de
 * même un désabonnement valide : `useSyncExternalStore` appelle ce qu'on lui
 * rend, et lui donner autre chose qu'une fonction serait une panne au démontage.
 */
export function subscribe(_listener: () => void): () => void {
  return () => {
    /* Rien à désabonner. */
  };
}

/**
 * L'attribut est déjà posé par le script d'amorçage d'`index.html`, avant le
 * premier tracé. On le réaffirme pour que le document reste cohérent si
 * quelque chose l'a touché entre-temps.
 */
export function syncFromDocument(): void {
  document.documentElement.setAttribute("data-theme", SCHEMA);
  document.documentElement.style.colorScheme = SCHEMA;
}

/**
 * Le fond opaque posé en ligne par le script d'amorçage doit être libéré une
 * fois l'application montée, sans quoi il figerait la surface et neutraliserait
 * la surcharge de thème de marque. Même geste que sur le client web.
 */
export function releaseBootBackground(): void {
  document.documentElement.style.background = "";
}
