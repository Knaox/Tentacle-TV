/**
 * Le chef d'orchestre de l'hôte : l'état du serveur vers l'icône, les gestes
 * du menu vers le serveur. Tout ce qui touche Windows lui est PASSÉ
 * (`HostDeps`) : la règle se teste sans icône, sans boîte, sans serveur.
 */
import { format, type Strings } from "../i18n/strings";
import type { HostState } from "../data/hostState";
import type { StartupRegistration } from "../startup/startupRegistration";
import type { ShutdownReason } from "../protocol";
import type { ServerState } from "../supervisor/supervisor";
import { buildMenu, tooltip, type MenuCommand, type MenuEntry, type StartupState } from "../tray/menuModel";
import type { BalloonLevel } from "../win32/trayWindow";

export interface DesktopUi {
  setTooltip(text: string): void;
  notify(title: string, text: string, level: BalloonLevel): void;
  showMenu(entries: readonly MenuEntry[], x: number, y: number): MenuCommand | null;
  open(target: string): void;
  info(text: string): void;
  error(text: string): void;
  confirm(text: string): boolean;
}

export interface SupervisorLike {
  readonly serverState: ServerState;
  start(): void;
  stop(reason: ShutdownReason): Promise<void>;
  restart(reason: ShutdownReason): Promise<void>;
}

export interface HostDeps {
  strings: Strings;
  dataDir: string;
  ui: DesktopUi;
  supervisor: () => SupervisorLike;
  startup: StartupRegistration;
  log: (line: string) => void;
  logFile: () => string;
  isPortFree: (port: number) => Promise<boolean>;
  suggestPorts: (current: number) => Promise<number[]>;
  serverUrl: (port: number, path: string) => Promise<string>;
  state: { read(): HostState; write(state: HostState): void };
  /** Le code d'installation, s'il existe et que l'installation n'est pas finie. */
  setupCode: () => string | null;
  /** L'installation n'est pas finie (repli quand le serveur ne dit pas `appState`). */
  setupPending: () => boolean;
  deleteData: () => boolean;
  publicNetwork: () => Promise<boolean>;
  exit: (code: number) => void;
  /** La mise à jour par le Store ; absente hors paquet. */
  update?: { pending(): boolean; installNow(): Promise<void> };
  /**
   * L'état AFFICHÉ (port pris compris), pour l'écran de démarrage ;
   * `wizardOpening` : ce démarrage ouvre l'assistant dans le navigateur.
   */
  onDisplayState?: (state: ServerState, wizardOpening: boolean) => void;
}

export class HostController {
  private state: HostState;
  /** Le port était pris AVANT le lancement : l'hôte n'a rien lancé. */
  private portBlocked = false;
  private lastNotified = "";
  private networkChecked = false;

  constructor(private readonly deps: HostDeps) {
    this.state = deps.state.read();
  }

  get port(): number {
    return this.state.port;
  }

  /** La question « Lancer au démarrage de Windows ? » a reçu sa réponse (écran de démarrage ou menu). */
  get startupAsked(): boolean {
    return this.state.startupAsked;
  }

  displayState(): ServerState {
    return this.portBlocked ? { kind: "blocked", cause: "port_in_use" } : this.deps.supervisor().serverState;
  }

  /** Lance le serveur si son port est libre ; sinon le dit, sans boucler. */
  async startServer(): Promise<void> {
    if (!(await this.deps.isPortFree(this.state.port))) {
      this.deps.log(`port ${this.state.port} déjà utilisé : serveur non lancé`);
      this.portBlocked = true;
      this.onServerState(this.displayState());
      return;
    }
    this.portBlocked = false;
    this.deps.supervisor().start();
  }

  onServerState(state: ServerState): void {
    const shown = this.portBlocked ? this.displayState() : state;
    this.deps.ui.setTooltip(tooltip(this.deps.strings, shown, this.state.port));
    if (shown.kind === "blocked") this.notifyBlocked(shown.cause);
    else this.lastNotified = "";
    const wizardOpening = shown.kind === "running" && this.claimWizard(shown.appState);
    this.deps.onDisplayState?.(shown, wizardOpening);
    if (shown.kind === "running") void this.onRunning(wizardOpening);
  }

  /** Réponse de l'écran de démarrage : réglée comme par le menu, et plus jamais redemandée. */
  async answerStartup(enabled: boolean): Promise<void> {
    const current = await this.deps.startup.read().catch((): StartupState => "unavailable");
    const on = current === "enabled" || current === "enabled-by-policy";
    if (on === enabled) {
      this.persist({ ...this.state, startupAsked: true });
      this.deps.log(`démarrage avec Windows : ${current}, gardé`);
      return;
    }
    await this.toggleStartup(current);
  }

  /** Clic sur l'icône. */
  async openMenu(x: number, y: number): Promise<void> {
    const [freePorts, startup] = await Promise.all([
      this.deps.suggestPorts(this.state.port),
      this.deps.startup.read().catch((): StartupState => "unavailable"),
    ]);
    const entries = buildMenu({
      strings: this.deps.strings,
      state: this.displayState(),
      port: this.state.port,
      startup,
      freePorts,
      hasSetupCode: this.deps.setupCode() !== null,
      updatePending: this.deps.update?.pending() ?? false,
    });
    const command = this.deps.ui.showMenu(entries, x, y);
    if (command !== null) await this.run(command, startup);
  }

