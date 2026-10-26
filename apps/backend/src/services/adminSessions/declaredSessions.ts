import type { DeclaredPlaybackDto } from "../deviceSessions/protocolMessages";
import type { AdminSessionDto } from "./dto";

/**
 * Les écoutes que les lecteurs déclarent eux-mêmes (`playback:declare` : la
 * musique d'Octave), dans le tableau de bord. Fonctions pures.
 *
 * - Un titre de la BIBLIOTHÈQUE a sa session chez Jellyfin : la déclaration
 *   n'y change que la position (à la seconde) et l'état de pause.
 * - Une lecture d'EXTENSION n'existe pas pour Jellyfin : elle devient une
 *   session du tableau de bord à part entière, identifiée `ext-…`, et ses
 *   commandes partent par le canal. Elle reprend l'appareil (nom,
 *   application, adresse) de la session Jellyfin de la même connexion — qui,
 *   sans lecture, s'efface à son profit : un appareil, une ligne.
 */

/** Ce que le tableau de bord reçoit d'une écoute déclarée (`gateway.declaredPlaybacks`). */
export interface DeclaredSessionInput {
  id: string;
  userId: string;
  username: string;
  deviceId: string | undefined;
  state: DeclaredPlaybackDto;
  /** Quand la position déclarée était vraie (horloge du serveur). */
  at: number;
}

const TICKS_PER_MS = 10_000;

function sameDevice(session: AdminSessionDto, view: DeclaredSessionInput): boolean {
  return session.userId === view.userId && view.deviceId !== undefined && session.deviceId === view.deviceId;
}

/** Un titre de la bibliothèque, déclaré par le lecteur qui le joue : sa position fait foi. */
export function overlayDeclared(session: AdminSessionDto, declared: readonly DeclaredSessionInput[]): boolean {
  const item = session.nowPlaying;
  if (item === null) return false;
  // La plus RÉCENTE fait foi : la page d'avant d'un rechargement peut garder sa connexion (cache de
  // navigation) et sa déclaration « en lecture » un moment.
  const view = declared
    .filter((d) => d.state.itemId === item.itemId && sameDevice(session, d))
    .reduce<DeclaredSessionInput | undefined>((latest, d) => (latest === undefined || d.at > latest.at ? d : latest), undefined);
  if (!view) return false;
  session.viaTentacle = true;
  session.positionTicks = view.state.positionMs * TICKS_PER_MS;
  session.positionAt = view.at;
  session.isPaused = view.state.isPaused;
  return true;
}

function extensionSession(view: DeclaredSessionInput, device: AdminSessionDto | undefined, now: number): AdminSessionDto {
  const { state } = view;
  return {
    id: view.id,
    userId: view.userId,
    userName: device?.userName || view.username,
    userImageTag: device?.userImageTag ?? null,
    client: device?.client ?? "",
    deviceName: device?.deviceName ?? "",
    deviceId: device?.deviceId ?? view.deviceId ?? "",
    applicationVersion: device?.applicationVersion ?? "",
    remoteAddress: device?.remoteAddress ?? null,
    lastActivity: new Date(now).toISOString(),
    // Le canal porte les commandes : la connexion qui a déclaré est vivante.
    supportsRemoteControl: true,
    viaTentacle: true,
    nowPlaying: {
      itemId: view.id,
      name: state.title,
      type: "Audio",
      runTimeTicks: state.durationMs === undefined ? undefined : state.durationMs * TICKS_PER_MS,
      imageItemId: "",
      artists: state.artists,
      album: state.album,
      imageUrl: state.imageUrl,
      fromExtension: true,
    },
    isPaused: state.isPaused,
    isMuted: false,
    positionTicks: state.positionMs * TICKS_PER_MS,
    positionAt: view.at,
    playMethod: null,
    source: null,
    transcoding: null,
    watchGroupId: null,
  };
}

/**
 * Ajoute à `sessions` une session par lecture d'extension déclarée ; la
 * session Jellyfin AU REPOS du même appareil lui cède sa place.
 */
export function addExtensionSessions(sessions: AdminSessionDto[], declared: readonly DeclaredSessionInput[], now: number): void {
  for (const view of declared) {
    if (view.state.itemId !== undefined) continue;
    const index = sessions.findIndex((s) => sameDevice(s, view));
    const device = index >= 0 ? sessions[index] : undefined;
    const session = extensionSession(view, device, now);
    if (device && device.nowPlaying === null) sessions.splice(index, 1, session);
    else sessions.push(session);
  }
}
