/**
 * Tient l'écran de démarrage à jour : l'état du serveur vers la fenêtre, les
 * boutons vers l'hôte. Tout ce qui touche Windows lui est PASSÉ : la règle se
 * teste sans fenêtre.
 *
 * Il se ferme de lui-même quand le serveur répond (le temps de lire « prêt »
 * ou « ouverture de l'assistant »), JAMAIS tant que la question du démarrage
 * avec Windows attend sa réponse ; un échec reste à l'écran, avec le journal.
 * Fermé à la croix, il ne revient pas : l'icône de la zone de notification
 * prend le relais, et une question sans réponse sera reposée au prochain
 * lancement.
 */
import type { ServerState } from "../supervisor/supervisor";
import type { StartupState } from "../tray/menuModel";
import { canAskStartup, splashView, type SplashActionId, type SplashContext, type SplashInput, type SplashView } from "./splashModel";

export interface SplashSurface {
  render(view: SplashView): void;
  close(): void;
}

export interface SplashDeps {
  surface: SplashSurface;
  context: SplashContext;
  setupPending: boolean;
  readStartup: () => Promise<StartupState>;
  startupAsked: () => boolean;
  /** Enregistre la réponse (et la marque comme donnée) ; les messages d'erreur sont ceux du menu. */
  answerStartup: (enabled: boolean) => Promise<void>;
  openLog: () => void;
  retry: () => Promise<void>;
  log: (line: string) => void;
  schedule?: (run: () => void, ms: number) => () => void;
}

/** Le temps de lire la dernière ligne avant que la fenêtre ne se ferme. */
export const CLOSE_DELAY_MS = { wizard: 1_500, ready: 2_500, answered: 1_500 } as const;

const defaultSchedule = (run: () => void, ms: number): (() => void) => {
  const timer = setTimeout(run, ms);
  return () => clearTimeout(timer);
};

export class SplashController {
  private input: SplashInput;
  private startupKnown = false;
  private closed = false;
  private cancelClose: (() => void) | null = null;
  private readonly schedule: NonNullable<SplashDeps["schedule"]>;

  constructor(private readonly deps: SplashDeps) {
    this.schedule = deps.schedule ?? defaultSchedule;
    this.input = { state: null, wizardOpening: false, setupPending: deps.setupPending, question: "hidden" };
  }

  get isOpen(): boolean {
    return !this.closed;
  }

  /** Lit l'état du démarrage avec Windows, puis pose la question s'il y a lieu. */
  async start(): Promise<void> {
    this.render();
    const startup = await this.deps.readStartup().catch((): StartupState => "unavailable");
    this.startupKnown = true;
    if (this.closed) return;
    if (canAskStartup(this.deps.startupAsked(), startup)) this.update({ question: "ask" });
    else this.update({});
  }

  /** L'état AFFICHÉ par l'hôte (port pris compris) ; `wizardOpening` : ce lancement ouvre l'assistant. */
  onServerState(state: ServerState, wizardOpening: boolean): void {
    if (this.closed) return;
    this.update({ state, wizardOpening: wizardOpening || (state.kind === "running" && this.input.wizardOpening) });
  }

  async onAction(id: SplashActionId): Promise<void> {
    if (this.closed) return;
    switch (id) {
      case "startup-yes":
      case "startup-no":
        return this.answer(id === "startup-yes");
      case "open-log":
        this.deps.openLog();
        return;
      case "retry":
        this.deps.log("écran de démarrage : nouvel essai demandé");
        return this.deps.retry();
      case "close":
        this.deps.log(`écran de démarrage fermé${this.input.question === "ask" ? " sans réponse à la question du démarrage" : ""}`);
        this.close();
        return;
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.cancelClose?.();
    this.cancelClose = null;
    this.deps.surface.close();
  }

  private async answer(enabled: boolean): Promise<void> {
    if (this.input.question !== "ask") return;
    this.update({ question: "saving" });
    this.deps.log(`écran de démarrage : démarrage avec Windows ${enabled ? "oui" : "non"}`);
    await this.deps.answerStartup(enabled).catch((error: unknown) => {
      this.deps.log(`démarrage avec Windows non réglé : ${error instanceof Error ? error.message : String(error)}`);
    });
    if (!this.closed) this.update({ question: { answered: enabled } });
  }

  private update(change: Partial<SplashInput>): void {
    this.input = { ...this.input, ...change };
    this.render();
    this.planClose();
  }

  private render(): void {
    if (!this.closed) this.deps.surface.render(splashView(this.input, this.deps.context));
  }

  /** Une seule fermeture programmée à la fois, recalculée à chaque changement. */
  private planClose(): void {
    this.cancelClose?.();
    this.cancelClose = null;
    const { state, question } = this.input;
    if (state?.kind !== "running" || !this.startupKnown) return;
    if (question === "ask" || question === "saving") return;
    const delay = typeof question === "object" ? CLOSE_DELAY_MS.answered : this.input.wizardOpening ? CLOSE_DELAY_MS.wizard : CLOSE_DELAY_MS.ready;
    this.cancelClose = this.schedule(() => this.close(), delay);
  }
}
