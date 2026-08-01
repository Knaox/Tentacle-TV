/**
 * Commandes de session hors ligne : profil et droits en cache, photo de profil.
 *
 * Enregistrer `session_cache_get` fait passer `supportsOfflineSession()` à vrai
 * côté page : le mode hors ligne, les droits en cache et l'avatar hors ligne
 * réapparaissent d'eux-mêmes. Aucune modification d'`apps/web`.
 */

import { app } from "electron";
import path from "node:path";
import { z } from "zod";
import * as avatar from "../downloads/avatar";
import * as session from "../downloads/session";
import { localDb } from "../localDb";
import { CommandRegistry } from "./registry";

/** Un identifiant Jellyfin, tel que la page l'envoie. */
const USER_ID = z.string().min(1).max(128);

const USER = z.object({ userId: USER_ID });

const SET_SESSION = z.object({
  userId: USER_ID,
  profileJson: z.string(),
  // La page envoie `policyJson ?? null` ; `null` CONSERVE la policy en cache.
  policyJson: z.string().nullish(),
});

const PUT_AVATAR = z.object({
  userId: USER_ID,
  // Première barrière, avant tout décodage : le plafond réel est en octets
  // décodés (512 Kio), et le base64 pèse un tiers de plus.
  base64Jpeg: z.string().max(1024 * 1024),
});

/** `<dossier de données>/avatars`, comme du côté Tauri. */
function avatarsDir(): string {
  return path.join(app.getPath("userData"), "avatars");
}

export function registerSessionCommands(registry: CommandRegistry): void {
  registry
    .add("session_cache_get", {
      schema: USER,
      run: ({ userId }) => session.get(localDb(), userId, Date.now()),
    })
    .add("session_cache_set", {
      schema: SET_SESSION,
      run: ({ userId, profileJson, policyJson }) => {
        session.set(localDb(), userId, profileJson, policyJson ?? null, Date.now());
      },
    })
    .add("session_cache_clear", {
      schema: USER,
      run: ({ userId }) => {
        session.clear(localDb(), userId);
      },
    })
    .add("avatar_cache_put", {
      schema: PUT_AVATAR,
      run: ({ userId, base64Jpeg }) => {
        avatar.put(avatarsDir(), userId, base64Jpeg);
      },
    })
    .add("avatar_cache_get", {
      schema: USER,
      run: ({ userId }) => avatar.get(avatarsDir(), userId),
    });
}