  async openAdmin(): Promise<void> {
    this.deps.ui.open(await this.deps.serverUrl(this.state.port, "/admin"));
  }

  async run(command: MenuCommand, startup: StartupState): Promise<void> {
    switch (command.kind) {
      case "open-admin":
        return this.openAdmin();
      case "toggle-startup":
        return this.toggleStartup(startup);
      case "change-port":
        return this.changePort(command.port);
      case "setup-code": {
        const code = this.deps.setupCode();
        this.deps.ui.info(code === null ? this.deps.strings.noSetupCode : format(this.deps.strings.setupCodeBody, { code }));
        return;
      }
      case "open-log":
        return this.openLog();
      case "restart":
        return this.restartServer();
      case "install-update":
        this.deps.log("installation de la mise à jour demandée depuis le menu");
        return this.deps.update?.installNow();
      case "delete-data":
        return this.deleteData();
      case "quit":
        return this.quit();
    }
  }

  openLog(): void {
    this.deps.log("journal ouvert");
    this.deps.ui.open(this.deps.logFile());
  }

  async restartServer(): Promise<void> {
    await this.deps.supervisor().stop("restart");
    return this.startServer();
  }

  async quit(): Promise<void> {
    this.deps.log("Quitter");
    await this.deps.supervisor().stop("quit");
    this.deps.exit(0);
  }

  /**
   * L'assistant s'ouvre UNE fois, au premier démarrage réussi d'une
   * installation pas finie : `true` si c'est maintenant (l'écran de démarrage
   * le dit), et ce n'est plus jamais le cas ensuite.
   */
  private claimWizard(appState: string | null): boolean {
    if (this.state.wizardOpened) return false;
    this.persist({ ...this.state, wizardOpened: true });
    return appState !== null ? appState.startsWith("setup") : this.deps.setupPending();
  }

  private async onRunning(openWizard: boolean): Promise<void> {
    // Sur l'adresse locale, jamais `localhost` (un téléphone ne la joindrait pas).
    if (openWizard) this.deps.ui.open(await this.deps.serverUrl(this.state.port, "/"));
    if (!this.networkChecked) {
      this.networkChecked = true;
      if (await this.deps.publicNetwork()) {
        this.deps.ui.notify(this.deps.strings.publicNetworkTitle, this.deps.strings.publicNetworkBody, "warning");
      }
    }
  }

  private notifyBlocked(cause: string): void {
    if (this.lastNotified === cause) return;
    this.lastNotified = cause;
    const s = this.deps.strings;
    const text =
      cause === "port_in_use"
        ? format(s.portBusyBody, { port: this.state.port })
        : cause === "already_running"
          ? s.alreadyRunningBody
          : cause === "data_dir_unwritable"
            ? format(s.dataUnwritableBody, { dir: this.deps.dataDir })
            : s.crashLoopBody;
    this.deps.ui.notify(s.appName, text, "warning");
  }

  private async toggleStartup(current: StartupState): Promise<void> {
    const s = this.deps.strings;
    if (current === "disabled-by-user") {
      if (!this.state.startupAsked) this.persist({ ...this.state, startupAsked: true });
      this.deps.ui.info(s.startupDisabledByUser);
      this.deps.ui.open("ms-settings:startupapps");
      return;
    }
    const wanted = current !== "enabled";
    // Réglé à la main : la question de l'écran de démarrage n'a plus lieu d'être.
    if (!this.state.startupAsked) this.persist({ ...this.state, startupAsked: true });
    const result = await this.deps.startup.set(wanted).catch((): StartupState => "unavailable");
    this.deps.log(`démarrage avec Windows : ${current} → ${result}`);
    if (result === "disabled-by-user") this.deps.ui.info(s.startupDisabledByUser);
    else if (result === "disabled-by-policy") this.deps.ui.info(s.startupDisabledByPolicy);
    else if (result === "unavailable") this.deps.ui.error(s.startupUnavailable);
  }

  private async changePort(port: number): Promise<void> {
    if (port === this.state.port) return;
    if (!this.deps.ui.confirm(format(this.deps.strings.changePortConfirm, { port }))) return;
    this.deps.log(`port ${this.state.port} → ${port}`);
    await this.deps.supervisor().stop("port-change");
    this.persist({ ...this.state, port });
    await this.startServer();
  }

  private async deleteData(): Promise<void> {
    const s = this.deps.strings;
    if (!this.deps.ui.confirm(format(s.deleteDataConfirm, { dir: this.deps.dataDir }))) return;
    this.deps.log("suppression des données demandée");
    await this.deps.supervisor().stop("quit");
    if (!this.deps.deleteData()) this.deps.ui.error(format(s.deleteDataFailed, { dir: this.deps.dataDir }));
    this.deps.exit(0);
  }

  private persist(state: HostState): void {
    this.state = state;
    try {
      this.deps.state.write(state);
    } catch (error) {
      this.deps.log(`host.json non écrit : ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
