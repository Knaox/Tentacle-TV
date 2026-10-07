import type { LicensePlatform } from "@tentacle-tv/shared/licenses";
import { desktopPlatform, isDesktopApp } from "../../desktop/bridge";

/**
 * La plateforme dont l'écran « Licences » montre les composants : le système
 * du bureau, le client LG (`__DIST_CHANNEL__ === "webos"`), sinon le web.
 */
export function webLicensePlatform(): LicensePlatform {
  if (isDesktopApp()) {
    const os = desktopPlatform();
    if (os === "macos" || os === "windows" || os === "linux") return os;
  }
  return __DIST_CHANNEL__ === "webos" ? "webos" : "web";
}
