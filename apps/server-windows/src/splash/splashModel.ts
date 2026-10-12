/**
 * L'écran de démarrage, en données : ce qu'il dit selon l'état du serveur, la
 * question « Lancer au démarrage de Windows ? », et les boutons. Pur — la
 * fenêtre (`win32/splashWindow.ts`) ne fait que le dessiner, le contrôleur
 * (`splashController.ts`) que le tenir à jour.
 *
 * Les étapes sont celles que le serveur ANNONCE (`tentacle:progress`), jamais
 * devinées à l'horloge : préparation par l'hôte, serveur, base, extensions,
 * puis l'assistant (première installation) ou « prêt ».
 */
import { format, type Strings } from "../i18n/strings";
import type { SplashStrings } from "../i18n/splashStrings";
import type { ServerState } from "../supervisor/supervisor";
import type { StartupState } from "../tray/menuModel";

export type SplashStep = "launch" | "server" | "database" | "extensions" | "wizard" | "ready";

export type SplashPhase =
  | { kind: "progress"; step: SplashStep }
  /** Le serveur répond : « prêt », ou l'assistant qui s'ouvre. */
  | { kind: "done"; step: "wizard" | "ready" }
  | { kind: "failed"; body: string };

/** Où en est la question : à poser, réponse en cours d'écriture, ou répondue à l'instant. */
export type StartupQuestion = "hidden" | "ask" | "saving" | { answered: boolean };

export type SplashActionId = "startup-yes" | "startup-no" | "open-log" | "retry" | "close";

export interface SplashButton {
  id: SplashActionId;
  label: string;
  primary: boolean;
}

export interface SplashView {
  status: string;
  detail: string | null;
  tone: "progress" | "done" | "error";
  /** 0 à 1 ; `null` : pas de barre (échec). */
  progress: number | null;
  question: { text: string; hint: string } | null;
  buttons: SplashButton[];
}

export interface SplashInput {
  /** `null` : l'hôte prépare encore (dossier de données), le serveur n'est pas lancé. */
  state: ServerState | null;
  /** Ce lancement ouvre l'assistant dans le navigateur (première installation). */
  wizardOpening: boolean;
  /** L'installation n'est pas finie : le premier démarrage peut être long, on le dit. */
  setupPending: boolean;
  question: StartupQuestion;
}

const PROGRESS: Readonly<Record<SplashStep, number>> = {
  launch: 0.08,
  server: 0.3,
  database: 0.55,
  extensions: 0.8,
  wizard: 1,
  ready: 1,
};

/** Ce que les textes d'échec citent. */
export interface SplashContext {
  strings: Strings;
  splash: SplashStrings;
  dataDir: string;
  port: number;
}

export function splashPhase(state: ServerState | null, wizardOpening: boolean, context: SplashContext): SplashPhase {
  const { strings } = context;
  if (state === null) return { kind: "progress", step: "launch" };
  switch (state.kind) {
    case "starting":
      return { kind: "progress", step: state.stage ?? "server" };
    case "running":
      return { kind: "done", step: wizardOpening ? "wizard" : "ready" };
    case "stopped":
      return { kind: "failed", body: "" };
    case "blocked":
      switch (state.cause) {
        case "port_in_use":
          return { kind: "failed", body: format(strings.portBusyBody, { port: context.port }) };
        case "already_running":
          return { kind: "failed", body: strings.alreadyRunningBody };
        case "data_dir_unwritable":
          return { kind: "failed", body: format(strings.dataUnwritableBody, { dir: context.dataDir }) };
        case "crash_loop":
          return { kind: "failed", body: strings.crashLoopBody };
      }
  }
}

/** La question n'a de sens que si Windows nous laisse régler le démarrage. */
export function canAskStartup(asked: boolean, startup: StartupState): boolean {
  return !asked && (startup === "enabled" || startup === "disabled" || startup === "disabled-by-user");
}

/**
 * Montrer l'écran ? Toujours quand l'utilisateur lance l'app ; au démarrage de
 * session (tâche de démarrage), seulement s'il reste quelque chose à lui dire —
 * une installation pas finie, ou la question jamais répondue.
 */
export function shouldShowSplash(input: { atLogon: boolean; setupPending: boolean; startupAsked: boolean }): boolean {
  return !input.atLogon || input.setupPending || !input.startupAsked;
}

const STEP_TEXT: Readonly<Record<SplashStep, keyof SplashStrings>> = {
  launch: "stepLaunch",
  server: "stepServer",
  database: "stepDatabase",
  extensions: "stepExtensions",
  wizard: "stepWizard",
  ready: "stepReady",
};

function questionDetail(question: StartupQuestion, s: SplashStrings): string | null {
  if (question === "saving") return s.startupSaving;
  if (typeof question === "object") return question.answered ? s.startupOnDone : s.startupOffDone;
  return null;
}

export function splashView(input: SplashInput, context: SplashContext): SplashView {
  const s = context.splash;
  const phase = splashPhase(input.state, input.wizardOpening, context);
  if (phase.kind === "failed") {
    return {
      status: s.failedTitle,
      detail: phase.body || s.stoppedBody,
      tone: "error",
      progress: null,
      question: null,
      buttons: [
        { id: "retry", label: s.retry, primary: true },
        { id: "open-log", label: s.openLog, primary: false },
        { id: "close", label: s.close, primary: false },
      ],
    };
  }
  const asking = input.question === "ask" || input.question === "saving";
  const hint =
    phase.kind === "done"
      ? phase.step === "wizard"
        ? s.wizardHint
        : s.trayHint
      : input.setupPending
        ? s.firstRunHint
        : null;
  return {
    status: s[STEP_TEXT[phase.step]],
    detail: questionDetail(input.question, s) ?? hint,
    tone: phase.kind === "done" ? "done" : "progress",
    progress: PROGRESS[phase.step],
    question: asking ? { text: s.startupQuestion, hint: s.startupHint } : null,
    buttons:
      input.question === "ask"
        ? [
            { id: "startup-yes", label: s.startupYes, primary: true },
            { id: "startup-no", label: s.startupNo, primary: false },
          ]
        : [],
  };
}
