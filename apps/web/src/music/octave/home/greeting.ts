/**
 * Octave — le mot d'accueil. Règle PURE : l'heure, le jour, le prénom et ce
 * qu'on écoute donnent une PHRASE parmi plusieurs (clés i18n `octaveHome.greet.*`),
 * choisie de façon stable — la même tout au long d'un moment de la journée,
 * une autre au moment suivant ou le lendemain. Jamais deux phrases différentes
 * à deux rendus voisins ; jamais de réseau (pas de météo).
 */

export type GreetingMoment = "lateNight" | "morning" | "midday" | "afternoon" | "evening" | "night";

export interface GreetingInput {
  now: Date;
  /** Le prénom, déjà nettoyé (`greetingName`), sinon `null`. */
  name: string | null;
  /** L'artiste qu'on écoutait en dernier (lecteur repris, historique), sinon `null`. */
  artist: string | null;
  /** Ce qui distingue deux comptes du même appareil (identifiant), pour ne pas leur dire la même chose. */
  seed?: string;
}

export interface Greeting {
  /** Clé complète dans l'espace `music`. */
  key: string;
  params: Record<string, string>;
}

export function greetingMoment(hour: number): GreetingMoment {
  if (hour < 5) return "lateNight";
  if (hour < 12) return "morning";
  if (hour < 14) return "midday";
  if (hour < 18) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

const MOMENT_LINES: Record<GreetingMoment, readonly string[]> = {
  lateNight: ["lateNightAwake", "lateNightBest"],
  morning: ["morningStart", "morningCoffee", "morningBright"],
  midday: ["middayBreak", "middayLunch"],
  afternoon: ["afternoonNice", "afternoonCarry", "afternoonSound"],
  evening: ["eveningStarts", "eveningTempo", "eveningNice"],
  night: ["nightLast", "nightYours"],
};

/** Les phrases du jour, quand le jour a quelque chose à dire (0 = dimanche). */
function dayLines(day: number, moment: GreetingMoment): string[] {
  const weekend = day === 0 || day === 6;
  if (day === 1 && moment === "morning") return ["mondayMorning"];
  if (day === 5 && (moment === "evening" || moment === "night")) return ["fridayEvening"];
  if (weekend && moment === "morning") return ["weekendMorning"];
  if (day === 0 && (moment === "afternoon" || moment === "evening")) return ["sundaySlow"];
  return [];
}

/** Petit hachage stable (FNV-1a) : le même jour, le même moment, la même phrase. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Ce qui fixe la phrase : le compte, le jour, le moment. Tant que cette clé ne change pas, la phrase déjà
 * dite est REDITE (un remontage de l'accueil ne la change pas, même si l'artiste est arrivé entre-temps).
 */
export function greetingSlot(now: Date, seed: string): string {
  return `${seed}|${dayStamp(now)}|${greetingMoment(now.getHours())}`;
}

function dayStamp(now: Date): string {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

export function pickGreeting({ now, name, artist, seed = "" }: GreetingInput): Greeting {
  const moment = greetingMoment(now.getHours());
  const days = dayLines(now.getDay(), moment);
  // Le jour compte double : un vendredi soir se dit plus souvent qu'un soir quelconque.
  const pool = [...MOMENT_LINES[moment], ...days, ...days];
  // La nuit profonde ne parle pas de l'artiste : on ne relance pas quelqu'un qui veut dormir.
  if (artist && moment !== "lateNight") pool.push("artistBack", "artistWaiting");
  const id = pool[hash(`${dayStamp(now)}|${moment}|${seed}`) % pool.length] as string;
  const params: Record<string, string> = {};
  if (name) params.name = name;
  if (artist && id.startsWith("artist")) params.artist = artist;
  return { key: `octaveHome.greet.${id}${name ? "_name" : ""}`, params };
}

/**
 * Le prénom à dire : le premier mot du nom du compte, s'il ressemble à un prénom
 * (des lettres, 2 à 20) — « oa1 », « admin_2 » ou une adresse ne se disent pas.
 */
export function greetingName(accountName: string | null | undefined): string | null {
  const first = (accountName ?? "").trim().split(/[\s._@-]+/)[0] ?? "";
  if (first.length < 2 || first.length > 20 || !/^\p{L}+$/u.test(first)) return null;
  if (/^(admin|administrator|administrateur|root|user|guest|test|demo)$/i.test(first)) return null;
  return first.charAt(0).toLocaleUpperCase() + first.slice(1);
}
