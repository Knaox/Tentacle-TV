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
import type { HoldState } from "./engineHold";
import type { Creds, ServerPrepare } from "./worker";

/** Ce que la plateforme rend d'une finalisation : voir `EngineDeps.finalizeMedia`. */
export type FinalizeVerdict = "ok" | "unusable" | "noaudio" | void;

export interface EngineDeps {
  db: DatabaseHandle;
  /** Relu à chaque usage : l'utilisateur peut changer de racine. */
  volume: () => Volume;
  driver: TransferDriver;
  makeFetcher: (token: string) => FetchBytes;
  /** Un récupérateur SANS aucun jeton (pochette https d'un autre hôte) ; absent : ces pochettes ne sont pas gardées. */
  makePublicFetcher?: () => FetchBytes;
  emit: (event: EngineEvent, payload: unknown) => void;
  now: () => number;
  /**
   * Échelle des relances automatiques après une erreur réparable. Absente :
   * `RETRY_DELAYS_MS`. Tableau vide : aucune relance (le banc d'essai).
   */
  retryDelaysMs?: readonly number[];
  /**
   * Échelle des relances d'une COUPURE réseau (pause système). Absente :
   * `NETWORK_RETRY_DELAYS_MS`, dont la dernière marche se répète. Tableau vide :
   * aucune relance seule, la pause attend un évènement (le banc d'essai).
   */
  networkRetryDelaysMs?: readonly number[];
  /**
   * Combien de relances d'une coupure repartent SANS délai, maintenant.
   * Consultée à chaque coupure. L'iPhone derrière en veut quelques-unes : son
   * JavaScript, suspendu, ne verrait jamais sonner un minuteur, et la tâche
   * remise aussitôt au système attend le réseau toute seule. Absente : aucune.
   */
  immediateNetworkRetries?: () => number;
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
   * Ce qui doit tenir la plateforme au-delà des transferts en vol : une relance
   * programmée, une attente demandée par le serveur (`engineHold.ts`). Notifiée
   * à chaque changement. Android y tient son service et ses minuteurs, le bureau
   * sa fin de transferts fenêtre fermée.
   */
  onHeld?: (state: HoldState) => void;
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
   * Places des TITRES DE MUSIQUE (`source_path`), au-delà de `parallelLimit` :
   * leur temps part dans la préparation du serveur, pas dans la bande passante
   * (`musicLane.ts`). Jamais à côté d'un film. Absente (mobile) : aucune de plus.
   */
  musicParallelLimit?: () => number;
  /**
   * Le serveur sait-il préparer un fichier Allégé lui-même (capacité
   * `offline.serverPrepare`) ? Consultée à chaque transfert. Oui : le fichier
   * se prépare sur le serveur que l'application soit là ou non, se lit pendant
   * qu'il s'écrit et se reprend par plage (`worker.ts`). `null` ou absente
   * (bureau, serveur d'avant) : le transcodage tiré en direct, comme avant.
   */
  serverPrepare?: () => ServerPrepare | null;
  /**
   * Finalise un fichier ALLÉGÉ avant `complete`. Le transcodage progressif de
   * Jellyfin est un MP4 fragmenté (sans index ni durée) : mpv s'en accommode,
   * les lecteurs natifs du mobile non — la plateforme le remuxe en MP4 indexé,
   * sur place. Rejet = erreur d'entrée-sortie (mieux qu'un titre « prêt »
   * illisible). Absente (bureau) : rien à faire.
   *
   * `"unusable"` dit autre chose qu'un échec : le média est arrivé sans son
   * index, aucun remux ne le sauvera, et il faut le retélécharger.
   *
   * `"noaudio"` en dit encore autre chose : le remux a produit une image SANS
   * SON. Retélécharger donnerait le même fichier — on s'arrête, et on le dit.
   */
  finalizeMedia?: (absPath: string, file: { variant: string; relPath: string }) => Promise<FinalizeVerdict>;
}
