import { ScreenSkeletonRedesign } from "../redesignWiring/overlays/ScreenSkeletonRedesign";
import type { RouteLike } from "./routeRailKey";

/** Ce qu'un écran paresseux montre en se chargeant : la silhouette de la
 *  refonte, navigation gardée. */
export function SkeletonLoader({ route }: { route?: RouteLike }) {
  return <ScreenSkeletonRedesign route={route} />;
}
