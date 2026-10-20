/**
 * UNE préparation tenue par le serveur : le fichier Allégé d'un titre, écrit
 * sur le disque du serveur pendant que Jellyfin le transcode, QUE LE TÉLÉPHONE
 * SOIT LÀ OU NON.
 *
 * Avant, le téléphone tirait lui-même le transcodage en direct : la
 * préparation n'avançait que tant que sa connexion tenait. Application
 * quittée, téléphone verrouillé, réseau coupé une seconde, et tout repartait
 * de zéro — quand ça repartait (alpha mobile, 21/10). Ici le serveur prépare
 * seul ; le téléphone LIT le fichier qui grandit (`prepareTail.ts`), le
 * reprend par plage d'octets après une coupure, et le serveur le prévient
 * quand c'est prêt (`preparePush.ts`).
 *
 * Aucune décision ici : un état, des octets, des lecteurs, et des abonnés à
 * qui dire « ça a bougé ».
 */

import { randomUUID } from "node:crypto";

export type PrepareState = "running" | "done" | "failed";

export class PrepareJob {
  /** Identifiant de CETTE préparation : l'ETag des réponses, jamais la clé. */
  readonly id = randomUUID();
  state: PrepareState = "running";
  /** Octets écrits sur le disque — ce qu'un lecteur peut déjà lire. */
  bytes = 0;
  /** Lectures en cours (`prepareTail.ts`). */
  readers = 0;
  /** Le téléphone n'en veut plus : à effacer dès que plus personne ne lit. */
  released = false;
  doneAt: number | null = null;
  lastAccessAt: number;
  /** Les étiquettes des appareils qui l'ont lue : eux seuls la reprennent par plage. */
  readonly readerTags = new Set<string>();
  /** Arrête la préparation (connexion à Jellyfin) ; posé par le lanceur. */
  abort: () => void = () => {};
  private readonly listeners = new Set<() => void>();

  constructor(
    /** Clé de la demande (`prepareKey`) : le compte, le titre, le palier, les pistes. */
    readonly key: string,
    readonly userId: string,
    readonly itemId: string,
    /** Le fichier en cours d'écriture, renommé en `finalPath` une fois complet. */
    readonly partPath: string,
    readonly finalPath: string,
    nowMs: number,
  ) {
    this.lastAccessAt = nowMs;
  }

  /** Où lire maintenant. Un descripteur déjà ouvert survit au renommage. */
  get path(): string {
    return this.state === "done" ? this.finalPath : this.partPath;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
