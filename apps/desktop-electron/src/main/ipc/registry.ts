/**
 * Table des commandes exposées à la page, et leur enregistrement.
 *
 * Deux gardes, systématiques et non négociables :
 *
 *  1. **L'émetteur est vérifié.** Un message d'IPC ne vient pas forcément de
 *     notre page — la checklist Electron en fait un point à part entière.
 *  2. **Les arguments sont validés** par un schéma zod. Une commande native
 *     qui reçoit ce que la page lui envoie sans le regarder, c'est la porte
 *     ouverte au parcours de chemin et à l'injection.
 *
 * Une commande dont le schéma rejette n'est jamais exécutée.
 */

import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type { ZodType } from "zod";
import { isAllowedCommand, type Command } from "../channels";
import { isAppOrigin } from "../appProtocol";
import { redactSecrets } from "./redaction";

/** Poignée d'une commande : son schéma d'entrée et son exécution. */
export interface Handler<T> {
  schema: ZodType<T>;
  run: (args: T) => Promise<unknown> | unknown;
}

/**
 * Poignée dont le type d'entrée a été effacé.
 *
 * L'effacement se fait par une FERMETURE créée dans `add`, qui capture le
 * type concret : validation et exécution restent donc typées ensemble, sans
 * le moindre transtypage.
 */
interface ErasedHandler {
  parseAndRun: (raw: unknown) => Promise<unknown>;
}

/** Rassemble les poignées avant l'enregistrement en une passe. */
export class CommandRegistry {
  private readonly handlers = new Map<Command, ErasedHandler>();

  add<T>(command: Command, handler: Handler<T>): this {
    if (!isAllowedCommand(command)) {
      throw new Error(`commande absente de la liste blanche: ${command}`);
    }
    this.handlers.set(command, {
      parseAndRun: async (raw) => {
        const parsed = handler.schema.safeParse(raw ?? {});
        if (!parsed.success) {
          throw new Error(`arguments invalides pour ${command}: ${parsed.error.message}`);
        }
        return await handler.run(parsed.data);
      },
    });
    return this;
  }

  /** Commandes déclarées mais pas encore implémentées — utile en migration. */
  missing(all: readonly Command[]): Command[] {
    return all.filter((c) => !this.handlers.has(c));
  }

  /**
   * Commandes réellement branchées, annoncées à la page.
   *
   * C'est ce qui permet à l'interface de masquer proprement ce que ce shell ne
   * sait pas encore faire, au lieu d'afficher un bouton qui rejette. La liste
   * s'allonge d'elle-même à mesure que les phases livrent : rien à tenir à jour
   * à la main, et rien à retirer une fois la migration finie.
   */
  implemented(): Command[] {
    return [...this.handlers.keys()];
  }

  install(): void {
    for (const [command, handler] of this.handlers) {
      ipcMain.handle(`tentacle:${command}`, async (event, raw: unknown) => {
        if (!isTrustedSender(event)) {
          throw new Error(`emetteur refuse pour ${command}`);
        }
        try {
          return await handler.parseAndRun(raw);
        } catch (error) {
          // Le motif du refus n'allait NULLE PART.
          //
          // Côté page, chaque appel natif est enveloppé dans un `catch` qui rend
          // `null` — c'est délibéré, l'interface ne doit pas se briser parce que
          // le shell ne sait pas faire quelque chose. Mais le message, lui,
          // mourait là : « Impossible de lancer le téléchargement » et rien
          // d'autre, alors que le processus principal savait exactement si
          // c'était le schéma, la validation du lot ou le disque.
          //
          // Journalisé ici et pas dans chaque commande : c'est le seul point de
          // passage des vingt et quelques, et il ne peut pas être oublié.
          //
          // MASQUÉ pour la même raison : certaines commandes manipulent des URL
          // qui portent un jeton (`?api_key=`), et un journal se copie dans un
          // ticket. Le masquage est ici, au point de passage, plutôt que dans
          // chaque message — voir `redaction.ts`.
          console.error(`[ipc] ${command} a echoue : ${redactSecrets(String(error))}`);
          throw error;
        }
      });
    }
  }
}

/**
 * L'émetteur est-il notre propre page ?
 *
 * On compare l'ORIGINE, pas l'URL : le routeur change de chemin en
 * permanence, mais jamais d'origine. Le comment de la comparaison est dans
 * `isAppOrigin` — passer par `URL.origin` refuserait tout.
 */
export function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const frame = event.senderFrame;
  if (!frame) return false;
  return isAppOrigin(frame.url);
}
