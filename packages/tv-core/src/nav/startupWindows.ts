/**
 * Les FENÊTRES DU DÉMARRAGE de la TV — un registre ORDONNÉ, une seule fenêtre
 * à la fois. Elles passent après une session ouverte (jumelage réussi, profil
 * choisi et son PIN, démarrage d'une session reprise) et avant l'accueil ;
 * jamais par-dessus la page bloquante « accès suspendu », qui est une porte à
 * la racine, hors de ce registre. Module pur : chaque fenêtre dit seulement si
 * elle est DUE (lecture synchrone de l'adaptateur), le registre dit laquelle
 * montrer maintenant, et la suivante quand elle se ferme.
 *
 * Le PREMIER PASSAGE dans un profil, dans cet ordre (décision du 16/10) :
 * 1. `pinSetup` — le code PIN conseillé (`session/pinSetup`) ;
 * 2. `railSetup` — les bibliothèques de la barre (`nav/railSetup`) ;
 * 3. `photoSetup` — la photo du profil, s'il n'en a pas (galerie d'avatars).
 * Chacune une fois par profil et par appareil, chacune avec son « Plus tard ».
 *
 * Une nouvelle fenêtre (les nouveautés…) prend SA place dans
 * `STARTUP_WINDOWS` et sa route dans `STARTUP_WINDOW_ROUTES` — jamais une
 * condition câblée dans un écran. Une à la fois : aucune ne paraît
 * par-dessus une autre.
 */

/** L'ordre : le code PIN, la barre, la photo. */
export const STARTUP_WINDOWS = ["pinSetup", "railSetup", "photoSetup"] as const;

export type StartupWindow = (typeof STARTUP_WINDOWS)[number];

/** Ce que chaque fenêtre dit d'elle-même : due pour l'identité active, sur cet appareil. */
export type StartupDue = Readonly<Partial<Record<StartupWindow, boolean>>>;

/** La route de chaque fenêtre. */
export const STARTUP_WINDOW_ROUTES = {
  pinSetup: "PinSetup",
  railSetup: "RailSetup",
  photoSetup: "PhotoSetup",
} as const satisfies Record<StartupWindow, string>;

export type StartupRoute = (typeof STARTUP_WINDOW_ROUTES)[StartupWindow] | "Home";

/**
 * La fenêtre à montrer maintenant : la première DUE après `closed` (celle qui
 * vient de se fermer ; null : on sort d'une session), sinon null — l'accueil.
 * Une fenêtre ne revient jamais : on ne cherche qu'après celle qui se ferme.
 */
export function nextStartupWindow(due: StartupDue, closed: StartupWindow | null = null): StartupWindow | null {
  const from = closed === null ? 0 : STARTUP_WINDOWS.indexOf(closed) + 1;
  return STARTUP_WINDOWS.slice(from).find((window) => due[window] === true) ?? null;
}

/** La route d'une fenêtre ; sans fenêtre, l'accueil. */
export function startupRouteOf(window: StartupWindow | null): StartupRoute {
  return window === null ? "Home" : STARTUP_WINDOW_ROUTES[window];
}
