/**
 * Tableau de bord des sessions en direct — le CONTRAT entre le backend et la
 * page d'administration (`/admin/sessions`).
 *
 * Recopié octet pour octet dans le backend
 * (`apps/backend/src/services/adminSessions/dto.ts`), tenu par
 * `dtoMirror.test.ts` — on modifie ICI, on recopie là-bas.
 *
 * Des champs MINIMAUX : une session Jellyfin brute pèse plusieurs kilo-octets
 * (l'élément complet, les capacités, la file de lecture…). Le backend n'en
 * garde que ce que la page affiche.
 */

export type AdminPlayMethod = "DirectPlay" | "DirectStream" | "Transcode";

export interface AdminNowPlayingDto {
  itemId: string;
  name: string;
  /** `Movie`, `Episode`, `Audio`… */
  type: string;
  seriesName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  productionYear?: number;
  runTimeTicks?: number;
  /** L'élément dont on montre l'affiche (la série, pour un épisode sans image propre). */
  imageItemId: string;
  imageTag?: string;
}

/** Ce que le média source est — pistes choisies par le lecteur. */
export interface AdminSourceDto {
  videoCodec?: string;
  width?: number;
  height?: number;
  /** `SDR`, `HDR10`, `DOVI`… (`VideoRangeType` de Jellyfin). */
  videoRange?: string;
  audioCodec?: string;
  audioChannels?: number;
  audioLanguage?: string;
  /** Titre affiché de la piste de sous-titres choisie. */
  subtitle?: string;
  bitrate?: number;
}

/** Le transcodage en cours, tel que Jellyfin le décrit. */
export interface AdminTranscodingDto {
  videoCodec?: string;
  audioCodec?: string;
  container?: string;
  isVideoDirect: boolean;
  isAudioDirect: boolean;
  bitrate?: number;
  framerate?: number;
  width?: number;
  height?: number;
  audioChannels?: number;
  completionPercentage?: number;
  hardwareAccelerationType?: string;
  /** `ContainerNotSupported`, `VideoCodecNotSupported`… */
  reasons: string[];
}

export interface AdminSessionDto {
  /** Identifiant de session Jellyfin — la cible des actions. */
  id: string;
  userId: string;
  userName: string;
  userImageTag: string | null;
  client: string;
  deviceName: string;
  deviceId: string;
  applicationVersion: string;
  remoteAddress: string | null;
  /** ISO 8601. */
  lastActivity: string;
  /** Jellyfin accepte stop, pause et messages pour cette session. */
  supportsRemoteControl: boolean;
  /** Lecture portée par le canal de session de Tentacle : position à la seconde, arrêt garanti. */
  viaTentacle: boolean;
  nowPlaying: AdminNowPlayingDto | null;
  isPaused: boolean;
  isMuted: boolean;
  positionTicks: number;
  /** Instant (ms, horloge du serveur) où `positionTicks` était vraie : la page extrapole. */
  positionAt: number;
  playMethod: AdminPlayMethod | null;
  source: AdminSourceDto | null;
  transcoding: AdminTranscodingDto | null;
  /** Salle Watch Together dont cette lecture fait partie. */
  watchGroupId: string | null;
}

export interface AdminWatchMemberDto {
  userId: string;
  userName: string;
  isHost: boolean;
  inPlayback: boolean;
  buffering: boolean;
  /** Écart au rythme de la salle (ms, > 0 = en avance), `null` sans mesure. */
  driftMs: number | null;
  /** La session Jellyfin de son lecteur, quand on la reconnaît. */
  sessionId: string | null;
}

export interface AdminWatchGroupDto {
  groupId: string;
  itemId: string | null;
  isPaused: boolean;
  positionTicks: number;
  positionAt: number;
  members: AdminWatchMemberDto[];
}

export interface AdminSessionsSnapshotDto {
  /** Horloge du serveur à l'émission : la page en tire son décalage. */
  serverTime: number;
  sessions: AdminSessionDto[];
  groups: AdminWatchGroupDto[];
}

/** Commandes de lecture que le tableau de bord peut envoyer (`PlaystateCommand`). */
export type AdminPlaystateCommand = "Pause" | "Unpause" | "Stop";

/** Résultat d'une action de groupe : combien de lecteurs l'ont reçue. */
export interface AdminGroupActionResultDto {
  delivered: number;
  total: number;
}
