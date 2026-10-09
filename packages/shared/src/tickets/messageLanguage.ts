/**
 * La langue d'un message de ticket, devinée — de quoi SUGGÉRER une
 * traduction quand quelqu'un écrit dans une autre langue que celle de
 * l'interface. Sur le web, le navigateur le propose de lui-même ; dans
 * l'application, rien ne le faisait.
 *
 * Une estimation volontairement prudente, sur les mots les plus courants
 * de quelques langues : rien n'est rendu tant que le texte ne penche pas
 * NETTEMENT d'un côté (un message trop court, un mélange, une langue
 * inconnue → `null`, et aucune suggestion). Pure, sans dépendance.
 */

export type GuessedLanguage = "fr" | "en" | "es" | "de" | "it" | "pt";

const WORDS: Record<GuessedLanguage, readonly string[]> = {
  fr: ["le", "la", "les", "des", "est", "et", "je", "pas", "une", "un", "du", "que", "qui", "dans", "pour", "sur", "avec", "ne", "mais", "il", "elle", "nous", "vous", "ce", "cette", "mon", "ma", "mes", "au", "aux", "ça", "c'est", "j'ai", "bonjour", "merci", "film", "série"],
  en: ["the", "and", "is", "are", "to", "of", "it", "in", "that", "this", "i", "you", "not", "for", "with", "on", "my", "be", "was", "have", "has", "but", "can", "can't", "doesn't", "don't", "it's", "i'm", "please", "thanks", "hello", "movie", "show", "would", "there", "what"],
  es: ["el", "los", "las", "es", "y", "que", "no", "una", "por", "con", "para", "pero", "mi", "se", "lo", "del", "como", "está", "hola", "gracias", "película", "serie"],
  de: ["der", "die", "das", "und", "ist", "nicht", "ich", "ein", "eine", "zu", "mit", "auf", "für", "es", "sie", "wir", "aber", "bitte", "danke", "hallo", "film", "kann", "geht"],
  it: ["il", "lo", "gli", "di", "che", "non", "è", "una", "per", "con", "ma", "sono", "mi", "della", "ciao", "grazie", "questo", "funziona"],
  pt: ["o", "os", "as", "não", "uma", "um", "que", "com", "para", "por", "mas", "eu", "você", "está", "obrigado", "olá", "filme", "série"],
};

const LOOKUP = new Map<string, GuessedLanguage[]>();
for (const [lang, words] of Object.entries(WORDS) as Array<[GuessedLanguage, readonly string[]]>) {
  for (const w of words) LOOKUP.set(w, [...(LOOKUP.get(w) ?? []), lang]);
}

/** Au moins autant de mots reconnus, et une avance nette sur la suivante. */
const MIN_HITS = 3;
const LEAD = 2;

/** La langue la plus probable d'un texte, ou `null` quand rien ne se dégage. */
export function guessTextLanguage(text: string): GuessedLanguage | null {
  const tokens = text.toLowerCase().replace(/[’`]/g, "'").match(/[\p{L}']+/gu) ?? [];
  const score = new Map<GuessedLanguage, number>();
  for (const token of tokens) {
    // Un mot que plusieurs langues partagent (« film », « que ») compte moins.
    const langs = LOOKUP.get(token);
    if (!langs) continue;
    for (const lang of langs) score.set(lang, (score.get(lang) ?? 0) + 1 / langs.length);
  }
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  if (!best || best[1] < MIN_HITS) return null;
  if (second && best[1] < second[1] * LEAD) return null;
  return best[0];
}

/** Ce message est-il écrit dans une autre langue que celle de l'interface ? */
export function isForeignMessage(text: string, uiLanguage: string): boolean {
  const guessed = guessTextLanguage(text);
  return guessed !== null && guessed !== uiLanguage.slice(0, 2).toLowerCase();
}
