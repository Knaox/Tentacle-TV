/**
 * Noms de langues sans `Intl.DisplayNames`.
 *
 * Hermes (l'app mobile) n'a pas `Intl.DisplayNames` : le menu des pistes du
 * lecteur local montrait « FRE — Forced ». Une table statique, français et
 * anglais, pour les langues de `LANGUAGE_CODE_GROUPS` et les régions les plus
 * courantes ; `Intl` ne sert plus qu'en repli, pour un code absent d'ici.
 *
 * Les chaînes reproduisent celles d'`Intl.DisplayNames` (majuscule comprise) :
 * un moteur qui l'a et un moteur qui ne l'a pas affichent la même chose.
 */

import { primaryLangSubtag } from "./langSubtags";

export interface LanguageNames {
  fr: string;
  en: string;
}

const N = (fr: string, en: string): LanguageNames => ({ fr, en });

/**
 * Clé : sous-tag primaire ISO 639-1 (« fr »), éventuellement suivi d'une
 * région (« fr-BE ») ou d'une écriture (« zh-Hant »). Les codes 639-2
 * (« fre », « fra ») passent par `primaryLangSubtag`.
 */
export const LANGUAGE_NAMES: Readonly<Record<string, LanguageNames>> = {
  ja: N("Japonais", "Japanese"), fr: N("Français", "French"), en: N("Anglais", "English"),
  de: N("Allemand", "German"), es: N("Espagnol", "Spanish"), it: N("Italien", "Italian"),
  pt: N("Portugais", "Portuguese"), ru: N("Russe", "Russian"), zh: N("Chinois", "Chinese"),
  ko: N("Coréen", "Korean"), ar: N("Arabe", "Arabic"), nl: N("Néerlandais", "Dutch"),
  pl: N("Polonais", "Polish"), cs: N("Tchèque", "Czech"), hu: N("Hongrois", "Hungarian"),
  ro: N("Roumain", "Romanian"), el: N("Grec", "Greek"), tr: N("Turc", "Turkish"),
  he: N("Hébreu", "Hebrew"), th: N("Thaï", "Thai"), vi: N("Vietnamien", "Vietnamese"),
  hi: N("Hindi", "Hindi"), uk: N("Ukrainien", "Ukrainian"), sv: N("Suédois", "Swedish"),
  no: N("Norvégien", "Norwegian"), da: N("Danois", "Danish"), fi: N("Finnois", "Finnish"),
  hr: N("Croate", "Croatian"), sk: N("Slovaque", "Slovak"), sr: N("Serbe", "Serbian"),
  bg: N("Bulgare", "Bulgarian"), sl: N("Slovène", "Slovenian"), is: N("Islandais", "Icelandic"),
  cy: N("Gallois", "Welsh"), eu: N("Basque", "Basque"), sq: N("Albanais", "Albanian"),
  hy: N("Arménien", "Armenian"), ka: N("Géorgien", "Georgian"), mk: N("Macédonien", "Macedonian"),
  ms: N("Malais", "Malay"), my: N("Birman", "Burmese"), fa: N("Persan", "Persian"),
  bo: N("Tibétain", "Tibetan"), la: N("Latin", "Latin"), nb: N("Norvégien bokmål", "Norwegian Bokmål"),
  nn: N("Norvégien nynorsk", "Norwegian Nynorsk"), ta: N("Tamoul", "Tamil"), te: N("Télougou", "Telugu"),
  id: N("Indonésien", "Indonesian"), ca: N("Catalan", "Catalan"), lt: N("Lituanien", "Lithuanian"),
  lv: N("Letton", "Latvian"), et: N("Estonien", "Estonian"), ml: N("Malayalam", "Malayalam"),
  bn: N("Bengali", "Bengali"), ur: N("Ourdou", "Urdu"), tl: N("Tagalog", "Tagalog"),
  sw: N("Swahili", "Swahili"), af: N("Afrikaans", "Afrikaans"),
  "fr-BE": N("Français (Belgique)", "French (Belgium)"),
  "fr-CA": N("Français (Canada)", "French (Canada)"),
  "fr-CH": N("Français (Suisse)", "French (Switzerland)"),
  "pt-BR": N("Portugais (Brésil)", "Portuguese (Brazil)"),
  "pt-PT": N("Portugais (Portugal)", "Portuguese (Portugal)"),
  "en-GB": N("Anglais (Royaume-Uni)", "English (United Kingdom)"),
  "en-US": N("Anglais (États-Unis)", "English (United States)"),
  "en-AU": N("Anglais (Australie)", "English (Australia)"),
  "es-MX": N("Espagnol (Mexique)", "Spanish (Mexico)"),
  "es-419": N("Espagnol (Amérique latine)", "Spanish (Latin America)"),
  "zh-Hans": N("Chinois (simplifié)", "Chinese (Simplified)"),
  "zh-Hant": N("Chinois (traditionnel)", "Chinese (Traditional)"),
  "zh-CN": N("Chinois (Chine)", "Chinese (China)"),
  "zh-TW": N("Chinois (Taïwan)", "Chinese (Taiwan)"),
  "de-AT": N("Allemand (Autriche)", "German (Austria)"),
  "de-CH": N("Allemand (Suisse)", "German (Switzerland)"),
  "nl-BE": N("Néerlandais (Belgique)", "Dutch (Belgium)"),
};

/**
 * « fre » → « Français » / « French » ; « fr-BE » → « Français (Belgique) » ;
 * « zh-Hant » → « Chinois (traditionnel) » ; une région inconnue retombe sur
 * la langue seule ; un code inconnu → `null`.
 */
export function languageDisplayName(tag: string | undefined, locale: string): string | null {
  const raw = tag?.trim();
  if (!raw) return null;
  const [base = "", ...rest] = raw.split(/[-_]/);
  if (base.length === 0) return null;
  const primary = primaryLangSubtag(base) ?? base.toLowerCase();
  const script = rest.find((part) => /^[a-z]{4}$/i.test(part));
  const region = rest.find((part) => /^[a-z]{2}$|^\d{3}$/i.test(part));
  const lang: keyof LanguageNames = locale.toLowerCase().startsWith("fr") ? "fr" : "en";

  const keys: string[] = [];
  if (script !== undefined) keys.push(`${primary}-${script.charAt(0).toUpperCase()}${script.slice(1).toLowerCase()}`);
  if (region !== undefined) keys.push(`${primary}-${region.toUpperCase()}`);
  keys.push(primary);
  for (const key of keys) {
    const names = LANGUAGE_NAMES[key];
    if (names !== undefined) return names[lang];
  }
  return null;
}
