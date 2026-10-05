import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { LibraryRedesign } from "../redesignWiring/library/LibraryRedesign";

type Props = NativeStackScreenProps<RootStackParamList, "Library">;

/** Une bibliothèque (la refonte, `redesignWiring/library`). */
export function LibraryScreen(props: Props) {
  return <LibraryRedesign {...props.route.params} />;
}
