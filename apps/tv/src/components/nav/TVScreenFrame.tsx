import { View } from "react-native";
import { Colors } from "../../theme/colors";
import { RAIL_COLLAPSED } from "./TVSideRail";

/**
 * Cadre léger des pages top-level : réserve la marge gauche du rail replié.
 * Le rail lui-même est désormais monté UNE SEULE FOIS par TVNavChrome (overlay
 * au niveau navigation) — d'où la disparition du remontage par écran qui
 * causait la latence de navigation sur boîtier réel.
 */
export function TVScreenFrame({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgDeep }}>
      <View style={{ flex: 1, paddingLeft: RAIL_COLLAPSED }}>{children}</View>
    </View>
  );
}
