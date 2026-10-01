import type { QueryClient } from "@tanstack/react-query";
import { notifyUserChange } from "@tentacle-tv/api-client";
import { beginUnpair, endWipe, wipeAccount } from "@tentacle-tv/tv-core";
import { deviceToken2 } from "../bootstrap/fragmentToken";
import { releaseHeldSocket } from "./guardSocket";
import { pageStorage, webosAccountKeys } from "./pageStorage";
import { scheduleRevocationDrainTv } from "./revocationQueueTv";

/**
 * Le déjumelage de la LG — le même contrat que la TV native
 * (`apps/tv/src/auth/unpair.ts`), la seule porte quel que soit le geste.
 *
 * Synchrone et local, même pendant une lecture : le marqueur d'abord
 * (`beginUnpair`, l'ancien jeton mis de côté), puis la mémoire, puis tout ce
 * qui appartient au compte dans le stockage de la page, puis la garde de
 * routes, qui monte l'écran de jumelage dès que l'utilisateur disparaît. La
 * révocation part ensuite, rejouée jusqu'à confirmation du serveur — qui est
 * celui de la page.
 */

/** - `settings`, `offline` : un geste sur la TV — le serveur est à prévenir ;
 *  - `revoked` : un verdict du serveur — plus rien à lui demander. */
export type UnpairOrigin = "settings" | "offline" | "revoked";

interface ClientSession {
  setAccessToken(token: string | null): void;
  setDirectStreaming(config: null): void;
  adoptJellyfinDeviceId(id: string | null): void;
}

export interface UnpairTvContext {
  client: ClientSession;
  queryClient: QueryClient;
}

export function unpairTv({ client, queryClient }: UnpairTvContext, origin: UnpairOrigin): void {
  const token = deviceToken2();
  const revoke = origin !== "revoked" && token !== null;
  beginUnpair(pageStorage, revoke ? { serverUrl: window.location.origin, token } : null, Date.now());

  releaseHeldSocket();
  client.setAccessToken(null);
  client.setDirectStreaming(null);
  // Retire aussi `tentacle_device_id_jf` : l'identité dérivée pour CE jumelage.
  client.adoptJellyfinDeviceId(null);
  queryClient.clear();

  wipeAccount(pageStorage, webosAccountKeys());
  endWipe(pageStorage);

  // Pas de navigation impérative : la garde de routes redirige d'elle-même
  // dès que l'utilisateur mémorisé disparaît.
  notifyUserChange();
  if (revoke) scheduleRevocationDrainTv(0);
}
