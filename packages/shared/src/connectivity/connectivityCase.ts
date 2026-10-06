/**
 * POURQUOI l'application ne joint plus son serveur — en mots justes, la même
 * phrase sur tous les clients. Trois cas, pas un de plus :
 * - `device` : l'APPAREIL n'a pas de réseau (« Vous êtes hors ligne ») ;
 * - `server` : l'appareil a du réseau, mais le serveur Tentacle ne répond
 *   pas — ou pas à temps (« Le serveur Tentacle est hors ligne ») ;
 * - `jellyfin` : le serveur Tentacle répond, Jellyfin derrière lui non.
 *
 * Jamais « ce n'est pas votre faute » : on dit ce qui se passe, et quoi
 * vérifier. Les appareils qui ont un mode hors ligne (mobile, bureau) ne
 * montrent plus de voile : ils y passent, avec un message TEMPORAIRE
 * (`connectivityNoticeOf`) ; les autres (web, téléviseurs) gardent un écran
 * d'erreur, avec ces mêmes mots (`connectivityCopy`).
 */

/** La cause mesurée par une sonde — la forme d'`OfflineReason` (offline-core). */
export type ConnectivityReason = "network" | "timeout" | "backend" | "jellyfin" | null;

export type ConnectivityCase = "device" | "server" | "jellyfin";

/**
 * La cause d'une sonde, rendue en cas. `timeout` : la connexion ne permet pas
 * de joindre le serveur — l'appareil a un réseau, on ne peut pas dire mieux
 * que « vérifiez votre connexion ou le serveur » (c'est le cas `server`).
 * `null` : rien à dire (en ligne, ou pas encore sondé).
 */
export function connectivityCaseOf(reason: ConnectivityReason): ConnectivityCase | null {
  switch (reason) {
    case "network":
      return "device";
    case "timeout":
    case "backend":
      return "server";
    case "jellyfin":
      return "jellyfin";
    default:
      return null;
  }
}

export interface ConnectivityCopy {
  titleKey: string;
  hintKey: string;
}

const COPY: Record<ConnectivityCase, ConnectivityCopy> = {
  device: { titleKey: "errors:connectivityDeviceTitle", hintKey: "errors:connectivityDeviceHint" },
  server: { titleKey: "errors:connectivityServerTitle", hintKey: "errors:connectivityServerHint" },
  jellyfin: { titleKey: "errors:connectivityJellyfinTitle", hintKey: "errors:connectivityJellyfinHint" },
};

export function connectivityCopy(kind: ConnectivityCase): ConnectivityCopy {
  return COPY[kind];
}

/** La ligne ajoutée là où un mode hors ligne existe : ce qui reste possible. */
export const CONNECTIVITY_OFFLINE_MODE_KEY = "errors:connectivityOfflineMode";

/** Le temps d'un message de passage hors ligne (suspendu au survol, au doigt, au focus). */
export const CONNECTIVITY_NOTICE_MS = 10_000;

export interface ConnectivityNoticeInput {
  /** Hors ligne AUTOMATIQUE : le hors ligne choisi par l'utilisateur ne s'annonce pas. */
  offlineAuto: boolean;
  reason: ConnectivityReason;
  /** Le numéro du passage hors ligne en cours — un par bascule (`nextConnectivityEpisode`). */
  episode: number;
}

export interface ConnectivityNoticeModel extends ConnectivityCopy {
  kind: ConnectivityCase;
  /** Change à chaque nouvelle occasion : la clé du message et de son compte à rebours. */
  occasion: string;
  durationMs: number;
}

/**
 * Le message temporaire d'un passage hors ligne, pur. Il paraît à chaque
 * nouvelle OCCASION — une nouvelle bascule, ou la cause qui change pendant
 * la même (le réseau revient mais le serveur reste muet) — puis s'efface ;
 * rien pour l'occasion déjà dite (`doneOccasion`). Comme `outageNoticeOf`.
 */
export function connectivityNoticeOf(
  input: ConnectivityNoticeInput,
  doneOccasion: string | null,
): ConnectivityNoticeModel | null {
  if (!input.offlineAuto) return null;
  const kind = connectivityCaseOf(input.reason);
  if (!kind) return null;
  const occasion = `${input.episode}:${kind}`;
  if (occasion === doneOccasion) return null;
  return { kind, ...COPY[kind], occasion, durationMs: CONNECTIVITY_NOTICE_MS };
}

/**
 * Le compteur des passages hors ligne : il avance à l'ENTRÉE en hors ligne
 * automatique, jamais pendant — une sonde qui confirme ne refait pas le message.
 */
export function nextConnectivityEpisode(episode: number, wasOfflineAuto: boolean, isOfflineAuto: boolean): number {
  return isOfflineAuto && !wasOfflineAuto ? episode + 1 : episode;
}
