import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { PairingRedesign } from "../redesignWiring/pairing/PairingRedesign";

type Props = NativeStackScreenProps<RootStackParamList, "PairCode">;

/**
 * Le jumelage : l'automate vit dans `usePairingFlow` (et le code dans
 * `usePairingCode`), l'écran n'en fait que le rendu (la refonte,
 * `redesignWiring/pairing`).
 */
export function PairCodeScreen(props: Props) {
  return <PairingRedesign {...props} />;
}
