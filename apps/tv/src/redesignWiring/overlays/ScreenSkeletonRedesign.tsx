import { ScreenSkeleton } from "../../redesign/screens/overlays/ScreenSkeleton";
import { routeRailKey, type RouteLike } from "../../navigation/routeRailKey";
import { REDESIGN_ROUTES } from "../redesignGate";
import { RedesignScreen } from "../screen/RedesignScreen";
import { useRedesignScreen } from "../screen/useRedesignScreen";

/**
 * Un écran paresseux qui se charge (Apple TV) : la silhouette de la refonte,
 * et — pour un écran refondu avec navigation — sa navigation déjà là, pour
 * que rien ne saute quand l'écran arrive.
 */
export function ScreenSkeletonRedesign({ route }: { route?: RouteLike }) {
  const railKey = route && REDESIGN_ROUTES.has(route.name) ? routeRailKey(route) : null;
  return railKey ? <RailSkeleton railKey={railKey} /> : <ScreenSkeleton />;
}

function RailSkeleton({ railKey }: { railKey: string }) {
  const screen = useRedesignScreen({ railKey });
  return (
    <RedesignScreen screen={screen}>
      <ScreenSkeleton nav={screen.nav} />
    </RedesignScreen>
  );
}
