import { RECO_TRENDING_NOW_ROW_KEY } from "@tentacle-tv/shared";
import type { RecoPage, RecoPageRow } from "../hooks/useRecoPage";

/**
 * « Une page servie reste à l'écran tant qu'on y est » — la règle de toutes
 * les pages qui montrent des recommandations (web, bureau, miroir, mobile,
 * TV, webOS), cf. docs/RECO-POUR-VOUS.md, règle 5.
 *
 * Le serveur recalcule la page en fond (un refus, une note, un pool
 * régénéré : `reco:update`) ; le cache la reçoit, l'écran NON. Seuls passent
 * sous les yeux : le titre que l'utilisateur fait sortir (refus, jugé puis
 * lâché), et ce qu'il demande lui-même. Une page recalculée s'applique à une
 * frontière naturelle : la visite suivante, l'arrivée (les premiers instants
 * d'une visite, ou le retour après une longue absence), ou un geste explicite.
 */

/** Les rangées servies dans TOUS les états du moteur (contrat backend). */
export const RECO_GLOBAL_ROW_KEYS: ReadonlySet<string> = new Set([
  RECO_TRENDING_NOW_ROW_KEY,
  "trending",
  "serverPulse",
  "bestOfLibrary",
]);

/** L'arrivée : la page du cache s'affiche aussitôt, la fraîche la remplace encore. */
export const RECO_ARRIVAL_MS = 2_000;

/** Une absence plus longue (fenêtre cachée, app en arrière-plan) vaut une nouvelle visite. */
export const RECO_LONG_ABSENCE_MS = 30 * 60_000;

/**
 * La page ne montre encore rien de personnel (rien, ou seulement les rangées
 * globales) : la première page personnelle y entre dès qu'elle est prête —
 * c'est elle qu'on attend (démarrage à froid, première visite, construction).
 */
export function isProvisionalRecoPage(page: RecoPage): boolean {
  return !page.rows.some((row) => !RECO_GLOBAL_ROW_KEYS.has(row.key));
}

/** Le filtre de plateformes d'une page, en clé comparable (« all » sans filtre). */
export function recoPageFilterKey(page: RecoPage): string {
  const providers = page.filter?.providers ?? [];
  return providers.length > 0 ? [...providers].sort((a, b) => a - b).join(",") : "all";
}

export type ServedPageVerdict = "keep" | "adopt" | "hold";

const hasTrendingHead = (page: RecoPage): boolean => page.rows.some((row) => row.key === RECO_TRENDING_NOW_ROW_KEY);

/**
 * Pur : que faire de la page SERVIE (le cache), vu la page à l'écran ?
 *   • `keep`  — rien de neuf ;
 *   • `adopt` — elle remplace la page à l'écran (rien d'affiché encore,
 *     arrivée, filtre changé par l'utilisateur, page provisoire, « Tendances
 *     actuelles » allumée ou coupée par l'utilisateur) ;
 *   • `hold`  — elle attend la frontière suivante ; l'écran ne bouge pas.
 */
export function servedPageVerdict(
  shown: RecoPage | undefined,
  served: RecoPage | undefined,
  context: { arriving: boolean },
): ServedPageVerdict {
  if (!served || served === shown) return "keep";
  if (!shown || context.arriving) return "adopt";
  if (recoPageFilterKey(served) !== recoPageFilterKey(shown)) return "adopt";
  // La tête « Tendances actuelles » paraît ou part : c'est l'interrupteur de
  // l'utilisateur (le web garde la page montée pendant qu'il est aux réglages).
  if (hasTrendingHead(served) !== hasTrendingHead(shown)) return "adopt";
  if (isProvisionalRecoPage(shown)) return "adopt";
  return "hold";
}

/**
 * Pur : la page à l'écran, moins les titres sortis pendant la visite. Les
 * identités sont gardées quand rien ne sort (une rangée intacte reste le
 * MÊME objet : ses composants mémoïsés ne se re-rendent pas) ; une rangée
 * vidée disparaît, comme au service.
 */
export function visibleRecoPage(
  page: RecoPage | undefined,
  isRemoved: (key: string) => boolean,
): RecoPage | undefined {
  if (!page) return page;
  // La une suit les retraits comme les rangées : un titre refusé la quitte.
  const featuredGone = !!page.featured && isRemoved(page.featured.item.key);
  let changed = featuredGone;
  const rows: RecoPageRow[] = [];
  for (const row of page.rows) {
    if (!row.items.some((item) => isRemoved(item.key))) {
      rows.push(row);
      continue;
    }
    changed = true;
    const items = row.items.filter((item) => !isRemoved(item.key));
    if (items.length > 0) rows.push({ ...row, items });
  }
  if (!changed) return page;
  const next = { ...page, rows };
  if (featuredGone) delete next.featured;
  return next;
}

/**
 * Pur : la page tenue en attente a-t-elle du NOUVEAU à montrer — une rangée
 * ou un titre que l'écran n'a pas ? Une page qui ne fait que retirer, ou
 * réordonner, n'a rien à proposer : on n'invite pas à la voir.
 */
export function hasNewRecoContent(visible: RecoPage | undefined, pending: RecoPage | undefined): boolean {
  if (!visible || !pending || visible === pending) return false;
  const rowKeys = new Set(visible.rows.map((row) => row.key));
  const itemKeys = new Set<string>();
  for (const row of visible.rows) for (const item of row.items) itemKeys.add(item.key);
  return pending.rows.some(
    (row) => !rowKeys.has(row.key) || row.items.some((item) => !itemKeys.has(item.key)),
  );
}
