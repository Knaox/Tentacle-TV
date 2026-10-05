import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { SettingsRedesign } from "../redesignWiring/settings/SettingsRedesign";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

/**
 * Les réglages (la refonte, `redesignWiring/settings/SettingsRedesign`) : la
 * logique de chaque section vit dans ses crochets. Le panneau de réglages DANS
 * le lecteur reste séparé : il est par-lecture.
 */
export function SettingsScreen(props: Props) {
  return <SettingsRedesign {...props} />;
}
