import { nextStartupWindow, startupRouteOf, type StartupDue, type StartupRoute, type StartupWindow } from "@tentacle-tv/tv-core";
import { pinSetupPending } from "../auth/pinSetupStep";
import { railSetupPending } from "../components/nav/railPinning";
import { photoSetupPending } from "../redesignWiring/photoSetup/photoSetupStep";
import type { RootStackParamList } from "./types";

/**
 * L'adaptateur du registre des FENÊTRES DU DÉMARRAGE (tv-core
 * `nav/startupWindows` : l'ordre, une seule à la fois) — ce que chaque fenêtre
 * dit d'elle-même pour l'identité active, lu SYNCHRONE (l'accueil ne paraît
 * jamais avant elles), et la route qui suit. Les trois portes d'entrée (la
 * route de démarrage, le jumelage réussi, « Qui regarde ? ») et chaque
 * fenêtre qui se ferme passent par ici ; une nouvelle fenêtre y ajoute sa
 * lecture, jamais une condition dans un écran.
 */
export function startupDue(): StartupDue {
  return { pinSetup: pinSetupPending(), railSetup: railSetupPending(), photoSetup: photoSetupPending() };
}

/** La route qui suit une session ouverte (`closed` absent) ou la fermeture d'une fenêtre. */
export function startupRouteAfter(closed: StartupWindow | null = null): StartupRoute {
  return startupRouteOf(nextStartupWindow(startupDue(), closed));
}

/** Les routes des fenêtres : elles s'ouvrent pour la session (`origin`). */
type StartupWindowRoute = Exclude<StartupRoute, "Home">;

type StartupStackRoute =
  | { name: "Home"; params: RootStackParamList["Home"] }
  | { name: StartupWindowRoute; params: { origin: "session" } };

/** La page seule à poser : l'accueil fond par-dessus (`entrance`), une fenêtre s'ouvre pour la session. */
export function startupStackRoute(route: StartupRoute): StartupStackRoute {
  return route === "Home" ? { name: "Home", params: { entrance: true } } : { name: route, params: { origin: "session" } };
}
