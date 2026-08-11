/**
 * Mesure du temps de visionnage — formes de données.
 *
 * Trois niveaux, à ne pas confondre :
 *  • `SessionBrute`   ce que Jellyfin renvoie sur GET /Sessions ;
 *  • `Echantillon`    ce qu'on en retient, normalisé, à un instant donné ;
 *  • `EtatSession`    ce qu'on garde en mémoire d'un relevé à l'autre.
 */

/** Sous-ensemble de la réponse Jellyfin réellement lu. */
export interface SessionBrute {
  Id?: string;
  UserId?: string;
  UserName?: string;
  Client?: string;
  DeviceName?: string;
  IsActive?: boolean;
  LastActivityDate?: string;
  LastPlaybackCheckIn?: string;
  PlayState?: {
    IsPaused?: boolean;
    PositionTicks?: number;
  };
  NowPlayingItem?: {
    Id?: string;
    Name?: string;
    Type?: string;
    RunTimeTicks?: number;
    SeriesId?: string;
    SeriesName?: string;
  };
}

/** Une session en lecture, à un relevé donné. */
export interface Echantillon {
  /** `Session.Id` de Jellyfin — stable pendant toute la vie de la session. */
  sessionKey: string;
  userId: string;
  itemId: string;
  itemType: string;
  itemName: string;
  seriesId: string | null;
  seriesName: string | null;
  clientName: string | null;
  deviceName: string | null;
  runtimeSeconds: number | null;
  paused: boolean;
  active: boolean;
  positionTicks: number;
  /**
   * Dernier signe de vie du client, en millisecondes epoch. `null` quand la
   * valeur est absente ou aberrante (Jellyfin renvoie parfois `0001-01-01`) :
   * inconnu n'est PAS périmé, sans quoi des familles entières de clients ne
   * créditeraient jamais rien.
   */
  checkInMs: number | null;
}

/** Ce qu'on retient d'un relevé pour pouvoir créditer au suivant. */
export interface EtatSession {
  sessionKey: string;
  userId: string;
  itemId: string;
  /** Horloge MONOTONE du dernier relevé — jamais l'heure murale. */
  monoMs: number;
  /** Heure murale du dernier relevé, pour les horodatages en base. */
  horlogeMs: number;
  paused: boolean;
  positionTicks: number;
  /** Dernier instant (monotone) où la position a bougé. */
  bougeMs: number;
  /** Vrai si le relevé précédent remplissait toutes les conditions de crédit. */
  vivant: boolean;
  /** Total accumulé sur ce segment, en secondes. Écrit tel quel en base. */
  secondes: number;
  /** Identité du segment en base, une fois la ligne créée. */
  segmentId: string | null;
  /** Début du segment, heure murale. */
  debutMs: number;
  echantillon: Echantillon;
}

/** Ce qu'un relevé produit. */
export interface Bilan {
  /** Nouvel état à conserver pour le relevé suivant. */
  etat: Map<string, EtatSession>;
  /** Segments dont le total a changé — à écrire. */
  aEcrire: EtatSession[];
  /** Segments dont la session a disparu — à clore. */
  aFermer: EtatSession[];
}
