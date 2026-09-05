import { getPrisma } from "../db";
import { tmdbConfigured } from "../tmdb/client";
import { getJellyfinUsers } from "../watchTogether/usersCache";
import { generatePool } from "./generationJob";
import { isPoolStale, readPool } from "./poolStore";
import { PROFILE_SCHEMA_VERSION, rebuildProfile } from "./profileBuilder";

/**
 * Fan-out : calculer profil + pool de TOUS les comptes en arrière-plan, pour
 * que personne n'attende sa première visite. Déclenché à la pose d'une clé
 * TMDB (force) et au boot (doux) quand une clé est déjà là.
 *
 * Doctrine des jobs maison : une boucle dans le process Fastify, un drapeau
 * module, pas de cron, pas de file. Pas de bail multi-instance non plus —
 * comme IDF et cooccurrence : deux instances dupliqueraient la dépense TMDB
 * mais convergent (upserts). Les mutex par compte de profileBuilder et
 * generationJob dédoublonnent avec une visite utilisateur simultanée.
 */

export interface FanoutOptions {
  /** true : réécrit même les profils « frais » — c'est le cas de la pose de
   *  clé, où un profil d'avant-clé n'a que des facettes Jellyfin. */
  force: boolean;
  reason: "boot" | "key-set";
}

export interface FanoutStatus {
  running: boolean;
  processed: number;
  total: number;
}

const PROFILE_FRESH_MS = 24 * 3600_000;
/** Pause entre deux comptes TRAITÉS : laisse des créneaux TMDB aux requêtes
 *  interactives (l'espaceur global de 250 ms sérialise déjà tout le reste). */
const FANOUT_PAUSE_MS = 10_000;

let running = false;
let cancelled = false;
/** Un kick forcé arrivé pendant une passe (clé changée en plein balayage de
 *  boot) est mémorisé et relancé à la fin — sans machinerie de file. */
let rerunAfter: FanoutOptions | null = null;
let processed = 0;
let total = 0;

export function fanoutStatus(): FanoutStatus {
  return { running, processed, total };
}

export function cancelRecoFanout(): void {
  cancelled = true;
  rerunAfter = null;
}

/** Lance le fan-out sans attendre (fire-and-forget, ré-entrance gérée). */
export function kickRecoFanout(opts: FanoutOptions): void {
  if (running) {
    if (opts.force) rerunAfter = opts;
    return;
  }
  running = true;
  cancelled = false;
  processed = 0;
  total = 0;
  void runFanout(opts)
    .catch((err) => console.error("[Reco] Fan-out en échec :", err))
    .finally(() => {
      running = false;
      const rerun = rerunAfter;
      rerunAfter = null;
      if (rerun && !cancelled) kickRecoFanout(rerun);
    });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function runFanout(opts: FanoutOptions): Promise<void> {
  // Sans clé, rien d'utile à calculer : le mode générique ne coûte rien.
  if (!tmdbConfigured()) return;
  const users = await getJellyfinUsers();
  if (!users) {
    console.warn("[Reco] Fan-out abandonné : Jellyfin muet (le prochain démarrage retentera)");
    return;
  }

  const prisma = getPrisma();
  const optedOut = await prisma.recoSettings.findMany({
    where: { personalized: false },
    select: { jellyfinUserId: true },
  });
  const skip = new Set(optedOut.map((o) => o.jellyfinUserId));
  const profiles = await prisma.tasteProfile.findMany({
    select: { jellyfinUserId: true, computedAt: true, schemaVersion: true },
  });
  const profileByUser = new Map(profiles.map((p) => [p.jellyfinUserId, p]));

  // Comptes déjà connus du moteur d'abord — ce sont les utilisateurs actifs,
  // ils retrouvent des rangées fraîches en premier ; les autres suivent dans
  // l'ordre Jellyfin. Les comptes désactivés et désinscrits ne coûtent rien.
  const targets = users
    .filter((u) => !u.isDisabled && !skip.has(u.id))
    .sort((a, b) => Number(profileByUser.has(b.id)) - Number(profileByUser.has(a.id)));

  total = targets.length;
  let done = 0;
  let skipped = 0;
  let failed = 0;
  for (const user of targets) {
    if (cancelled) break;
    let worked = false;
    try {
      const known = profileByUser.get(user.id);
      // Un profil d'une version antérieure du schéma (sans animeShare) est
      // périmé quel que soit son âge : reconstruit une fois, au boot.
      const profileFresh =
        known != null &&
        known.schemaVersion >= PROFILE_SCHEMA_VERSION &&
        Date.now() - known.computedAt.getTime() < PROFILE_FRESH_MS;
      const pool = await readPool(user.id);
      // Un pool est désormais servi au-delà de sa fraîcheur : c'est ici qu'il
      // se régénère, pas dans une requête.
      if (!opts.force && profileFresh && pool && !pool.preliminary && !isPoolStale(pool.generatedAt)) {
        skipped++;
        processed++;
        continue;
      }
      if (opts.force || !profileFresh) {
        await rebuildProfile(user.id);
        worked = true;
      }
      const poolAfter = await readPool(user.id);
      // Un profil reconstruit régénère son pool : un pool calculé sur
      // l'ancien profil servirait des rangées d'avant.
      if (opts.force || worked || !poolAfter || poolAfter.preliminary) {
        await generatePool(user.id);
        worked = true;
      }
      done++;
    } catch (err) {
      failed++;
      console.error(`[Reco] Fan-out : compte ${user.id.slice(0, 8)}… en échec :`, err);
    }
    processed++;
    if (worked && !cancelled) await sleep(FANOUT_PAUSE_MS);
  }
  console.log(
    `[Reco] Fan-out (${opts.reason}) : ${done} traités, ${skipped} sautés, ` +
      `${failed} échecs sur ${targets.length} comptes`
  );
}
