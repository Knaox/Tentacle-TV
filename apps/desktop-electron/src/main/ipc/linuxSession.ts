/**
 * Le choix de session graphique (Auto / Wayland / X11), exposé aux Préférences.
 *
 * Le fichier `session-graphique.json` et sa lecture au démarrage existaient
 * (`linux/graphicsSession.ts`) mais rien ne les branchait à l'interface :
 * le réglage ne se changeait que par variable d'environnement ou à la main.
 * Ces deux commandes ferment la boucle — la décision reste figée au
 * démarrage, l'écriture ne prend effet qu'à la relance (`relaunch()`, que la
 * page demande).
 *
 * Enregistrées sur Linux SEULEMENT : les capacités annoncées à la page valent
 * porte (`supportsLinuxSession()`), le réglage disparaît de lui-même ailleurs.
 */

import { z } from "zod";
import { saveSessionChoice, currentSession } from "../linux/session";
import { CommandRegistry } from "./registry";

const NO_ARGS = z.object({}).passthrough();
const SET = z.object({ choice: z.enum(["auto", "wayland", "x11"]) });

export function registerLinuxSessionCommands(registry: CommandRegistry): void {
  if (process.platform !== "linux") return;
  registry
    .add("linux_session_get", {
      schema: NO_ARGS,
      run: () => {
        const decided = currentSession();
        return {
          choice: decided?.choice ?? "auto",
          montage: decided?.montage ?? null,
          bureau: decided?.session ?? null,
        };
      },
    })
    .add("linux_session_set", {
      schema: SET,
      run: ({ choice }) => {
        saveSessionChoice(choice);
      },
    });
}
