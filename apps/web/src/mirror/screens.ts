import { lazy } from "react";

/**
 * Les écrans du miroir, chargés à la demande : le bureau n'en télécharge rien.
 * Le routeur les place à côté des pages du bureau (`ByFormFactor`).
 */

export const MirrorSearch = lazy(() => import("./screens/search").then((m) => ({ default: m.MirrorSearch })));
export const MirrorMediaDetail = lazy(() => import("./screens/detail").then((m) => ({ default: m.MirrorMediaDetail })));
export const MirrorLibraries = lazy(() => import("./screens/libraries").then((m) => ({ default: m.MirrorLibraries })));
export const MirrorLibraryCatalog = lazy(() => import("./screens/libraries").then((m) => ({ default: m.MirrorLibraryCatalog })));
export const MirrorWatchlist = lazy(() => import("./screens/collection").then((m) => ({ default: m.MirrorWatchlist })));
export const MirrorFavorites = lazy(() => import("./screens/favorites/FavoritesScreen").then((m) => ({ default: m.MirrorFavorites })));
export const MirrorProfile = lazy(() => import("./screens/profile").then((m) => ({ default: m.MirrorProfile })));
export const MirrorSettingsPane = lazy(() => import("./screens/settings").then((m) => ({ default: m.MirrorSettingsPane })));
export const MirrorAbout = lazy(() => import("./screens/misc").then((m) => ({ default: m.MirrorAbout })));
export const MirrorCredits = lazy(() => import("./screens/misc").then((m) => ({ default: m.MirrorCredits })));
export const MirrorSupport = lazy(() => import("./screens/misc").then((m) => ({ default: m.MirrorSupport })));
export const MirrorPairDevice = lazy(() => import("./screens/misc").then((m) => ({ default: m.MirrorPairDevice })));
export const MirrorLogin = lazy(() => import("./screens/auth").then((m) => ({ default: m.MirrorLogin })));
export const MirrorRegister = lazy(() => import("./screens/auth").then((m) => ({ default: m.MirrorRegister })));
export const MirrorHome = lazy(() => import("./screens/home").then((m) => ({ default: m.MirrorHome })));
export const MirrorForYou = lazy(() => import("./screens/forYou").then((m) => ({ default: m.MirrorForYou })));
