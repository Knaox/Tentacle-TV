/**
 * Le TEXTE de la zone d'aperçu dans la hauteur de la zone (tv-core
 * `focus/previewZoneLayout.ts`, 432 sur toutes les pages) : ce qui tient
 * au-dessus de son bord, ou des boutons du héros, selon ce que le titre a
 * (surtitre, raison, synopsis).
 *
 * Le texte est calé en bas de la zone — au-dessus de son bord, ou des boutons
 * du héros — et ne dépasse jamais la marge sûre du haut. Quand la place
 * manque, il se resserre dans cet ordre : le synopsis perd des lignes (jusqu'à
 * une), puis le logo descend à sa taille la plus petite, puis le synopsis
 * disparaît. Le surtitre, la raison et la ligne de métadonnées restent
 * toujours : ce sont eux qui disent pourquoi ce titre est là.
 *
 * Des nombres, en points de la scène (1920 × 1080) — les mêmes que la vue.
 */

export const PREVIEW_ZONE_TEXT = {
  /** La marge sûre du haut. */
  safeTop: 54,
  /** Le bas du texte, au-dessus du bord de la zone. */
  bottom: 40,
  /** La ligne des boutons du héros, et son écart au texte. */
  heroActions: 68,
  heroActionsGap: 22,
  /** L'écart entre les blocs du texte. */
  gap: 12,
  kicker: 26,
  reason: 30,
  /** Entre le surtitre et la raison. */
  headGap: 8,
  meta: 34,
  synopsisLine: 38,
} as const;

export interface PreviewZoneTextInput {
  /** La hauteur de la zone. */
  height: number;
  /** Le héros a la zone : le texte laisse la place de ses boutons. */
  hero: boolean;
  kicker: boolean;
  reason: boolean;
  /** Le titre a un synopsis. */
  synopsis: boolean;
}

export interface PreviewZoneTextLayout {
  /** La hauteur maximale du logo (ou du titre écrit). */
  logoMaxHeight: number;
  /** Les lignes du synopsis (0 : pas de synopsis). */
  synopsisLines: number;
  /** Le bas du texte, depuis le bas de la zone. */
  bottom: number;
}

const T = PREVIEW_ZONE_TEXT;

export function previewZoneTextLayout(input: PreviewZoneTextInput): PreviewZoneTextLayout {
  const bottom = input.hero ? T.bottom + T.heroActions + T.heroActionsGap : T.bottom;
  const available = input.height - T.safeTop - bottom;
  const head = (input.kicker ? T.kicker : 0) + (input.reason ? T.reason : 0) + (input.kicker && input.reason ? T.headGap : 0);
  const withHead = head > 0;
  const logo = input.hero ? { max: 76, min: 60 } : { max: withHead ? 104 : 120, min: 80 };
  const maxLines = input.synopsis ? (input.hero ? (input.reason ? 1 : 2) : withHead ? 2 : 3) : 0;
  const height = (logoHeight: number, lines: number) =>
    (withHead ? head + T.gap : 0) + logoHeight + T.gap + T.meta + (lines > 0 ? T.gap + lines * T.synopsisLine : 0);
  // Le synopsis perd des lignes, jusqu'à une ; puis le logo descend ; puis le synopsis disparaît.
  for (let lines = maxLines; lines >= Math.min(1, maxLines); lines -= 1) {
    if (height(logo.max, lines) <= available) return { logoMaxHeight: logo.max, synopsisLines: lines, bottom };
  }
  for (const lines of maxLines > 0 ? [1, 0] : [0]) {
    const room = available - height(0, lines);
    if (room >= logo.min) return { logoMaxHeight: Math.min(logo.max, room), synopsisLines: lines, bottom };
  }
  return { logoMaxHeight: logo.min, synopsisLines: 0, bottom };
}
