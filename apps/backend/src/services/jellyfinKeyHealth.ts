import { getJellyfinApiKey, getJellyfinUrl } from "./configStore";

/**
 * Santé de la CLÉ ADMIN Jellyfin.
 *
 * Cette clé ne sert jamais à la navigation : le proxy voyage avec le jeton de
 * l'utilisateur connecté. Elle ne porte que le travail sans personne derrière —
 * notifications d'ajouts en bibliothèque, invitations, création de comptes,
 * écrans d'administration. D'où le angle mort : quand elle est révoquée côté
 * Jellyfin, l'interface continue de fonctionner à l'écran pendant que tout ce
 * pan-là est mort, et le seul témoin est une ligne de journal toutes les
 * trente secondes — un `403` sur le WebSocket que personne ne lit.
 *
 * Ce module donne à l'administrateur un moyen de l'apprendre autrement.
 */

export type EtatCleAdmin = "ok" | "revoquee" | "sansDroits" | "absente" | "injoignable";

export interface SanteCleAdmin {
  etat: EtatCleAdmin;
  /** Horodatage du dernier contrôle réel, pas de la lecture du cache. */
  verifieA: string;
}

/**
 * Cinq minutes : assez court pour que l'alerte apparaisse dans la minute qui
 * suit une révocation, assez long pour ne pas interroger Jellyfin à chaque
 * chargement de page d'un administrateur.
 */
const TTL_MS = 5 * 60_000;

let cache: { sante: SanteCleAdmin; a: number } | null = null;
let enCours: Promise<SanteCleAdmin> | null = null;

/**
 * `/Users` et non `/System/Info` : le premier exige les droits
 * d'administration, le second se contente d'une clé valide. On veut distinguer
 * « la clé n'existe plus » de « la clé existe mais ne peut plus rien faire ».
 */
async function controler(): Promise<SanteCleAdmin> {
  const verifieA = new Date().toISOString();
  const url = getJellyfinUrl();
  const cle = getJellyfinApiKey();
  if (!url || !cle) return { etat: "absente", verifieA };

  try {
    const res = await fetch(`${url}/Users`, {
      headers: { "X-Emby-Token": cle },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) return { etat: "ok", verifieA };
    if (res.status === 401) return { etat: "revoquee", verifieA };
    if (res.status === 403) return { etat: "sansDroits", verifieA };
    return { etat: "injoignable", verifieA };
  } catch {
    return { etat: "injoignable", verifieA };
  }
}

/**
 * Un seul contrôle en vol à la fois : deux administrateurs qui ouvrent
 * l'application en même temps ne déclenchent qu'un appel.
 */
export async function santeCleAdmin(forcer = false): Promise<SanteCleAdmin> {
  if (!forcer && cache && Date.now() - cache.a < TTL_MS) return cache.sante;
  if (enCours) return enCours;

  enCours = controler()
    .then((sante) => {
      cache = { sante, a: Date.now() };
      return sante;
    })
    .finally(() => {
      enCours = null;
    });

  return enCours;
}

/** À appeler dès que la configuration Jellyfin change : le verdict est périmé. */
export function invaliderSanteCleAdmin(): void {
  cache = null;
}
