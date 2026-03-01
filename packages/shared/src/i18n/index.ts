import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./locales/fr";
import en from "./locales/en";

const NAMESPACES = [
  "common", "auth", "setup", "player", "admin", "requests",
  "tickets", "pairing", "preferences", "about", "notifications", "nav",
  "adminPlugins", "media", "errors", "discover", "profile", "seer",
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

/** Detect preferred language from browser or system. Returns "fr" or "en". */
export function detectLanguage(): string {
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language.startsWith("fr") ? "fr" : "en";
  }
  return "en";
}

export { i18n };
