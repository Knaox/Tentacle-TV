import type { SetupActionId, SetupCheck, SetupCheckId } from "../jellyfinCompat/setupContract";
import type { SetupAdviceAction } from "../setupWizard/setupWizardContract";

/**
 * Les réglages de Jellyfin que Tentacle conseille — UNE règle, lue par le
 * tableau de bord (l'entrée groupée « Jellyfin » et celle des passages,
 * `attentionModel.ts`) ET par l'assistant d'installation, quand on y rejoint
 * un Jellyfin DÉJÀ configuré (écran « Réglages conseillés »).
 *
 * L'assistant ne propose que ce qui se règle d'un geste, avec les MÊMES
 * gestes que l'administration (`SetupActionId`, et la pose des greffons de
 * passages) : rien d'obligatoire, rien d'irréversible. Ce que l'administrateur
 * a réglé AUTREMENT (une autre langue) est montré, jamais coché d'office.
 */

/** Les greffons de passages : leur propre entrée au tableau de bord, et un geste à part (il redémarre Jellyfin). */
export const SEGMENTS_CHECK: SetupCheckId = "segmentsProvider";

/**
 * Le tableau de bord compte ce réglage dans l'entrée groupée « Jellyfin » :
 * à faire, et pas seulement facultatif. Les passages ont leur entrée à eux.
 */
export function isJellyfinTodo(check: Pick<SetupCheck, "id" | "level" | "state">): boolean {
  return check.level !== "optional" && check.id !== SEGMENTS_CHECK && check.state === "todo";
}

/** Les gestes de l'administration qui RÈGLENT un réglage sans risque, repris tels quels par l'assistant. */
export const ADVICE_ACTIONS: readonly SetupAdviceAction[] = ["setMetadataLanguage", "enableTrickplay", "enableRealtimeMonitor", "enableHevcEncoding"];
const SAFE_FIXES: ReadonlySet<SetupActionId> = new Set(ADVICE_ACTIONS);

const isAdviceAction = (action: SetupActionId): action is SetupAdviceAction => SAFE_FIXES.has(action);

/** Le geste d'un conseil : une action de l'administration, ou la pose des greffons de passages. */
export type AdviceGesture = SetupAdviceAction | "segmentPlugins";

export interface JellyfinAdvice {
  id: SetupCheckId;
  gesture: AdviceGesture;
  /** La valeur en place, en code (« en · US », « off ») ; `null` : rien de réglé. */
  current: string | null;
  /** Ce que Tentacle conseille, en code (« fr · FR », « on ») ; `null` : pas une valeur (greffons). */
  recommended: string | null;
  /** Coché d'office : le réglage manque. Réglé autrement par l'administrateur : jamais. */
  preselected: boolean;
  /** Ce que le geste touche : les bibliothèques à activer, ou les greffons à poser. */
  targets: string[];
}

export interface AdviceLocale {
  language: string;
  country: string;
}

/** L'ordre de l'écran : ce qui se voit le plus dans Tentacle d'abord. */
const ORDER: readonly SetupCheckId[] = ["segmentsProvider", "metadataLanguage", "trickplay", "realtimeMonitor", "hevcEncoding"];

export const localeValue = (locale: AdviceLocale): string => `${locale.language} · ${locale.country}`;

function adviceFor(check: SetupCheck, locale: AdviceLocale): JellyfinAdvice | null {
  if (check.id === SEGMENTS_CHECK) {
    if (check.state !== "todo") return null;
    const targets = (check.plugins ?? []).filter((plugin) => plugin.state !== "active" && plugin.state !== "restart").map((plugin) => plugin.name);
    return { id: check.id, gesture: "segmentPlugins", current: null, recommended: null, preselected: true, targets };
  }
  if (check.id === "metadataLanguage") {
    const recommended = localeValue(locale);
    // Réglée, et autrement : on le dit, sans la cocher.
    if (check.state === "done" && check.current !== null && check.current !== recommended) {
      return { id: check.id, gesture: "setMetadataLanguage", current: check.current, recommended, preselected: false, targets: [] };
    }
    if (!isJellyfinTodo(check)) return null;
    return { id: check.id, gesture: "setMetadataLanguage", current: check.current, recommended, preselected: true, targets: [] };
  }
  if (!isJellyfinTodo(check) || !check.action || !isAdviceAction(check.action)) return null;
  const targets = (check.libraries ?? []).filter((library) => !library.enabled).map((library) => library.name);
  return { id: check.id, gesture: check.action, current: check.current ?? "off", recommended: "on", preselected: true, targets };
}

/**
 * Les réglages conseillés d'un Jellyfin déjà configuré, dans l'ordre de
 * l'écran. `locale` : la langue et le pays proposés (ceux du navigateur).
 */
export function jellyfinAdvice(checks: readonly SetupCheck[], locale: AdviceLocale): JellyfinAdvice[] {
  return ORDER.flatMap((id) => {
    const check = checks.find((candidate) => candidate.id === id);
    const advice = check ? adviceFor(check, locale) : null;
    return advice ? [advice] : [];
  });
}
