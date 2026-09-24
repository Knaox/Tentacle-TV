import type { AdminSessionDto } from "../types/adminSessionsDto";

/**
 * L'application d'une session telle que l'administrateur la lit : son nom, sa
 * version, et l'appareil quand il dit quelque chose de plus.
 *
 * La version est celle que l'appareil déclare à Jellyfin dans son en-tête
 * `MediaBrowser` (`ApplicationVersion`) — pour un client Tentacle, la version
 * de Tentacle qu'il fait tourner. Les clients de Tentacle s'y nomment
 * « Tentacle TV - Desktop », « Tentacle TV - Mobile »… (`JellyfinClient`) :
 * on en garde « Tentacle Desktop », « Tentacle Mobile », « Tentacle TV ». Un
 * autre client (Jellyfin Web, Infuse…) garde son nom et sa version.
 *
 * Les noms d'appareil que Tentacle se donne lui-même redisaient souvent
 * l'application (« Tentacle TV - Desktop · Desktop ») : une redite disparaît,
 * et nos identifiants techniques se lisent en clair. Un nom posé par
 * l'administrateur dans Jellyfin passe tel quel.
 */

const TENTACLE_CLIENT = /^Tentacle TV - (.+)$/;

/** Nos propres noms d'appareil (`JellyfinClient`), tels qu'on les lit. */
const OWN_DEVICE_NAMES: Readonly<Record<string, string>> = {
  "Tentacle-iOS": "iOS",
  "Tentacle-Android": "Android",
  AndroidTV: "Android TV",
};

export interface SessionApp {
  /** « Tentacle Desktop », « Infuse »… — vide si Jellyfin ne l'a pas dit. */
  name: string;
  version: string | null;
  /** L'appareil, s'il n'est pas déjà dit par le nom de l'application. */
  device: string | null;
}

type SessionIdentity = Pick<AdminSessionDto, "client" | "deviceName" | "applicationVersion">;

export function sessionApp(session: SessionIdentity): SessionApp {
  const client = session.client.trim();
  const platform = TENTACLE_CLIENT.exec(client)?.[1]?.trim() ?? null;
  const rawDevice = session.deviceName.trim();
  const device = platform !== null ? (OWN_DEVICE_NAMES[rawDevice] ?? rawDevice) : rawDevice;
  const redundant = platform !== null && device.toLowerCase() === platform.toLowerCase();
  return {
    name: platform !== null ? `Tentacle ${platform}` : client,
    version: session.applicationVersion.trim() || null,
    device: device === "" || redundant ? null : device,
  };
}

/** En une ligne : « Tentacle Mobile 1.6.0 · iOS ». */
export function sessionAppText(app: SessionApp): string {
  const head = [app.name, app.version].filter(Boolean).join(" ");
  return [head, app.device].filter(Boolean).join(" · ");
}

/** Ce qu'on nomme quand on parle de l'appareil : « sur Android TV », « sur Tentacle Desktop ». */
export function sessionDeviceName(app: SessionApp): string {
  return app.device ?? app.name;
}
