/**
 * L'installation GUIDÉE de Jellyfin, demandée depuis l'assistant
 * (`jellyfin.install`), en fond ; l'assistant suit `jellyfin.installStatus`.
 *
 *  1. refus d'office sur ARM64 (Jellyfin ne publie aucun `.exe` ARM64) et si
 *     l'interrupteur de l'app la coupe (le Store pourrait la refuser) ;
 *  2. la version : la plus récente notée `ok` dans `compat/jellyfin.json` ;
 *  3. l'empreinte et la taille, lues sur l'origine (`repo.ts`) ;
 *  4. le téléchargement vérifié (`download.ts`) — bloquant ;
 *  5. l'installateur officiel lancé en interactif, élevé, hors du paquet ;
 *  6. installé : Jellyfin est DÉMARRÉ d'office (installation simple — son
 *     installateur ne le lance pas), puis le fichier est effacé et
 *     l'assistant refait la détection.
 *
 * Tout échec renvoie vers la page officielle, puis la détection. Tentacle ne
 * met jamais Jellyfin à jour : une installation déjà là n'est pas touchée
 * (le serveur ne propose ce geste que s'il n'y a pas de Jellyfin).
 */
import { join } from "node:path";
import type { JellyfinInstallFailure, JellyfinInstallStatus, JellyfinInstallerOffer } from "../../protocol";
import type { DownloadOutcome } from "./download";
import type { ResolveOutcome } from "./repo";
import { installerFileName } from "./repo";
import { pickInstallVersion } from "./versionPick";

export interface InstallerDeps {
  /** La machine est ARM64 (aucun installateur). */
  arm64: boolean;
  /** L'interrupteur de l'app (`host-options.json`) : `false` coupe l'installation guidée. */
  enabled: boolean;
  readManifest: () => unknown;
  resolve: (repoNames: readonly string[]) => Promise<ResolveOutcome>;
  download: (url: string, destination: string, expected: { sha256: string; size: number | null }, onProgress: (received: number) => void) => Promise<DownloadOutcome>;
  launch: (file: string, directory: string) => Promise<{ ok: true; exitCode: number } | { ok: false; reason: "cancelled" | "blocked"; error: number }>;
  /** Où poser l'installateur le temps de l'installation. */
  folder: string;
  ensureFolder: (path: string) => void;
  remove: (path: string) => void;
  log: (line: string) => void;
  /**
   * Juste après un installateur sorti en 0 : démarrer Jellyfin (installation
   * simple). Rend une ligne de journal ; un échec ne fait pas échouer
   * l'installation — l'assistant garde « Démarrer Jellyfin ».
   */
  afterInstall?: () => Promise<string>;
}

/** NSIS rend 1 quand l'utilisateur ferme l'installateur ; 2 quand il l'abandonne en cours. */
const NSIS_CANCELLED = new Set([1, 2]);

export class JellyfinInstaller {
  private current: JellyfinInstallStatus = { phase: "idle", version: null, receivedBytes: 0, totalBytes: null, failure: null };

  constructor(private readonly deps: InstallerDeps) {}

  get offer(): JellyfinInstallerOffer {
    if (this.deps.arm64) return "unsupported_arch";
    return this.deps.enabled ? "available" : "disabled";
  }

  get busy(): boolean {
    return !["idle", "done", "failed"].includes(this.current.phase);
  }

  status(): JellyfinInstallStatus {
    return { ...this.current };
  }

  /** Rend l'état aussitôt ; l'installation continue en fond. Une installation en cours n'est pas relancée. */
  install(): JellyfinInstallStatus {
    if (this.busy) return this.status();
    const offer = this.offer;
    if (offer !== "available") return this.fail(offer, null);
    this.current = { phase: "resolving", version: null, receivedBytes: 0, totalBytes: null, failure: null };
    void this.run().catch((error: unknown) => {
      this.deps.log(`installation de Jellyfin interrompue : ${error instanceof Error ? error.message : String(error)}`);
      this.fail("installer_failed", this.current.version);
    });
    return this.status();
  }

  private fail(failure: JellyfinInstallFailure, version: string | null): JellyfinInstallStatus {
    this.current = { phase: "failed", version, receivedBytes: this.current.receivedBytes, totalBytes: this.current.totalBytes, failure };
    this.deps.log(`installation de Jellyfin : échec (${failure})`);
    return this.status();
  }

  private async run(): Promise<void> {
    const picked = pickInstallVersion(this.deps.readManifest());
    if (!picked) {
      this.fail("no_version", null);
      return;
    }
    this.current = { ...this.current, version: picked.version };
    const resolved = await this.deps.resolve(picked.repoNames);
    if (!resolved.ok) {
      this.fail(resolved.failure, picked.version);
      return;
    }
    const { installer } = resolved;
    this.deps.log(`installation de Jellyfin ${picked.version} : ${installer.url} (sha256 ${installer.sha256})`);
    this.deps.ensureFolder(this.deps.folder);
    const file = join(this.deps.folder, installerFileName(installer.repoName));
    this.current = { ...this.current, phase: "downloading", totalBytes: installer.size };
    const downloaded = await this.deps.download(installer.url, file, { sha256: installer.sha256, size: installer.size }, (received) => {
      this.current = { ...this.current, receivedBytes: received };
    });
    if (!downloaded.ok) {
      this.fail(downloaded.failure, picked.version);
      return;
    }
    this.current = { ...this.current, phase: "installing" };
    try {
      const launched = await this.deps.launch(file, this.deps.folder);
      if (!launched.ok) {
        this.deps.log(`installateur de Jellyfin non lancé (erreur ${launched.error})`);
        this.fail(launched.reason, picked.version);
        return;
      }
      if (launched.exitCode !== 0) {
        this.deps.log(`installateur de Jellyfin sorti en ${launched.exitCode}`);
        this.fail(NSIS_CANCELLED.has(launched.exitCode) ? "cancelled" : "installer_failed", picked.version);
        return;
      }
      this.deps.log("installateur de Jellyfin terminé");
      if (this.deps.afterInstall) {
        const line = await this.deps.afterInstall().catch((error: unknown) => `démarrage impossible : ${error instanceof Error ? error.message : String(error)}`);
        this.deps.log(`après l'installation : ${line}`);
      }
      this.current = { ...this.current, phase: "done" };
    } finally {
      this.deps.remove(file);
    }
  }
}
