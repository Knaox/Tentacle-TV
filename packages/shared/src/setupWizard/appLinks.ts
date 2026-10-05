/**
 * Les applications Tentacle, par plateforme, pour l'écran « Et maintenant ? »
 * de l'assistant d'installation. Recopiées de la configuration du site vitrine
 * (dépôt Tentacle Web, `site.config.json`, relevée le 2026-10-06) : le site est
 * la source, ce fichier le suit.
 */
export type AppPlatform = "macos" | "windows" | "linux" | "ios" | "android" | "appletv" | "androidtv" | "webos";

export const TENTACLE_SITE_URL = "https://tentacletv.app";

export interface AppLink {
  platform: AppPlatform;
  group: "desktop" | "mobile" | "tv";
  url: string;
}

export const APP_LINKS: readonly AppLink[] = [
  { platform: "ios", group: "mobile", url: "https://apps.apple.com/app/id6760205634" },
  { platform: "android", group: "mobile", url: "https://play.google.com/store/apps/details?id=com.tentacletv.mobile" },
  { platform: "appletv", group: "tv", url: "https://apps.apple.com/app/id6760205634" },
  { platform: "androidtv", group: "tv", url: "https://play.google.com/store/apps/details?id=com.tentacletv.mobile" },
  { platform: "webos", group: "tv", url: `${TENTACLE_SITE_URL}/webos/` },
  { platform: "macos", group: "desktop", url: "https://apps.apple.com/app/id6760205634" },
  { platform: "windows", group: "desktop", url: "https://apps.microsoft.com/detail/9NKHL0T84245" },
  { platform: "linux", group: "desktop", url: "https://github.com/Knaox/Tentacle-TV/releases" },
];
