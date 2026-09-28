/**
 * Le canvas du client téléviseur, en pixels CSS.
 *
 * Ce n'est pas une hypothèse : `shell/appinfo.json` déclare `1920x1080` et webOS
 * en fait la taille de la fenêtre de l'application, quelle que soit la
 * définition de la dalle. Mesuré sur une C3 en 4K, `window.innerWidth` répond
 * 1920 et le report de mise à l'échelle vaut 1,00.
 *
 * Ce que cette certitude permet est le fond du chantier de compatibilité :
 * `vw`, `vh`, `clamp()`, `min()` et `max()` deviennent CALCULABLES à la
 * compilation. Un moteur qui ne connaît pas ces primitives n'a alors rien à
 * ignorer, et un moteur qui les connaît calcule exactement la même chose — ce
 * qui est la définition de « le même rendu partout ».
 *
 * `main.tv.tsx` compare cette valeur à `window.innerWidth` au démarrage : une
 * dérive de géométrie doit se voir dans le journal, pas se découvrir dans une
 * mise en page effondrée.
 */
export const CANVAS = { width: 1920, height: 1080 } as const;

/**
 * Racine typographique.
 *
 * Aucune feuille du portage ne surcharge `html { font-size }` — vérifié —, donc
 * un `rem` vaut seize pixels. Le jour où l'une le ferait, ce fichier devrait
 * suivre, et le commentaire est là pour qu'on y pense.
 */
export const REM_ROOT = 16;

/**
 * Les marges de zone sûre (`env(safe-area-inset-*)`), en pixels CSS : zéro.
 *
 * Chromium les définit sur toutes les plateformes — à zéro quand l'appareil
 * n'en fournit pas —, et une dalle n'en fournit pas : c'est l'overscan qui en
 * tient lieu (`TV_OVERSCAN`, `@tentacle-tv/theme`). Un moteur qui comprend
 * `env()` y lit donc 0, même quand un repli est écrit : le repli ne sert qu'à
 * une variable inconnue, et celles-ci sont connues. Chrome 53, qui ne comprend
 * pas `env()`, jetait la déclaration ; résolue ici, elle vaut partout la même
 * chose.
 */
export const SAFE_AREA_INSET = 0;
