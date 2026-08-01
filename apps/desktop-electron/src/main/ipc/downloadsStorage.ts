/**
 * Commandes de stockage : racine, espace disque, base des ressources locales.
 *
 * Les codes d'erreur rendus ici sont STABLES et lus tels quels par
 * l'interface (`api.ts`) : `root-not-empty`, `root-not-writable`.
 */

import { z } from "zod";
import { downloadsRoot } from "../downloadsRuntime";
import { freeSpace, setRoot } from "../downloads/paths";
import { diskUsage } from "../downloads/store";
import { localDb } from "../localDb";
import { LOCAL_ASSET_TOKEN, LOCAL_HOST } from "../localAssets";
import { APP_SCHEME } from "../appProtocol";
import { CommandRegistry } from "./registry";

const NO_ARGS = z.object({}).passthrough();
const SET_ROOT = z.object({ path: z.string().min(1) });

export function registerDownloadsStorageCommands(registry: CommandRegistry): void {
  registry
    .add("downloads_get_root", { schema: NO_ARGS, run: () => downloadsRoot() })
    .add("downloads_set_root", {
      schema: SET_ROOT,
      run: ({ path }) => setRoot(localDb(), path),
    })
    .add("downloads_disk_free", { schema: NO_ARGS, run: () => freeSpace(downloadsRoot()) })
    .add("downloads_disk_usage", { schema: NO_ARGS, run: () => diskUsage(localDb()) })
    .add("downloads_asset_base", {
      schema: NO_ARGS,
      run: () => {
        // La racine est résolue ici pour que `media/` et `meta/` existent avant
        // la première image demandée — le protocole, lui, ne les crée pas.
        downloadsRoot();
        // ⚠️ `token` doit rester NON VIDE : `localFiles.ts` prendrait une
        // chaîne vide pour un échec et n'afficherait plus aucune affiche.
        return { base: `${APP_SCHEME}://${LOCAL_HOST}`, token: LOCAL_ASSET_TOKEN };
      },
    });
}
