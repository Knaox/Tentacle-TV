import { Platform } from "react-native";
import type { PlayerSettingsContext } from "@/player/engine/playerSettingsPlatforms";
import { isMpvAvailable } from "../../../modules/mpv-player";

/**
 * La plateforme et la présence du lecteur avancé — le seul endroit où les
 * réglages lisent `Platform.OS` : la table `PLAYER_SETTINGS` décide du reste.
 */
export const playerSettingsContext = (): PlayerSettingsContext => ({
  platform: Platform.OS === "android" ? "android" : "ios",
  advancedEngine: isMpvAvailable(),
});
