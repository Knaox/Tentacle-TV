import type { SetupActionId, SetupCheck, SetupLevel, SetupState } from "@tentacle-tv/shared";
import type { StatusTone } from "../kit";

/**
 * Ce que la liste des réglages recommandés dit de chacun — en logique pure :
 * le ton de son état (qui suit aussi son importance), l'avancement, la langue
 * proposée pour les métadonnées, et les gestes qui demandent confirmation.
 */

/** Le ton suit l'état ET l'importance : un réglage facultatif à faire ne crie pas. */
export function stateTone(check: Pick<SetupCheck, "state" | "level">): StatusTone {
  switch (check.state) {
    case "done":
      return "success";
    case "pending-restart":
      return "warning";
    case "todo":
      return check.level === "essential" ? "error" : check.level === "recommended" ? "warning" : "info";
    default:
      return "neutral";
  }
}

export const STATE_LABEL: Record<SetupState, string> = {
  done: "stateDone",
  todo: "stateTodo",
  "pending-restart": "statePendingRestart",
  "not-needed": "stateNotNeeded",
  unknown: "stateUnknown",
};

export const LEVEL_LABEL: Record<SetupLevel, string> = {
  essential: "levelEssential",
  recommended: "levelRecommended",
  optional: "levelOptional",
};

/**
 * L'avancement : les réglages qui se font (ni « pas nécessaire », ni inconnus),
 * et ceux qui sont faits. Un redémarrage en attente n'est pas encore fait.
 */
export function setupProgress(checks: readonly SetupCheck[]): { done: number; total: number } {
  const counted = checks.filter((check) => check.state === "done" || check.state === "todo" || check.state === "pending-restart");
  return { done: counted.filter((check) => check.state === "done").length, total: counted.length };
}

export interface LanguageChoice {
  language: string;
  country: string;
  /** « français (France) », dans la langue de l'interface. */
  label: string;
}

const DEFAULT_COUNTRY: Record<string, string> = { fr: "FR", en: "US" };

/**
 * La langue des métadonnées à proposer : celle de l'interface, et le pays du
 * navigateur s'il parle cette langue (« fr-CA » → Canada), sinon le pays par
 * défaut de la langue.
 */
export function languageChoice(uiLanguage: string, browserLanguage: string): LanguageChoice {
  const language = uiLanguage.toLowerCase().startsWith("fr") ? "fr" : "en";
  const [browserLang, browserRegion] = browserLanguage.split("-");
  const country = browserLang?.toLowerCase() === language && /^[A-Za-z]{2}$/.test(browserRegion ?? "")
    ? (browserRegion as string).toUpperCase()
    : DEFAULT_COUNTRY[language];
  let label = `${language}-${country}`;
  try {
    label = new Intl.DisplayNames([language], { type: "language" }).of(`${language}-${country}`) ?? label;
  } catch {
    /* Intl.DisplayNames absent : le code suffit */
  }
  return { language, country, label };
}

export interface ConfirmCopy {
  title: string;
  body: string;
  confirm: string;
}

/** Les gestes qui partent sans confirmation sont légers et réversibles ; les autres se confirment. */
export const CONFIRMED_ACTIONS: Partial<Record<SetupActionId, ConfirmCopy>> = {
  installChapterSegments: { title: "installConfirmTitle", body: "installConfirmBody", confirm: "installConfirm" },
  generateTrickplay: { title: "generateConfirmTitle", body: "generateConfirmBody", confirm: "generateConfirm" },
  scanMediaSegments: { title: "rescanConfirmTitle", body: "rescanConfirmBody", confirm: "rescanConfirm" },
  refreshMissingMetadata: { title: "refreshConfirmTitle", body: "refreshConfirmBody", confirm: "refreshConfirm" },
};

/** Les bibliothèques d'un réglage par bibliothèque, séparées entre activées et à activer. */
export function splitLibraries(check: SetupCheck): { on: string[]; off: string[] } {
  const libraries = check.libraries ?? [];
  return {
    on: libraries.filter((library) => library.enabled).map((library) => library.name),
    off: libraries.filter((library) => !library.enabled).map((library) => library.name),
  };
}

/** La clé de l'échec d'un geste, d'après le code que renvoie le serveur. */
export function applyErrorKey(code: string | null | undefined): string {
  const known = ["busy", "not-applied", "unreachable", "rejected", "not-configured"];
  return code && known.includes(code) ? `applyError_${code}` : "applyError_generic";
}
