/**
 * Miroir local des langues retenues PAR CONTENU.
 *
 * Le serveur en est la source de vérité (table `item_track_preferences`), mais la
 * lecture hors ligne n'a personne à interroger : sans ce miroir, un film
 * disponible hors connexion repartirait sur les préférences de bibliothèque et
 * oublierait le choix fait la dernière fois qu'on l'a regardé — exactement ce que
 * la fonctionnalité promet de ne plus faire.
 *
 * # Borné, et c'est le point important
 *
 * Une entrée par contenu regardé grandit sans fin. Le cache est donc plafonné à
 * `MAX_ENTREES` et évince la plus ANCIENNEMENT touchée : une carte de plus de
 * deux cents titres n'apporte rien — on ne revient pas sur un épisode vu il y a
 * deux cents titres en s'attendant à retrouver sa piste — alors qu'un
 * `localStorage` qui gonfle se paie à chaque lecture, sur tous les appareils.
 *
 * Par appareil et par utilisateur, aucun secret : des codes de langue.
 */

export type SubtitleMode = "none" | "always" | "forced" | "signs";

export interface ItemTrackChoice {
  audioLang: string | null;
  subtitleLang: string | null;
  subtitleMode: SubtitleMode;
}

interface Entree extends ItemTrackChoice {
  itemId: string;
  /** Rang de dernier usage, pour l'éviction. Un compteur, pas une horloge. */
  seq: number;
}

const STORAGE_KEY_PREFIX = "tentacle_item_tracks_";
const MAX_ENTREES = 200;

/**
 * L'utilisateur courant, lu comme le fait le reste du dossier `offline/`.
 *
 * Volontairement pas passé en paramètre : ce module est appelé depuis un effet de
 * lecteur qui ne connaît pas forcément l'identité, et le cache doit rester
 * strictement séparé par compte — deux comptes sur le même salon n'ont aucune
 * raison de partager leurs choix de langue.
 */
function cle(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function lire(userId: string): Entree[] {
  try {
    const brut = localStorage.getItem(cle(userId));
    if (!brut) return [];
    const parsed = JSON.parse(brut) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const v = row as Record<string, unknown>;
      if (typeof v.itemId !== "string") return [];
      const mode = v.subtitleMode;
      return [{
        itemId: v.itemId,
        audioLang: typeof v.audioLang === "string" ? v.audioLang : null,
        subtitleLang: typeof v.subtitleLang === "string" ? v.subtitleLang : null,
        subtitleMode:
          mode === "always" || mode === "forced" || mode === "signs" ? mode : "none",
        seq: typeof v.seq === "number" ? v.seq : 0,
      }];
    });
  } catch {
    return [];
  }
}

function ecrire(userId: string, entrees: Entree[]): void {
  try {
    localStorage.setItem(cle(userId), JSON.stringify(entrees));
  } catch {
    /* cache best-effort : une écriture refusée ne doit rien casser */
  }
}

/** L'utilisateur connecté, tel que le stocke l'application. */
function utilisateurCourant(): string | null {
  try {
    const brut = localStorage.getItem("tentacle_user");
    if (!brut) return null;
    const user = JSON.parse(brut) as { Id?: string };
    return typeof user.Id === "string" ? user.Id : null;
  } catch {
    return null;
  }
}

/** Enregistre (ou met à jour) le choix de langues d'un contenu. */
export function rememberItemTracks(itemId: string, choix: ItemTrackChoice): void {
  const userId = utilisateurCourant();
  if (!userId) return;
  const entrees = lire(userId).filter((e) => e.itemId !== itemId);
  const seq = entrees.reduce((max, e) => Math.max(max, e.seq), 0) + 1;
  entrees.push({ itemId, ...choix, seq });
  // Éviction des plus anciennement touchées, une fois le plafond atteint.
  entrees.sort((a, b) => a.seq - b.seq);
  ecrire(userId, entrees.slice(Math.max(0, entrees.length - MAX_ENTREES)));
}

/** Le choix retenu pour ce contenu, ou `null`. */
export function itemTracksFor(itemId: string | null | undefined): ItemTrackChoice | null {
  if (!itemId) return null;
  const userId = utilisateurCourant();
  if (!userId) return null;
  const found = lire(userId).find((e) => e.itemId === itemId);
  if (!found) return null;
  return {
    audioLang: found.audioLang,
    subtitleLang: found.subtitleLang,
    subtitleMode: found.subtitleMode,
  };
}

/**
 * Recopie la photo serveur des préférences par contenu.
 *
 * Appelée au retour en ligne pour qu'un choix fait sur un AUTRE appareil soit
 * connu du miroir local. Ce n'est pas un luxe : la lecture d'un fichier
 * téléchargé n'interroge jamais le serveur, même en ligne — c'est tout l'intérêt
 * du mode local —, donc sans cette recopie le choix resterait cantonné à
 * l'appareil où il a été fait.
 *
 * Le serveur borne déjà sa réponse aux deux cents plus récentes ; on tronque
 * malgré tout, la borne étant ici la garantie.
 */
export async function refreshItemTracksCache(userId: string, backendBase: string): Promise<void> {
  try {
    const token = localStorage.getItem("tentacle_token");
    if (!token) return;
    const res = await fetch(`${backendBase}/api/preferences/items`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    cacheItemTracks(userId, await res.json());
  } catch {
    /* hors ligne ou backend injoignable : on garde le miroir précédent */
  }
}

function cacheItemTracks(userId: string, rows: unknown): void {
  if (!Array.isArray(rows)) return;
  let seq = 0;
  const entrees: Entree[] = rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const v = row as Record<string, unknown>;
    if (typeof v.itemId !== "string") return [];
    const mode = v.subtitleMode;
    seq += 1;
    return [{
      itemId: v.itemId,
      audioLang: typeof v.audioLang === "string" ? v.audioLang : null,
      subtitleLang: typeof v.subtitleLang === "string" ? v.subtitleLang : null,
      subtitleMode: mode === "always" || mode === "forced" || mode === "signs" ? mode : "none",
      seq,
    }];
  });
  ecrire(userId, entrees.slice(Math.max(0, entrees.length - MAX_ENTREES)));
}
