/* ------------------------------------------------------------------ */
/*  La mémoire des décisions d'aperçu                                  */
/*                                                                     */
/*  Une décision par (titre, langue, règles, client) : trouvée, la     */
/*  vidéo (sa clé du relais) jusqu'à l'échéance de ses URL — dix       */
/*  minutes pour une langue de repli ; aucune bande-annonce, une       */
/*  heure ; aucune lisible, dix minutes. Écrite sur le disque par      */
/*  `previewMemoryStore.ts`, reprise au démarrage.                     */
/* ------------------------------------------------------------------ */

import {
  TRAILER_PREVIEW_NO_TRAILER_TTL_MS, TRAILER_PREVIEW_UNAVAILABLE_TTL_MS,
} from "../../../trailers/trailerPreview";
import type { TrailerVersion } from "../../../trailers/trailerCatalog";
import { TtlLru } from "./ttlLru";

export type Refusal = "no_trailer" | "unavailable";

/** `ref` : la clé du relais — l'identifiant YouTube nu, ou `dm:<id>` (`videoRef.ts`). */
export type Decision = { kind: "found"; ref: string; version?: TrailerVersion } | { kind: "refused"; error: Refusal };

/** Une décision telle que la mémoire durable la garde (`previewMemoryStore.ts`). */
export interface StoredDecision {
  key: string;
  decision: Decision;
  until: number;
}

const MAX_DECISIONS = 1_000;

const decisions = new TtlLru<Decision>(MAX_DECISIONS);
let onChange: (() => void) | null = null;

export function knownDecision(key: string): Decision | undefined {
  return decisions.get(key);
}

export function remember(key: string, decision: Decision, ttlMs: number): void {
  decisions.set(key, decision, ttlMs);
  onChange?.();
}

/** « Aucune bande-annonce » une heure, « aucune lisible » dix minutes. */
export function rememberRefusal(key: string, error: Refusal): void {
  remember(key, { kind: "refused", error }, error === "no_trailer" ? TRAILER_PREVIEW_NO_TRAILER_TTL_MS : TRAILER_PREVIEW_UNAVAILABLE_TTL_MS);
}

/** Prévient `listener` à chaque décision prise (la mémoire durable s'écrit alors). */
export function onPreviewDecisionsChange(listener: (() => void) | null): void {
  onChange = listener;
}

/** Les décisions encore valables, pour la mémoire durable. */
export function storedDecisions(now = Date.now()): StoredDecision[] {
  return decisions.dump(now).map(({ key, value, until }) => ({ key, decision: value, until }));
}

/** Reprend les décisions d'avant un redémarrage, chacune jusqu'à son échéance. */
export function restoreDecisions(list: readonly StoredDecision[], now = Date.now()): void {
  for (const { key, decision, until } of list) if (until > now) decisions.set(key, decision, until - now, now);
}

export function clearDecisions(): void {
  decisions.clear();
}
