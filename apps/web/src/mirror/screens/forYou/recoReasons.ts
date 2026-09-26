import { reasonToText, type RecoReason, type ReasonTranslate } from "@tentacle-tv/api-client";

/** Les phrases DISTINCTES que font les raisons d'une recommandation, `max` au
 *  plus (`reasonTexts` de l'app, `RecoReasonList.tsx`). */
export function reasonTexts(reasons: readonly RecoReason[], t: ReasonTranslate, max = 3): string[] {
  const out: string[] = [];
  for (const reason of reasons) {
    const text = reasonToText(reason, t);
    if (text && !out.includes(text)) out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

/** La première raison qui fait une phrase — celle qu'une carte affiche. */
export function firstReasonText(reasons: readonly RecoReason[], t: ReasonTranslate): string | undefined {
  return reasonTexts(reasons, t, 1)[0];
}
