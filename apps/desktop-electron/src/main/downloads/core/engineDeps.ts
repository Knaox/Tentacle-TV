/**
 * Ce que l'orchestrateur attend de sa plateforme : base, disque, pilote de
 * transfert, horloge, et les quelques crochets que le bureau et le téléphone
 * remplissent différemment.
 *
 * Sorti de `engine.ts` pour lui laisser de la place — l'interface est plus
 * longue que la classe ne peut se le permettre, et elle change plus souvent.
 */

import type { DatabaseHandle, EngineEvent, TransferDriver, Volume } from "./adapters";
import type { FetchBytes } from "./fetcher";
import type { Creds } from "./worker";

export interface EngineDeps {
  db: DatabaseHandle;
  /** Relu à chaque usage : l'utilisateur peut changer de racine. */
  volume: () => Volume;
  driver: TransferDriver;
  makeFetcher: (token: string) => FetchBytes;
  emit: (event: EngineEvent, payload: unknown) => void;
  now: () => number;
  /**
   * Échelle des relances automatiques après une erreur réparable. Absente :
   * `RETRY_DELAYS_MS`. Tableau vide : aucune relance (le banc d'essai).
   */
  retryDelaysMs?: readonly number[];
  /** Lancé au démarrage du moteur — réparation et purge (branchés plus tard). */
  onStarted?: (creds: Creds) => void;
  /**
   * Bascule « au moins un transfert en cours ». Notifiée AUX SEULES
   * TRANSITIONS, jamais à chaque bloc reçu : c'est elle qui pose et rend
   * l'anti-suspension du système (`downloadsRuntime.ts`).
   */
  onBusy?: (busy: boolean) => void;
  /**
   * Les transferts peuvent-ils PARTIR maintenant (réseau autorisé, serveur
   * tenu pour joignable) ? Consultée à chaque `pump`, jamais mise en cache.
   * Refus : ce qui attend une place passe en pause SYSTÈME, que
   * `resumeSystemPauses` relèvera. Absente (bureau) : toujours oui.
   */
  canTransfer?: () => boolean;
  /**
   * Finalise un fichier ALLÉGÉ avant `complete`. Le transcodage progressif de
   * Jellyfin est un MP4 fragmenté (sans index ni durée) : mpv s'en accommode,
   * les lecteurs natifs du mobile non — la plateforme le remuxe en MP4 indexé,
   * sur place. Rejet = erreur d'entrée-sortie (mieux qu'un titre « prêt »
   * illisible). Absente (bureau) : rien à faire.
   */
  finalizeMedia?: (absPath: string, file: { variant: string; relPath: string }) => Promise<void>;
}
