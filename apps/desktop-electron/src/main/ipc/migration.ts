/**
 * Pont IPC de la restitution du stockage local.
 *
 * # Pourquoi un IPC SYNCHRONE, et depuis le preload
 *
 * Le preload s'exécute avant tout script de la page. Rejouer plus tard — depuis
 * `main.tsx` — ferait démarrer l'application DÉCONNECTÉE avant de se raviser :
 * l'utilisateur verrait l'écran de connexion, puis un rechargement. Un
 * `sendSync` est le seul moyen d'avoir la réponse avant que la page ne
 * commence à lire son stockage.
 *
 * Et surtout PAS `additionalArguments` : la charge utile monte à 4 Mo, une
 * ligne de commande n'est pas un véhicule pour ça.
 *
 * La logique, elle, vit dans `downloads/migrationDump.ts` — sans dépendance à
 * Electron, donc testable. Ici, uniquement le canal, la vérification de
 * l'émetteur et la trace.
 */

import { ipcMain, type IpcMainEvent } from "electron";
import { estBuildDebug } from "../debugBuild";
import { isAppOrigin } from "../appProtocol";
import { CANAL_MIGRATION_PRISE, CANAL_MIGRATION_RAPPORT } from "../channels";
import { takeMigrationDump } from "../downloads/migrationDump";
import { localDb } from "../localDb";

export function registerMigrationBridge(): void {
  ipcMain.on(CANAL_MIGRATION_PRISE, (event: IpcMainEvent) => {
    let entries: Record<string, string> | null = null;
    try {
      entries = consommer(event);
    } catch (error) {
      console.warn(`[migration] lecture impossible : ${String(error)}`);
    }
    // TOUJOURS répondre, y compris en cas d'échec : un `sendSync` laissé sans
    // réponse fige la page pour de bon, avant même son premier rendu.
    event.returnValue = entries;
  });

  ipcMain.on(CANAL_MIGRATION_RAPPORT, (event: IpcMainEvent, ecrites: unknown) => {
    if (!isAppOrigin(event.senderFrame?.url ?? "")) return;
    console.info(`[migration] ${String(ecrites)} cles ecrites dans le stockage local`);
  });
}

function consommer(event: IpcMainEvent): Record<string, string> | null {
  // L'origine, jamais l'URL : le routeur change de chemin en permanence. Le
  // refus est journalisé — « rien ne s'est passé » est le symptôme le plus
  // coûteux à diagnostiquer, et cette restitution n'a qu'une occasion.
  if (!isAppOrigin(event.senderFrame?.url ?? "")) {
    console.warn("[migration] emetteur refuse, restauration ignoree");
    return null;
  }

  const prise = takeMigrationDump(localDb(), Date.now());
  switch (prise.etat) {
    case "aucune":
    case "deja-faite":
      // Silencieux en production — c'est le cas de tous les lancements après
      // le premier. Sur un build de diagnostic on le dit quand même : sans
      // cette ligne, « aucune sauvegarde » et « le canal n'a jamais répondu »
      // se ressemblent trait pour trait dans le terminal.
      if (estBuildDebug()) console.info(`[migration] rien a rejouer (${prise.etat})`);
      return null;
    case "illisible":
      // Ni suppression ni trace côté base : un analyseur corrigé plus tard doit
      // pouvoir retenter. Le journal, lui, dit qu'il y avait quelque chose.
      console.warn(`[migration] sauvegarde illisible, conservee : ${prise.raison}`);
      return null;
    case "prise":
      console.info(
        `[migration] sauvegarde trouvee (${Object.keys(prise.entries).length} cles,` +
          ` origine ${prise.origine ?? "inconnue"}), ligne retiree`,
      );
      return prise.entries;
  }
}
