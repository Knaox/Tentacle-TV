import {
  nextStep,
  pathEntry,
  previousStep,
  type ExistingLibrary,
  type LibraryOutcome,
  type LibraryPlan,
  type SegmentSetupRun,
  type SetupAdviceAction,
  type SetupAdviceOutcome,
  type SetupCompleteResponse,
  type SetupContext,
} from "@tentacle-tv/shared";
import { pathOf, wizardSteps, type WizardLocale, type WizardStep } from "./wizardModel";

/**
 * L'état de l'assistant et ses transitions, sans React (`useWizard` le
 * branche). Chaque déplacement est jugé contre le parcours EN COURS : on ne
 * va, on n'avance et on ne revient que vers un écran de ce parcours — jamais
 * vers celui d'un autre, même par un appel direct.
 */

/** Ce que l'administrateur a coché à l'écran des réglages conseillés (rien : « Passer »). */
export interface AdviceChoice {
  /** Poser les greffons de passages (Jellyfin redémarre une fois). */
  segments: boolean;
  actions: SetupAdviceAction[];
  /** Les titres des réglages cochés, pour le récapitulatif (clés `rec_<id>`). */
  ids: string[];
}

/** Ce que l'assistant a appris en chemin. Le mot de passe ne vit qu'ici, en mémoire, jamais stocké. */
export interface WizardData {
  context: SetupContext | null;
  credentials: { username: string; password: string } | null;
  locale: WizardLocale;
  existing: ExistingLibrary[];
  plans: LibraryPlan[];
  outcomes: LibraryOutcome[] | null;
  /** Jellyfin déjà configuré : les réglages conseillés cochés (`null` : pas encore vus). */
  advice: AdviceChoice | null;
  /** Leur issue, une fois appliqués. */
  adviceOutcomes: SetupAdviceOutcome[] | null;
  /**
   * La détection des passages : `undefined` pas encore faite, `null` faite
   * sans succès (l'installation continue), sinon son résultat.
   */
  segments: SegmentSetupRun | null | undefined;
  session: SetupCompleteResponse | null;
  /** Le code d'installation est à donner (navigateur hors du réseau local, ou installation réclamée ailleurs). */
  needsCode: boolean;
  /** Pourquoi le code est demandé, quand l'ouverture sans code a été refusée. */
  codeReason: "code_required" | "setup_in_progress" | null;
  /** L'adresse de Jellyfin que recevront les applications, revue au récapitulatif. */
  clientUrl: string;
}

export interface WizardState {
  step: WizardStep;
  data: WizardData;
}

export type WizardAction =
  | { type: "patch"; data: Partial<WizardData> }
  | { type: "go"; step: WizardStep }
  | { type: "next" }
  | { type: "back" }
  /** Une session ouverte (code, réseau local, rechargement) : le contexte, et l'écran où reprendre. */
  | { type: "enter"; context: SetupContext; step: WizardStep }
  /** Le Jellyfin choisi : le contexte rendu par le serveur, et le premier écran de SON parcours. */
  | { type: "choose"; context: SetupContext };

export function initialData(browserLocale: WizardLocale): WizardData {
  return {
    context: null,
    credentials: null,
    locale: browserLocale,
    existing: [],
    plans: [],
    outcomes: null,
    advice: null,
    adviceOutcomes: null,
    segments: undefined,
    session: null,
    needsCode: true,
    codeReason: null,
    clientUrl: "",
  };
}

/** Ce qui ne vaut que pour UN Jellyfin : oublié quand on en choisit un autre. */
const PER_SERVER: Partial<WizardData> = {
  credentials: null,
  existing: [],
  plans: [],
  outcomes: null,
  advice: null,
  adviceOutcomes: null,
  segments: undefined,
};

function stepsOf(data: WizardData): WizardStep[] {
  return wizardSteps({ needsCode: data.needsCode, context: data.context });
}

/** Aller à `step` s'il appartient au parcours de `data` ; sinon, rester où l'on est. */
function moveTo(state: WizardState, data: WizardData, step: WizardStep | null): WizardState {
  if (!step || !stepsOf(data).includes(step)) return data === state.data ? state : { ...state, data };
  return { step, data };
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "patch":
      return { ...state, data: { ...state.data, ...action.data } };
    case "go":
      return moveTo(state, state.data, action.step);
    case "next":
      return moveTo(state, state.data, nextStep(stepsOf(state.data), state.step));
    case "back":
      return moveTo(state, state.data, previousStep(stepsOf(state.data), state.step));
    case "enter": {
      const data = { ...state.data, context: action.context, clientUrl: action.context.jellyfin.clientUrl ?? "" };
      return moveTo(state, data, action.step);
    }
    case "choose": {
      const before = state.data.context?.flow.selection?.url ?? null;
      const after = action.context.flow.selection?.url ?? null;
      const path = pathOf(action.context);
      // Un AUTRE Jellyfin : ce qui avait été préparé pour l'ancien ne vaut plus.
      const reset = before !== after ? PER_SERVER : {};
      const data = { ...state.data, ...reset, context: action.context, clientUrl: action.context.jellyfin.clientUrl ?? "" };
      return moveTo(state, data, path ? pathEntry(path) : null);
    }
  }
}
