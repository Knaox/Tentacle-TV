import { getJellyfinUsers } from "../watchTogether/usersCache";
import { statsCore } from "./coreStats";
import { watchMeasures } from "./measured";
import type { Leaderboard, LeaderboardEntry } from "./types";

/**
 * Classement de visionnage — assemblage des deux paliers.
 *
 * Les COMPTEURS (films vus, épisodes vus) viennent toujours de Jellyfin et sont
 * exacts. Seule la DURÉE change de source : mesurée quand le plugin Playback
 * Reporting est installé, reconstituée sinon — et dans ce second cas
 * l'interface l'annonce.
 *
 * Cinq minutes de cache : le panneau est un easter egg, on l'ouvre, on regarde,
 * on ferme. Personne n'attend un compteur temps réel, et parcourir les titres
 * vus de tous les comptes à chaque ouverture serait hors de proportion.
 */

const TTL_MS = 5 * 60_000;

let cache: { leaderboard: Leaderboard; a: number } | null = null;
let inFlight: Promise<Leaderboard | null> | null = null;

/**
 * Le plus regardé d'abord. À égalité de durée — deux comptes neufs, deux
 * `null` — on départage sur le nombre de titres puis sur le nom, pour que
 * l'ordre ne saute pas d'un rafraîchissement à l'autre.
 */
function sortRows(rows: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...rows].sort((a, b) => {
    const da = a.watchSeconds ?? -1;
    const db = b.watchSeconds ?? -1;
    if (db !== da) return db - da;
    if (b.totalPlayed !== a.totalPlayed) return b.totalPlayed - a.totalPlayed;
    return a.name.localeCompare(b.name);
  });
}

async function build(): Promise<Leaderboard | null> {
  const accounts = await getJellyfinUsers();
  if (!accounts) return null;

  // Les comptes désactivés ne jouent plus : les laisser dans le classement
  // reviendrait à faire figurer d'anciens membres au tableau d'honneur.
  const active = accounts
    .filter((u) => !u.isDisabled)
    .map((u) => ({ id: u.id, name: u.name, hasAvatar: u.hasAvatar }));

  // RACCORD TEMPOREL. L'estimation couvre l'avant, la mesure couvre l'après, et
  // l'époque est la frontière. Elle est donc lue AVANT l'estimation, qui s'en
  // sert pour ne plus compter ce qui est désormais chronométré.
  //
  // Ce raccord évite le piège de la bascule : le jour où la mesure démarre,
  // personne ne repart de zéro — le total affiché est exactement celui de la
  // veille, et chaque heure regardée ensuite est une heure vraie. La part
  // estimée ne fait plus que décroître.
  const measures = await watchMeasures();
  const epoch = measures?.epoch ?? null;

  const rows = await statsCore(active, epoch);

  let measuredTotal = 0;
  for (const row of rows) {
    const m = measures?.perUser.get(row.userId);
    row.measuredSeconds = m?.seconds ?? 0;
    measuredTotal += row.measuredSeconds;

    const total = row.estimatedSeconds + row.measuredSeconds;
    // `null` et non `0` : « on ne sait pas » ne se dit pas comme « n'a rien
    // regardé », et le tri s'appuie sur cette distinction.
    row.watchSeconds = row.totalPlayed > 0 || total > 0 ? total : null;

    const playedAt = m?.latest?.toISOString();
    if (playedAt && (!row.lastPlayedDate || playedAt > row.lastPlayedDate)) {
      row.lastPlayedDate = playedAt;
    }
  }

  const estimatedTotal = rows.reduce((n, l) => n + l.estimatedSeconds, 0);
  const source = measuredTotal === 0 ? "estimation" : estimatedTotal === 0 ? "mesure" : "mixte";

  return {
    source,
    // Conservé pour le panneau web, qui n'a pas à changer pour cette livraison.
    estimated: estimatedTotal > 0,
    measuredSince: epoch?.toISOString() ?? null,
    generatedAt: new Date().toISOString(),
    entries: sortRows(rows),
  };
}

/** Deux ouvertures simultanées ne déclenchent qu'une seule collecte. */
export async function watchLeaderboard(): Promise<Leaderboard | null> {
  if (cache && Date.now() - cache.a < TTL_MS) return cache.leaderboard;
  if (inFlight) return inFlight;

  inFlight = build()
    .then((c) => {
      if (c) cache = { leaderboard: c, a: Date.now() };
      return c;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
