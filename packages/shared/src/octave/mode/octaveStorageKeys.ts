/**
 * Octave — les clés de stockage d'APPAREIL du mode, les mêmes sur toutes les
 * plateformes (localStorage du web et du bureau, AsyncStorage du mobile).
 * Elles traversent le disque de l'utilisateur : elles ne se renomment jamais.
 */

/** Le mode où l'on est (« 1 » : Octave), gardé en quittant. */
export const OCTAVE_MODE_KEY = "tentacle_octave_mode";
/** « Au démarrage, ouvrir » : `last` | `octave` | `tentacle` (absent : `last`). */
export const OCTAVE_STARTUP_KEY = "tentacle_octave_startup";
/** Le miroir de la disponibilité d'Octave, par serveur et par compte (`OctaveLaunchMirror`). */
export const OCTAVE_LAUNCH_MIRROR_KEY = "tentacle_octave_launch";
/** La page d'Octave où l'on était en quittant (`SavedOctavePage`). */
export const OCTAVE_PAGE_KEY = "tentacle_octave_page";
