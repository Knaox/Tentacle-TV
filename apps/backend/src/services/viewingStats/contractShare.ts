/**
 * Statistiques PARTAGÉES — le contrat du partage des statistiques : la page
 * publique `/share/:token` d'un lien de statistiques (`GET /api/share/:token`,
 * sans compte) et les routes du propriétaire (`/api/share/stats`).
 *
 * Recopié dans le backend (`apps/backend/src/services/viewingStats/contractShare.ts`)
 * aux chemins d'import près — `./viewingStats` y devient `./contract`,
 * `../viewingStats/habits` y devient `./habits`. Verrou : `contractMirror.test.ts`.
 *
 * UNE LISTE BLANCHE, pas une réponse rognée : chaque type ne reprend (`Pick`)
 * que ce qu'un inconnu peut voir, et le serveur construit chaque champ à la
 * main. Un champ ajouté demain aux statistiques du propriétaire n'entre ici que
 * si quelqu'un l'y écrit.
 *
 * Ce qui ne sort JAMAIS : la grille jour × heure (les heures précises — seules
 * ses habitudes à gros grain passent), les écrans et applications, le fuseau
 * du propriétaire, les dates exactes (dernière lecture d'un titre ; records
 * datés au MOIS ; débuts de mesure au jour), « À voir » (Ma liste) et la date
 * du profil de goût.
 */

import type { ViewingHabits } from "./habits";
import type {
  ViewingStats,
  ViewingStatsPeriod,
  ViewingStatsRecords,
  ViewingStatsTaste,
  ViewingStatsTitle,
} from "./contract";

/** Un titre classé : ni dernière lecture, ni image de fond. */
export type PublicStatsTitle = Pick<
  ViewingStatsTitle,
  "id" | "name" | "kind" | "seconds" | "episodes" | "viewings" | "rating" | "favorite" | "verdict" | "year" | "anime" | "primaryTag"
>;

/**
 * Les records, aux champs de ceux du propriétaire, mais datés au MOIS :
 * `date`, `from` et `to` valent « AAAA-MM ». Un exploit, pas un emploi du temps.
 */
export type PublicStatsRecords = ViewingStatsRecords;

/** Le goût : les titres aimés et les avis comptés, sans « À voir » ni date de calcul. */
export type PublicStatsTaste = Pick<ViewingStatsTaste, "available" | "animeShare" | "loved" | "signals">;

export interface PublicViewingStats
  extends Pick<
    ViewingStats,
    | "period"
    | "generatedAt"
    | "hasHistory"
    | "totals"
    | "timeline"
    | "split"
    | "genres"
    | "origins"
    | "decades"
    | "people"
  > {
  /** Début de la mesure, au jour (midi UTC) : aucune heure. */
  measuredSince: string | null;
  /** « VF ou VO ? », son premier relevé ramené au jour (midi UTC). */
  listening: ViewingStats["listening"];
  /** Les habitudes à gros grain qui remplacent la grille jour × heure. */
  habits: ViewingHabits;
  topSeries: PublicStatsTitle[];
  movies: PublicStatsTitle[];
  records: PublicStatsRecords;
  taste: PublicStatsTaste;
}

/** `GET /api/share/:token` d'un lien de statistiques. */
export interface SharedStatsView {
  kind: "stats";
  ownerUsername: string;
  stats: PublicViewingStats;
}

/**
 * Le lien du propriétaire (`GET /api/share/stats/mine`, `POST /api/share/stats`) :
 * son jeton et la période qu'il montre ; les deux à null sans lien.
 */
export interface StatsShareLink {
  token: string | null;
  period: ViewingStatsPeriod | null;
}
