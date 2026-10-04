import type { DismissibleHint } from "../help/dismissibleHints";
import { qualityDropKey, type QualityDrop } from "../player/qualityDrop";
import { NOTICE_AUTO_HIDE_MS } from "./noticePolicy";

/**
 * Le message « Qualité réduite » du lecteur — l'avertissement ÉPHÉMÈRE qui dit
 * pourquoi la qualité baisse en Auto (`player/qualityDrop.ts`), rendu par le
 * mobile, l'iPad, le web et le bureau.
 *
 * Il suit la politique des avertissements surgissants (`noticePolicy.ts`) :
 * - une INFO : il s'efface seul après `NOTICE_AUTO_HIDE_MS`, décompte arrêté
 *   tant qu'on le touche ou qu'on le survole ;
 * - « Ne plus afficher » est un rappel du COMPTE (`autoQuality`, liste fermée
 *   `help/dismissibleHints.ts`), offert seulement si le serveur sait le
 *   retenir — jamais une clé d'appareil. Masqué, il ne paraît plus nulle
 *   part ; la raison reste lisible dans le menu Qualité ;
 * - il attend la PREMIÈRE IMAGE : posé sous l'écran de chargement, il s'y
 *   éteindrait avant que le film ne paraisse ;
 * - une fois par baisse et par lecture : une relance de flux (saut, piste)
 *   qui retombe sur la même cause ne le rejoue pas ; une cause nouvelle, si.
 *
 * C'est le seul avertissement permis sur le lecteur : il dit ce qui s'y passe.
 */

export const QUALITY_DROP_HINT: DismissibleHint = "autoQuality";

/** Le temps de lecture : celui de toute info surgissante. */
export const QUALITY_DROP_NOTICE_MS = NOTICE_AUTO_HIDE_MS;

export interface QualityDropNoticeInput {
  drop: QualityDrop | null;
  /** La première image est affichée. */
  started: boolean;
  /**
   * Le compte l'a masqué pour de bon ? `undefined` tant que ses rappels ne
   * sont pas lus : on attend, plutôt qu'un message qui paraît puis disparaît.
   */
  dismissed: boolean | undefined;
  /** Les baisses déjà dites pendant cette lecture (`qualityDropKey`). */
  shown: ReadonlySet<string>;
}

/** La baisse à dire maintenant (sa clé), ou `null`. */
export function qualityDropNoticeDue(input: QualityDropNoticeInput): string | null {
  if (!input.drop || !input.started || input.dismissed !== false) return null;
  const key = qualityDropKey(input.drop);
  return input.shown.has(key) ? null : key;
}
