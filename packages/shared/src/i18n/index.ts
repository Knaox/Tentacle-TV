import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./locales/fr";
import en from "./locales/en";

const NAMESPACES = [
  "common", "auth", "setup", "player", "admin",
  "tickets", "pairing", "preferences", "about", "notifications", "nav",
  "adminPlugins", "adminInvites", "adminServices", "adminMetadata", "adminJellyfin", "adminRecommended", "media", "errors", "profile", "disclaimer",
  "watchTogether", "downloads", "easterEggs", "reco", "whatsNew", "offline", "sessions", "search",
  "cards", "library", "watchlist", "favorites", "swipe",
  "share",
  "stats",
  "statsShare",
  "statsPublic",
  "trailerHelp",
  "serverLinks",
] as const;

export function initI18n(options?: { lng?: string; fallbackLng?: string }) {
  if (i18n.isInitialized) return i18n;
  i18n.use(initReactI18next).init({
    resources: { fr, en },
    lng: options?.lng ?? "fr",
    fallbackLng: options?.fallbackLng ?? "en",
    ns: [...NAMESPACES],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return i18n;
}

/**
 * Langue préférée de l'appareil : « fr » ou « en ». Le navigateur d'abord ;
 * React Native n'a pas de `navigator.language`, la locale d'`Intl` (Hermes la
 * fournit) prend alors le relais — sans elle, le mobile démarrait en français
 * sur un téléphone anglais.
 */
export function detectLanguage(): string {
  let locale: string | undefined;
  if (typeof navigator !== "undefined" && navigator.language) {
    locale = navigator.language;
  } else {
    try {
      locale = Intl.DateTimeFormat().resolvedOptions().locale;
    } catch { /* pas d'Intl : défaut anglais */ }
  }
  return uiLanguage(locale);
}

/**
 * Réduit une langue i18next (« fr-FR », « en », indéfinie) aux deux langues
 * de l'interface. Toute pastille de langue s'allume sur CETTE valeur, lue sur
 * `i18n.language` — jamais sur le stockage, vide au premier lancement alors
 * que le texte suit déjà la langue détectée.
 */
export function uiLanguage(lng: string | undefined | null): "fr" | "en" {
  return lng?.startsWith("fr") ? "fr" : "en";
}

export { i18n };
