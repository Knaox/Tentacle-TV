import { Platform } from "react-native";
import * as Application from "expo-application";
import type { LicensePlatform } from "@tentacle-tv/shared/licenses";

// La plateforme et la version dont l'écran « Licences » parle : la source de
// Tentacle se lit au tag `mobile-vX.Y.Z` de CETTE version.
const appJsonExpo = require("../../../app.json").expo ?? {};

export const LICENSE_PLATFORM: LicensePlatform = Platform.OS === "ios" ? "ios" : "android";
export const APP_VERSION: string = Application.nativeApplicationVersion ?? appJsonExpo.version ?? "1.0.0";
