/**
 * Ce que l'analyse de FIN DE MÉDIA a lu — et comment ça se verse dans les bornes.
 *
 * # D'où ça vient
 *
 * Le serveur lit la fin de chaque film et de chaque épisode à sa première
 * lecture (`services/tailAnalysis/`) : les vignettes trickplay disent où défile
 * le texte du générique, l'audio dit où l'on parle et où l'on joue de la
 * musique. Il en tire le DÉBUT du générique et les SCÈNES qui le suivent —
 * mi-génériques comme post-génériques. Le verdict arrive ici déjà jugé.
 *
 * # Ce qu'il en fait
 *
 * Les génériques se dessinent AUTOUR des scènes : du début du générique à la
 * première scène, de la fin d'une scène à la suivante, puis de la dernière
 * jusqu'au bout du fichier. Chaque générique suivi d'une scène porte donc son
 * bouton « aller à la scène post-générique » — et un film à deux scènes
 * (Thanos, puis le shawarma d'« Avengers ») en porte deux.
 *
 * # Quand il a le dernier mot — et quand il se tait
 *
 * Le verdict a vu ce que les fournisseurs ne voient pas : il REMPLACE leurs
 * génériques dès qu'il a trouvé une scène, et quand aucun fournisseur n'en
 * signalait. C'est ce qui corrige les métadonnées fausses : un générique
 * Jellyfin qui avale la scène mi-générique (« Fast & Furious 9 »), un marqueur
 * posé dans le baiser final (« Deadpool », 99:53).
 *
 * Sans scène trouvée, il ne touche aux génériques des fournisseurs que pour
 * retirer une scène qui n'existe pas : un générique qui s'arrête EN PLEIN
 * défilement, alors que le texte défile encore bien au-delà. Sinon il se tait —
 * un fournisseur qui a vu une scène que l'analyse a manquée garde raison.
 *
 * MIROIR : reflété octet pour octet dans `apps/backend/src/playback/` (voir
 * l'en-tête de `segmentTypes.ts`) — n'importer que la paire.
 */

import { POST_CREDITS_MIN_MS } from "./segmentTypes";
import type { BoundsByType, RawBounds } from "./segmentChapters";

/** Une scène après le début du générique, en ms de média. */
export interface TailScene {
  startMs: number;
  endMs: number;
}

/** Le verdict de l'analyse de fin de média, tel qu'il est rangé en base. */
export interface TailVerdict {
  /** Le début du générique : le film s'arrête là. */
  creditsStartMs: number;
  /** Les scènes qui suivent ce début, triées. */
  scenes: TailScene[];
  /** Le défilement vu à l'image, [début, fin) ; `null` sans texte qui défile. */
  crawl: [number, number] | null;
  /** L'audio a été écouté (sinon, seules les preuves d'image ont compté). */
  audio: boolean;
}

/** Un générique plus court ne mérite pas de bouton. */
const TAIL_OUTRO_MIN_MS = 20_000;
/** Le générique final, après la dernière scène : sous ce seuil, ce n'est que la queue du fichier. */
const FINAL_OUTRO_MIN_MS = 30_000;
/** On arrive une seconde avant la scène : jamais après son début. */
const LANDING_LEAD_MS = 1_000;
/** Le défilement doit continuer au moins ça au-delà d'une fin de fournisseur pour la démentir. */
const CRAWL_OUTLIVES_MS = 10_000;

/** Les génériques que le verdict dessine autour de ses scènes. */
export function tailOutros(verdict: TailVerdict, runtimeMs: number): RawBounds[] {
  const source: RawBounds["source"] = verdict.audio ? "audio" : "frames";
  const out: RawBounds[] = [];
  let cursor = verdict.creditsStartMs;
  for (const scene of verdict.scenes) {
    if (scene.startMs - cursor >= TAIL_OUTRO_MIN_MS) {
      out.push({ startMs: cursor, endMs: scene.startMs - LANDING_LEAD_MS, source });
    }
    cursor = Math.max(cursor, scene.endMs);
  }
  if (runtimeMs - cursor >= FINAL_OUTRO_MIN_MS) out.push({ startMs: cursor, endMs: runtimeMs, source });
  return out;
}

/** Verse le verdict dans les bornes résolues (voir l'en-tête). Seul l'Outro est touché. */
export function applyTailVerdict(bounds: BoundsByType, verdict: TailVerdict | null, runtimeMs: number): void {
  if (verdict === null || runtimeMs <= 0) return;
  const outros = tailOutros(verdict, runtimeMs);
  if (outros.length === 0) return;
  const existing = bounds.get("Outro") ?? [];
  if (verdict.scenes.length > 0 || existing.length === 0) {
    bounds.set("Outro", outros);
    return;
  }
  const last = existing[existing.length - 1];
  const claimsScene = runtimeMs - last.endMs >= POST_CREDITS_MIN_MS;
  // Démentie seulement si la « scène » tombe EN PLEIN défilement : une fin de
  // fournisseur posée avant le défilement peut précéder une vraie scène
  // mi-générique que l'analyse n'a pas su voir (« Daredevil : Born Again »).
  const crawl = verdict.crawl;
  if (claimsScene && crawl !== null && crawl[0] <= last.endMs && crawl[1] > last.endMs + CRAWL_OUTLIVES_MS) {
    bounds.set("Outro", outros);
  }
}
