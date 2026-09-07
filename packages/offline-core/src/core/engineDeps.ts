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

/** Ce que la plateforme rend d'une finalisation : voir `EngineDeps.finalizeMedia`. */
export type FinalizeVerdict = "ok" | "unusable" | void;

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
  /**
   * Défaillance INATTENDUE : une exception qu'aucun chemin prévu n'explique.
   * Le transfert est déjà retombé sur ses pieds quand ceci est appelé — c'est
   * une TRACE, pas une gestion d'erreur. Sans elle, le code `unexpected` reste
   * un mystère : c'est exactement ce qui est arrivé le jour où une pause s'est
   * soldée par une erreur d'écriture que personne n'a pu expliquer.
   */
  onUnexpected?: (context: string, error: unknown) => void;
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
   * Combien de transferts peuvent tourner ensemble, MAINTENANT. Consultée à
   * chaque `pump`.
   *
   * Un seul à la fois est la bonne réponse quand l'application est là : deux
   * se disputent la bande passante, le disque et le processeur de la
   * finalisation. Elle devient FAUSSE quand le système suspend le JavaScript
   * — iPhone verrouillé : la file est pilotée par le JavaScript, et la seule
   * tâche déjà remise au système continue pendant que les suivantes ne
   * partent jamais. En enfiler plusieurs avant la suspension les laisse
   * aboutir. Absente (bureau) : `MAX_PARALLEL`.
   */
  parallelLimit?: () => number;
  /**
   * Finalise un fichier ALLÉGÉ avant `complete`. Le transcodage progressif de
   * Jellyfin est un MP4 fragmenté (sans index ni durée) : mpv s'en accommode,
   * les lecteurs natifs du mobile non — la plateforme le remuxe en MP4 indexé,
   * sur place. Rejet = erreur d'entrée-sortie (mieux qu'un titre « prêt »
   * illisible). Absente (bureau) : rien à faire.
   *
   * `"unusable"` dit autre chose qu'un échec : le média est arrivé sans son
   * index, aucun remux ne le sauvera, et il faut le retélécharger.
   */
  finalizeMedia?: (absPath: string, file: { variant: string; relPath: string }) => Promise<FinalizeVerdict>;
}
