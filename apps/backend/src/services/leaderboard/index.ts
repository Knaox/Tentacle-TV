import { getJellyfinUsers } from "../watchTogether/usersCache";
import { statsCore } from "./coreStats";
import { mesuresVisionnage } from "./measured";
import type { Classement, LigneClassement } from "./types";

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

let cache: { classement: Classement; a: number } | null = null;
let enCours: Promise<Classement | null> | null = null;

/**
 * Le plus regardé d'abord. À égalité de durée — deux comptes neufs, deux
 * `null` — on départage sur le nombre de titres puis sur le nom, pour que
 * l'ordre ne saute pas d'un rafraîchissement à l'autre.
 */
function trier(lignes: LigneClassement[]): LigneClassement[] {
  return [...lignes].sort((a, b) => {
    const da = a.watchSeconds ?? -1;
    const db = b.watchSeconds ?? -1;
    if (db !== da) return db - da;
    if (b.totalPlayed !== a.totalPlayed) return b.totalPlayed - a.totalPlayed;
    return a.name.localeCompare(b.name);
  });
}

async function construire(): Promise<Classement | null> {
  const comptes = await getJellyfinUsers();
  if (!comptes) return null;

  // Les comptes désactivés ne jouent plus : les laisser dans le classement
  // reviendrait à faire figurer d'anciens membres au tableau d'honneur.
  const actifs = comptes
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
  const mesures = await mesuresVisionnage();
  const epoque = mesures?.epoque ?? null;

  const lignes = await statsCore(actifs, epoque);

  let totalMesure = 0;
  for (const ligne of lignes) {
    const m = mesures?.parUtilisateur.get(ligne.userId);
    ligne.measuredSeconds = m?.secondes ?? 0;
    totalMesure += ligne.measuredSeconds;

    const total = ligne.estimatedSeconds + ligne.measuredSeconds;
    // `null` et non `0` : « on ne sait pas » ne se dit pas comme « n'a rien
    // regardé », et le tri s'appuie sur cette distinction.
    ligne.watchSeconds = ligne.totalPlayed > 0 || total > 0 ? total : null;

    const vue = m?.derniere?.toISOString();
    if (vue && (!ligne.lastPlayedDate || vue > ligne.lastPlayedDate)) {
      ligne.lastPlayedDate = vue;
    }
  }

  const totalEstime = lignes.reduce((n, l) => n + l.estimatedSeconds, 0);
  const source = totalMesure === 0 ? "estimation" : totalEstime === 0 ? "mesure" : "mixte";

  return {
    source,
    // Conservé pour le panneau web, qui n'a pas à changer pour cette livraison.
    estimated: totalEstime > 0,
    measuredSince: epoque?.toISOString() ?? null,
    generatedAt: new Date().toISOString(),
    entries: trier(lignes),
  };
}

/** Deux ouvertures simultanées ne déclenchent qu'une seule collecte. */
export async function classementVisionnage(): Promise<Classement | null> {
  if (cache && Date.now() - cache.a < TTL_MS) return cache.classement;
  if (enCours) return enCours;

  enCours = construire()
    .then((c) => {
      if (c) cache = { classement: c, a: Date.now() };
      return c;
    })
    .finally(() => {
      enCours = null;
    });

  return enCours;
}
