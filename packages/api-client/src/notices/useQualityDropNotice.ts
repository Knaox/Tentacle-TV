import { useCallback, useEffect, useRef, useState } from "react";
import {
  QUALITY_DROP_HINT, qualityDropNoticeDue, qualityDropText,
  type QualityDrop, type QualityDropText,
} from "@tentacle-tv/shared";
import { useDismissedHints, useSetHintDismissed, type DismissedHintsState } from "../hooks/useDismissedHints";

/** Ce que le lecteur rend : la baisse et ses phrases, ou la confirmation d'un masquage. */
export type QualityDropNoticeView =
  | { kind: "drop"; key: string; drop: QualityDrop; text: QualityDropText; canDismiss: boolean }
  | { kind: "dismissed" };

/**
 * Le masquage « pour de bon », tel que le compte le connaît : `undefined`
 * tant que ses rappels ne sont pas lus — mais un serveur qui ne répond pas
 * vaut « rien de masqué » : le message passe alors sans « Ne plus afficher ».
 */
export function qualityDropDismissal(hints: DismissedHintsState | undefined, failed: boolean): boolean | undefined {
  if (hints) return hints.dismissed.includes(QUALITY_DROP_HINT);
  return failed ? false : undefined;
}

export interface QualityDropNoticeInput {
  /** `qualityDrop(…)` du flux en cours ; `null` : rien à dire. */
  drop: QualityDrop | null;
  /** La première image est affichée. */
  started: boolean;
  /** Le titre lu : changer de titre, c'est une lecture neuve. */
  itemId: string | undefined;
  /** La langue de l'interface, pour écrire les débits (« 6,4 »). */
  locale?: string;
}

export interface QualityDropNoticeResult {
  view: QualityDropNoticeView | null;
  /** Le temps est écoulé, ou la croix : le message s'efface pour cette lecture. */
  close: () => void;
  /** « Ne plus afficher » — le rappel du compte. */
  dismissForGood: () => void;
  /** « Annuler » sous la confirmation. */
  undo: () => void;
  /** La raison relisible dans le menu Qualité — même masquée, même effacée. */
  menuText: QualityDropText | null;
}

/**
 * « Qualité réduite » sur le lecteur — la règle partagée
 * (`notices/qualityDropNotice.ts`) mise en état pour le mobile, l'iPad, le
 * web et le bureau ; chaque lecteur ne fait que rendre `view`, avec le
 * compte à rebours de sa carte d'avertissement (`QUALITY_DROP_NOTICE_MS`).
 */
export function useQualityDropNotice({ drop, started, itemId, locale }: QualityDropNoticeInput): QualityDropNoticeResult {
  const { data: hints, isError } = useDismissedHints();
  const { mutate } = useSetHintDismissed();
  const dismissed = qualityDropDismissal(hints, isError);
  const shownRef = useRef<Set<string>>(new Set());
  const [view, setView] = useState<QualityDropNoticeView | null>(null);

  // Un autre titre : une lecture neuve, tout peut se redire.
  useEffect(() => {
    shownRef.current = new Set();
    setView(null);
  }, [itemId]);

  const canDismiss = !!hints?.known.includes(QUALITY_DROP_HINT);
  useEffect(() => {
    const key = qualityDropNoticeDue({ drop, started, dismissed, shown: shownRef.current });
    if (!key || !drop) return;
    shownRef.current.add(key);
    setView({ kind: "drop", key, drop, text: qualityDropText(drop, locale), canDismiss });
  }, [drop, started, dismissed, locale, canDismiss]);

  const close = useCallback(() => setView(null), []);
  const dismissForGood = useCallback(() => {
    setView({ kind: "dismissed" });
    mutate({ hint: QUALITY_DROP_HINT, dismissed: true });
  }, [mutate]);
  const undo = useCallback(() => {
    setView(null);
    mutate({ hint: QUALITY_DROP_HINT, dismissed: false });
  }, [mutate]);

  const menuText = drop ? qualityDropText(drop, locale) : null;
  return { view, close, dismissForGood, undo, menuText };
}

