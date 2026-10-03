/**
 * Une doublure de react-i18next : `t` rend la clé et ses paramètres — la
 * trace compare des CLÉS, pas des traductions.
 */

export function translate(key: string, options?: Record<string, unknown>): string {
  return options && Object.keys(options).length > 0 ? `${key}${JSON.stringify(options)}` : key;
}

export function useTranslation() {
  return { t: translate, i18n: { language: "fr" } };
}

export const initReactI18next = { type: "3rdParty", init() {} };
