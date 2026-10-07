import type { LicensePlatform } from "../licenseTypes";

// Les regroupements de plateformes qui reviennent dans l'inventaire.
export const DESKTOP: readonly LicensePlatform[] = ["macos", "windows", "linux"];
/** Le client web : navigateur, coquille du bureau, client LG. */
export const WEB_CLIENTS: readonly LicensePlatform[] = ["web", ...DESKTOP, "webos"];
export const MOBILE: readonly LicensePlatform[] = ["ios", "android"];
export const TV: readonly LicensePlatform[] = ["tvos", "androidtv"];
export const REACT_NATIVE: readonly LicensePlatform[] = [...MOBILE, ...TV];
export const ANDROID: readonly LicensePlatform[] = ["android", "androidtv"];
export const APPLE_PLAYERS: readonly LicensePlatform[] = ["ios", "tvos"];
export const EVERY_CLIENT: readonly LicensePlatform[] = [...WEB_CLIENTS, ...REACT_NATIVE];
