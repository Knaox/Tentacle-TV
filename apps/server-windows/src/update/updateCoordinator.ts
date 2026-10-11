/**
 * La mise à jour du paquet, pilotée par l'hôte : le Store ne met jamais à jour
 * un paquet qui tourne, et un serveur tourne toujours.
 *
 * 1. Une fois par jour, demander au Store s'il y a une mise à jour.
 * 2. Si Windows le permet, la TÉLÉCHARGER en silence, serveur en marche.
 * 3. Attendre un moment calme (`status` du serveur : aucune lecture, aucun
 *    redémarrage en attente ; sans réponse de Jellyfin, la nuit seulement).
 * 4. Arrêt propre (`shutdown { reason: "update" }`), sauvegarde de la base,
 *    `RegisterApplicationRestart`, puis installation.
 *
 * Sans voie silencieuse (« Mettre à jour automatiquement » coupé, réseau
 * limité…), rien ne se fait seul : le menu propose « Installer la mise à
 * jour », par le dialogue du Store.
 *
 * Tout ce qui touche Windows est INJECTÉ : la règle se teste sans Store.
 */
import type { ServerStatus } from "../protocol";
import type { BackupResult } from "./backups";
import type { InstallOutcome, StoreUpdateInfo } from "./updateTypes";

export type UpdateNotice = "available" | "failed" | "restart-needed";

export interface UpdateDeps {
  store: {
    check(): Promise<StoreUpdateInfo | null>;
    download(): Promise<InstallOutcome>;
    install(silent: boolean): Promise<InstallOutcome>;
  };
  server: {
    /** `null` : pas de réponse (serveur arrêté, d'avant le protocole, ou muet). */
    status(): Promise<ServerStatus | null>;
    running(): boolean;
    /** La version du serveur en service, pour le nom de la sauvegarde. */
    version(): string;
    stop(): Promise<void>;
    start(): Promise<void>;
  };
  backup(version: string): BackupResult;
  registerRestart(): boolean;
  notify(notice: UpdateNotice): void;
  log(line: string): void;
  now(): Date;
}

export const CHECK_EVERY_MS = 24 * 60 * 60_000;
export const FIRST_CHECK_MS = 10 * 60_000;
export const CALM_POLL_MS = 10 * 60_000;
/** Sans avis de Jellyfin sur les lectures, on ne coupe que la nuit (heure locale). */
export const NIGHT = { from: 3, to: 5 } as const;

/** Le serveur peut-il être arrêté sans couper personne ? */
export function isCalm(status: ServerStatus | null, serverRunning: boolean, now: Date): boolean {
  if (!serverRunning) return true;
  if (status === null || status.restartPending) return false;
  if (status.playbackActive === false) return true;
  if (status.playbackActive === null) return now.getHours() >= NIGHT.from && now.getHours() < NIGHT.to;
  return false;
}

export class UpdateCoordinator {
  private pending: StoreUpdateInfo | null = null;
  private downloaded = false;
  private applying = false;
  private timers: NodeJS.Timeout[] = [];

  constructor(private readonly deps: UpdateDeps) {}

  /** Une mise à jour attend : le menu propose de l'installer. */
  get updatePending(): boolean {
    return this.pending !== null && !this.applying;
  }

  start(): void {
    this.timers.push(setTimeout(() => void this.checkNow(), FIRST_CHECK_MS));
    this.timers.push(setInterval(() => void this.checkNow(), CHECK_EVERY_MS));
    this.timers.push(setInterval(() => void this.tick(), CALM_POLL_MS));
  }

  stop(): void {
    for (const timer of this.timers.splice(0)) clearTimeout(timer);
  }

  async checkNow(): Promise<void> {
    if (this.applying) return;
    const info = await this.deps.store.check().catch(() => null);
    if (info === null) {
      this.deps.log("mise à jour : le Store ne répond pas (ou hors paquet)");
      return;
    }
    if (!info.available) {
      this.pending = null;
      return;
    }
    const discovered = this.pending === null;
    this.pending = info;
    this.deps.log(`mise à jour disponible${info.mandatory ? " (obligatoire)" : ""}, ${info.canSilent ? "voie silencieuse" : "dialogue du Store"}`);
    if (info.canSilent && !this.downloaded) {
      const outcome = await this.deps.store.download().catch((): InstallOutcome => "failed");
      this.downloaded = outcome === "completed";
      this.deps.log(`mise à jour : téléchargement ${outcome}`);
    }
    if (discovered && !info.canSilent) this.deps.notify("available");
    await this.tick();
  }

  /** À chaque relève : installer en silence si tout est prêt et que le serveur est calme. */
  async tick(): Promise<void> {
    if (this.pending === null || !this.pending.canSilent || !this.downloaded || this.applying) return;
    const running = this.deps.server.running();
    const status = running ? await this.deps.server.status().catch(() => null) : null;
    if (!isCalm(status, running, this.deps.now())) return;
    await this.apply(true);
  }

  /** « Installer la mise à jour » du menu : tout de suite, par la voie que Windows permet. */
  async installNow(): Promise<void> {
    if (this.pending === null) return;
    await this.apply(this.pending.canSilent);
  }

  private async apply(silent: boolean): Promise<void> {
    if (this.applying) return;
    this.applying = true;
    try {
      const version = this.deps.server.version();
      this.deps.log(`mise à jour : arrêt du serveur ${version}`);
      await this.deps.server.stop();
      let backup: BackupResult;
      try {
        backup = this.deps.backup(version);
      } catch (error) {
        // Sans sauvegarde, pas de mise à jour : le serveur repart tel quel.
        this.deps.log(`mise à jour : sauvegarde impossible (${error instanceof Error ? error.message : String(error)}), abandon`);
        await this.deps.server.start();
        this.deps.notify("failed");
        return;
      }
      this.deps.log(backup.kind === "saved" ? `sauvegarde : ${backup.file}` : "sauvegarde : aucune base (installation neuve)");
      this.deps.log(`relance après mise à jour ${this.deps.registerRestart() ? "demandée à Windows" : "non enregistrée"}`);
      const outcome = await this.deps.store.install(silent).catch((): InstallOutcome => "failed");
      // Si Windows installe, il ferme l'hôte ici et le relance (RegisterApplicationRestart).
      this.deps.log(`mise à jour : installation ${outcome}`);
      await this.deps.server.start();
      if (outcome === "completed") {
        // Toujours là : l'installation est différée (UpdateWhileInUse=defer, Windows 11 24H2+).
        this.pending = null;
        this.downloaded = false;
        this.deps.notify("restart-needed");
      } else if (outcome !== "canceled") {
        this.deps.notify("failed");
      }
    } finally {
      this.applying = false;
    }
  }
}
