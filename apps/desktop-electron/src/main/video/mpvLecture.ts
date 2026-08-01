/**
 * Lire une propriété de mpv sur macOS, sans jamais attendre.
 *
 * # Ce que le souvenir ne pouvait pas donner
 *
 * La phase 1 avait renoncé à interroger mpv depuis le processus principal —
 * `mpv_get_property_string` prend `mp_dispatch_lock` et fige le thread dont mpv
 * a besoin (voir `mpvFfi.ts`). Le repli était de se souvenir de ce qui passait
 * dans la file d'évènements (`mpvEtat.ts`).
 *
 * Le repli tenait pour le HDR, en observant treize propriétés de plus. Il ne
 * pouvait PAS tenir pour le reste, et deux manques le prouvaient :
 *
 *  - `track-list/*` compte une dizaine d'entrées à sept champs, dont le nombre
 *    change à chaque média. On ne les observe pas, on ne les a donc jamais
 *    entendues passer : **les pistes audio et les sous-titres étaient vides**
 *    sur macOS, sans que rien ne le signale ;
 *  - le panneau de diagnostic lit une quarantaine de propriétés arbitraires. Le
 *    souvenir n'en servait que la moitié — un panneau à trous, là où l'on en a
 *    justement le plus besoin.
 *
 * `mpv_get_property_async` répond par la file d'évènements, celle qu'on vide
 * déjà. On peut donc tout lire, sans rien attendre.
 *
 * Le souvenir reste, en REPLI : si mpv ne répond pas dans le délai — il
 * reconfigure sa sortie, il est occupé —, mieux vaut la dernière valeur connue
 * qu'un champ vide.
 */

import { FORMAT, mpvApi } from "./mpvFfi";
import { valeurConnue } from "./mpvEtat";

/**
 * Base des identifiants de lecture.
 *
 * Volontairement distincte de celle des commandes (1 000 000) et des propriétés
 * observées (quelques unités), pour la même raison qu'elles le sont entre
 * elles : les trois familles partagent le champ `reply_userdata` des
 * évènements, et les confondre à la lecture d'un journal coûterait cher.
 */
const LECTURE_ID_BASE = 2_000_000;

/**
 * Délai au-delà duquel on sert le souvenir.
 *
 * mpv répond en quelques millisecondes ; la file est vidée toutes les vingt.
 * Une seconde n'est donc jamais atteinte en fonctionnement normal — c'est un
 * garde-fou contre la promesse qui ne se règle jamais, pas une temporisation.
 */
const DELAI_MS = 1000;

interface EnAttente {
  regler: (valeur: string | null) => void;
  limite: ReturnType<typeof setTimeout>;
  nom: string;
}

const enVol = new Map<number, EnAttente>();
let prochaine = LECTURE_ID_BASE;

/**
 * Demande une propriété. Rend sa valeur en chaîne, ou `null`.
 *
 * `null` couvre les trois cas où il n'y a rien à afficher, et l'appelant les
 * traite déjà tous pareil : propriété inconnue, propriété pas encore
 * disponible, mpv muet.
 */
export function lireAsync(ctx: unknown, nom: string): Promise<string | null> {
  const id = prochaine;
  prochaine += 1;

  return new Promise<string | null>((resolve) => {
    const regler = (valeur: string | null): void => {
      enVol.delete(id);
      resolve(valeur);
    };
    const limite = setTimeout(() => regler(valeurConnue(nom)), DELAI_MS);
    enVol.set(id, { regler, limite, nom });

    // Refus à l'ENVOI : aucune réponse ne viendra jamais, la promesse ne doit
    // pas rester en suspens jusqu'à l'échéance.
    const envoi = mpvApi().getPropertyAsync(ctx, id, nom, FORMAT.STRING) as number;
    if (envoi < 0) {
      clearTimeout(limite);
      regler(valeurConnue(nom));
    }
  });
}

/**
 * Règle une lecture dont la réponse vient d'arriver. Appelée par la vidange.
 *
 * Un identifiant inconnu est ignoré sans bruit : c'est le cas normal d'une
 * réponse qui arrive après l'échéance, la promesse ayant déjà été réglée.
 */
export function repondreLecture(id: number, erreur: number, valeur: unknown): void {
  const attente = enVol.get(id);
  if (attente === undefined) return;
  clearTimeout(attente.limite);
  // Une propriété indisponible n'est pas une panne : mpv rend une erreur pour
  // `video-params/*` avant que la sortie vidéo n'existe, et le panneau affiche
  // alors un tiret. Le souvenir peut en revanche avoir mieux.
  if (erreur < 0 || valeur === null || valeur === undefined) {
    attente.regler(valeurConnue(attente.nom));
    return;
  }
  attente.regler(String(valeur));
}

/**
 * Règle toutes les lectures en vol — entre deux instances mpv.
 *
 * Sans cela, une lecture laissée en suspens retiendrait son appelant jusqu'à
 * l'échéance, et avec lui la poignée IPC qui l'attend.
 */
export function oublierLectures(): void {
  for (const attente of enVol.values()) {
    clearTimeout(attente.limite);
    attente.regler(null);
  }
  enVol.clear();
}
