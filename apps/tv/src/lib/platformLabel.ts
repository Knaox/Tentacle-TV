import { Platform } from "react-native";

/**
 * Libellé de plateforme affiché dans l'app (écran À propos) ET rapporté à
 * Jellyfin (nom du client/device). Résolu par `Platform.OS` : « Apple TV » sur
 * tvOS, « Android TV » sinon — l'app tvOS s'identifiait à tort comme Android TV.
 */
export const TV_PLATFORM_LABEL = Platform.OS === "ios" ? "Apple TV" : "Android TV";
