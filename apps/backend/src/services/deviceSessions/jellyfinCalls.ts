import { fetch as undiciFetch } from "undici";
import { getJellyfinUrl } from "../configStore";
import { getJellyfinDispatcher } from "../jellyfinHttpAgent";
import { deviceAuthHeader, type DeviceAuth } from "./deviceAuth";

/**
 * Les requêtes que le canal de session adresse à Jellyfin AU NOM d'un
 * appareil : reports de lecture, ping de transcodage, capacités.
 *
 * # L'en-tête ne porte QUE le jeton — sauf pour un appareil jumelé
 *
 * Jellyfin range ses sessions par (Client, DeviceId), et RÉATTRIBUE une
 * session existante à quiconque annonce cette clé (`SessionManager.
 * GetSessionInfo`, 10.11 : `sessionInfo.UserId = user?.Id`). Présenter un
 * identifiant venu du client permettrait donc de s'emparer de la session d'un
 * autre compte. Sans `DeviceId` ni `Client` dans l'en-tête, Jellyfin les
 * prend dans l'appareil auquel le jeton est lié (`AuthorizationContext`) :
 * la session touchée est exactement celle du jeton — celle dont le lecteur
 * se sert pour ses propres requêtes, puisqu'il a adopté cette identité à la
 * connexion (`jellyfinIdentity`).
 *
 * Un appareil jumelé, lui, porte un jeton emprunté : il présente l'identité
 * que le SERVEUR a dérivée pour lui (`deviceAuth.ts`).
 */

/** Au-delà, Jellyfin ne répond pas : le report est perdu, pas la lecture. */
const TIMEOUT_MS = 10_000;

/** Ce qu'il faut pour parler à Jellyfin au nom d'un appareil. */
export interface JellyfinCaller {
  /** POST JSON ; vrai sur 2xx. Ne lève jamais. */
  post(path: string, body: unknown): Promise<boolean>;
}

export function jellyfinCaller(auth: DeviceAuth): JellyfinCaller {
  const authorization = deviceAuthHeader(auth);
  return {
    async post(path, body) {
      const base = getJellyfinUrl();
      if (!base) return false;
      try {
        const res = await undiciFetch(`${base}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authorization,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
          // Le pool keep-alive du proxy : pas de poignée de main par report.
          dispatcher: getJellyfinDispatcher(),
        });
        // Le corps est vide (204) ; le consommer rend la connexion au pool.
        await res.arrayBuffer().catch(() => undefined);
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}

/**
 * Ce que l'appareil sait faire, dit à Jellyfin. Sans `SupportsMediaControl`, le
 * tableau de bord de Jellyfin ne propose aucune télécommande — même avec la
 * connexion ouverte (`SessionInfo.SupportsRemoteControl`, 10.11). Jellyfin les
 * mémorise par appareil et les réapplique à chaque nouvelle session.
 */
export const DEVICE_CAPABILITIES = {
  PlayableMediaTypes: ["Video", "Audio"],
  // Ce que les lecteurs web et bureau savent réellement exécuter
  // (`useSessionRemote`) — Jellyfin n'offre que ce qui est annoncé ici.
  SupportedCommands: ["DisplayMessage", "SetAudioStreamIndex", "SetSubtitleStreamIndex"],
  SupportsMediaControl: true,
  SupportsPersistentIdentifier: true,
};
