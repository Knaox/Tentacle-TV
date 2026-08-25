/**
 * La locale numérique, et pourquoi mpv ne démarre pas sans elle.
 *
 * libmpv analyse ses nombres avec `strtod`, qui suit `LC_NUMERIC`. Sous une
 * locale française — `fr_FR`, `fr_CH` — le séparateur décimal est la virgule :
 * `0.5` s'arrête au point et vaut `0`. Selon l'option, `mpv_create` échoue, ou
 * pire, réussit avec des valeurs muettement fausses.
 *
 * ⚠️ Ce n'est pas nous qui posons cette locale, et c'est ce qui rend le défaut
 * traître : **GTK le fait**. Electron initialise GTK sous Linux — pour les
 * dialogues natifs, entre autres — et GTK appelle `setlocale(LC_ALL, "")`, qui
 * adopte la locale de l'environnement. Le processus démarre donc en `C`, et
 * bascule plus tard, à un moment qui dépend de ce que l'utilisateur a fait.
 * Mesuré : au démarrage `LC_NUMERIC` vaut encore `C` ; ouvrir le sélecteur de
 * dossier des téléchargements suffit à le changer. Une lecture lancée après
 * échouerait quand la même lecture, lancée avant, passait.
 *
 * D'où l'appel JUSTE AVANT `mpv_create`, et non une fois au démarrage.
 *
 * Sans objet sur Windows et macOS, dont les coquilles n'initialisent pas GTK —
 * la fonction y sort immédiatement plutôt que de charger une libc pour rien.
 * Repris de `main.rs` de l'app Tauri, qui posait le même garde-fou.
 */

import koffi from "koffi";

/** `LC_NUMERIC` dans la libc de GNU (`locale.h`). */
const LC_NUMERIC = 1;

type Setlocale = (categorie: number, locale: string | null) => string | null;

let poseur: Setlocale | null = null;
let indisponible = false;

/**
 * Force `LC_NUMERIC` à `C`. Rend la locale qui régnait, ou `null` si on n'a pas
 * pu la lire — un échec ici ne doit jamais empêcher une lecture de démarrer.
 */
export function poserLocaleNumeriqueC(): string | null {
  if (process.platform !== "linux" || indisponible) return null;
  try {
    if (poseur === null) {
      const libc = koffi.load("libc.so.6");
      poseur = libc.func("char* setlocale(int category, const char* locale)") as unknown as Setlocale;
    }
    const avant = poseur(LC_NUMERIC, null);
    poseur(LC_NUMERIC, "C");
    return avant;
  } catch (e) {
    // Une seule plainte : l'appel a lieu à chaque lecture.
    indisponible = true;
    console.warn(`[mpv] LC_NUMERIC n'a pas pu être forcé à C : ${String(e)}`);
    return null;
  }
}
