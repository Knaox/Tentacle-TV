import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useTentacleConfig, useUserId } from "@tentacle-tv/api-client";
import {
  AVATAR_OFFER_MAX_WAIT_MS,
  isAvatarOfferPending,
  markAvatarOffered,
  readAvatarOffered,
  settleAvatarOffer,
  type AvatarOfferLatch,
  type AvatarOfferStatus,
} from "@tentacle-tv/tv-core";
import { useServerReachability } from "../../hooks/serverReachability";
import { tvStorage } from "../../storage/RNStorageAdapter";
import { useDevicePhotoAccess } from "./devicePhotoAccess";
import { useOwnPhotoState } from "./ownPhoto";

/**
 * La porte de la PROPOSITION de la galerie (Apple TV, Android TV), pour
 * l'identité active (profil ouvert ou compte jumelé) — la troisième étape de
 * la première entrée dans un profil. La règle est dans tv-core
 * (`decideAvatarOffer`, `settleAvatarOffer`) ; on lui donne ce que la TV
 * sait : la capacité du serveur (`avatars.devicePhoto`) et sa permission pour
 * ce compte (jamais le compte de démonstration), la joignabilité, la
 * photo du sujet (sonde partagée `useOwnPhotoState`), et les sujets déjà
 * invités sur cet appareil (`tentacle_avatar_invite_seen`, la clé du bureau
 * et du mobile).
 *
 * `wait` : on ne sait pas encore — borné par `AVATAR_OFFER_MAX_WAIT_MS`. La
 * décision tranchée est TENUE pour l'identité le temps de la session de l'app.
 * `markOffered` : la galerie a été montrée (choisie ou passée) — plus jamais
 * pour ce sujet sur cette TV.
 */
export interface AvatarOfferGate {
  status: AvatarOfferStatus;
  identity: string | null;
  markOffered: () => void;
}

let latch: AvatarOfferLatch | null = null;
let waitingSince: { identity: string | null; at: number } | null = null;

export function useAvatarOfferGate(): AvatarOfferGate {
  const { storage } = useTentacleConfig();
  const identity = useUserId();
  // La capacité ET la permission du compte (non pour le compte de démonstration).
  const access = useDevicePhotoAccess();
  const { reachable } = useServerReachability();
  const hasPhoto = useOwnPhotoState(identity);
  const [offered, setOffered] = useState(() => readAvatarOffered(storage));
  const [tick, wake] = useReducer((count: number) => count + 1, 0);

  const now = Date.now();
  if (waitingSince?.identity !== identity) waitingSince = { identity, at: now };
  latch = settleAvatarOffer(latch, {
    identity,
    capable: access,
    online: reachable,
    hasPhoto,
    offered,
    waitedMs: now - waitingSince.at,
  });
  const status = latch.status;

  // L'attente a une borne : un réveil à son terme, si rien d'autre n'a tranché avant.
  useEffect(() => {
    if (status !== "wait" || !waitingSince) return undefined;
    const timer = setTimeout(wake, Math.max(0, waitingSince.at + AVATAR_OFFER_MAX_WAIT_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [status, identity, tick]);

  const markOffered = useCallback(() => {
    if (!identity) return;
    markAvatarOffered(storage, identity);
    setOffered(readAvatarOffered(storage));
  }, [identity, storage]);

  return useMemo(() => ({ status, identity, markOffered }), [status, identity, markOffered]);
}

/**
 * La proposition reste-t-elle à faire pour l'identité active, lue sans
 * attendre (le registre des fenêtres du démarrage) ? La décision finale reste
 * la porte.
 */
export function avatarOfferPending(): boolean {
  return isAvatarOfferPending(activeIdentity(), readAvatarOffered(tvStorage));
}

/** L'`Id` de `tentacle_user` (écrit par le jumelage et par l'ouverture d'un profil). */
function activeIdentity(): string | null {
  try {
    const user = JSON.parse(tvStorage.getItem("tentacle_user") ?? "null") as { Id?: unknown } | null;
    return typeof user?.Id === "string" && user.Id.length > 0 ? user.Id : null;
  } catch {
    return null;
  }
}

/** Pour les tests : oublie la décision tenue. */
export function resetAvatarOfferGateForTests(): void {
  latch = null;
  waitingSince = null;
}
