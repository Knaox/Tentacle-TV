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
        return await handler.parseAndRun(raw);
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
