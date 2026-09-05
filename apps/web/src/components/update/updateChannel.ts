import { isWindows } from "../../hooks/mpvRuntime";

export type UpdateChannel = "appStore" | "microsoftStore" | "linux";

/**
 * Le canal, déduit de l'état du hook et non de la plateforme seule : la
 * simulation (touche U) se déclare « store » sur tout ce qui n'est pas Windows,
 * et le libellé doit suivre le bouton qui ouvre réellement l'App Store.
 */
export function updateChannel(isStoreUpdate: boolean): UpdateChannel {
  if (isStoreUpdate) return "appStore";
  return isWindows() ? "microsoftStore" : "linux";
}

/** Noms propres : pas de clé i18n. */
export const UPDATE_CHANNEL_LABEL: Record<UpdateChannel, string> = {
  appStore: "App Store",
  microsoftStore: "Microsoft Store",
  linux: "Linux",
};

/** Phrase du sous-titre, dans l'espace `notifications`. */
export const UPDATE_CHANNEL_READY_KEY: Record<UpdateChannel, string> = {
  appStore: "notifications:updateReadyAppStore",
  microsoftStore: "notifications:updateReadyMicrosoftStore",
  linux: "notifications:updateReadyLinux",
};
