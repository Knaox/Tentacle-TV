/* ------------------------------------------------------------------ */
/*  La mémoire des aperçus survit à un redémarrage                      */
/*                                                                     */
/*  Une décision d'aperçu a coûté une à trois extractions YouTube.     */
/*  Elle vaut des heures (l'échéance des URL googlevideo, ~6 h) — mais */
/*  vivait en mémoire : chaque redémarrage (une mise à jour, le        */
/*  serveur de développement relancé à chaque modification) refaisait  */
/*  extraire chaque titre survolé de nouveau. Les DÉCISIONS et les     */
/*  SOURCES du relais (sans leurs listes, relues chez googlevideo)     */
/*  s'écrivent dans `<données>/trailers/preview-memory.json` (0600),   */
/*  quelques secondes après chaque changement, et se reprennent au     */
/*  démarrage tant qu'elles valent. Un fichier absent, illisible ou    */
/*  d'une autre version : on repart de rien, sans erreur. Les jetons   */
/*  du relais, eux, ne survivent pas (secret du processus) : un client */
/*  redemande `/preview`, qui répond sans extraire.                    */
/*                                                                     */
/*  Ce qui reste sur le disque : 1 000 décisions et 1 000 sources au   */
/*  plus (~3 Mo dans le pire cas, ~100 Ko pour une soirée de survols) ; */
/*  rien de plus vieux que l'échéance des URL (~6 h) — le fichier est  */
/*  réécrit sans l'échu au démarrage et à chaque changement. Aucune     */
/*  donnée de compte : des identifiants de titres et de vidéos, des URL */
/*  googlevideo signées pour l'adresse de ce serveur.                   */
/* ------------------------------------------------------------------ */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { DATA_ROOT } from "../../dataDir";
import { heldSources, onRelaySourcesChange, restoreSources, type HeldSource } from "../trailerRelay";
import { onPreviewDecisionsChange, restoreDecisions, storedDecisions, type StoredDecision } from "./previewDecision";

export const PREVIEW_MEMORY_FILE = resolve(DATA_ROOT, "trailers", "preview-memory.json");
const VERSION = 1;
/** Les changements d'une rafale (une rangée de décisions) s'écrivent ensemble. */
const SAVE_DELAY_MS = 5_000;

interface Snapshot {
  version: number;
  savedAt: number;
  decisions: StoredDecision[];
  sources: HeldSource[];
}

const YT_ID = /^[\w-]{11}$/;
const isUrl = (value: unknown) => typeof value === "string" && /^https?:\/\//.test(value);

/** Lecture défensive : le fichier vient de ce serveur, mais un disque se corrompt. */
function validSource(value: unknown): value is HeldSource {
  const held = value as Partial<HeldSource> | null;
  const source = held?.source as Record<string, unknown> | undefined;
  if (!held || !YT_ID.test(String(held.ytId)) || typeof held.validUntil !== "number" || typeof held.extractedAt !== "number") return false;
  if (!source || typeof source !== "object" || !Array.isArray(held.subtitles)) return false;
  return (source.kind === "hls" && isUrl(source.masterUrl) && Array.isArray(source.heights))
    || (source.kind === "progressive" && isUrl(source.url));
}

function validDecision(value: unknown): value is StoredDecision {
  const stored = value as Partial<StoredDecision> | null;
  const decision = stored?.decision as Record<string, unknown> | undefined;
  if (!stored || typeof stored.key !== "string" || typeof stored.until !== "number" || !decision) return false;
  return (decision.kind === "found" && YT_ID.test(String(decision.ytId)))
    || (decision.kind === "refused" && (decision.error === "no_trailer" || decision.error === "unavailable"));
}

let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function save(file: string): void {
  const snapshot: Snapshot = { version: VERSION, savedAt: Date.now(), decisions: storedDecisions(), sources: heldSources() };
  try {
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    const draft = `${file}.tmp`;
    writeFileSync(draft, JSON.stringify(snapshot), { mode: 0o600 });
    renameSync(draft, file);
  } catch (err) {
    console.warn(`[trailers] mémoire des aperçus non écrite (${err instanceof Error ? err.message : String(err)})`);
  }
}

/** Reprend la mémoire écrite avant le redémarrage, puis l'écrit à chaque changement. Une fois par processus. */
export function startPreviewMemory(file = PREVIEW_MEMORY_FILE): void {
  if (started) return;
  started = true;
  let stale = false;
  try {
    const snapshot = JSON.parse(readFileSync(file, "utf8")) as Partial<Snapshot>;
    if (snapshot.version === VERSION) {
      const sources = (Array.isArray(snapshot.sources) ? snapshot.sources : []).filter(validSource);
      const decisions = (Array.isArray(snapshot.decisions) ? snapshot.decisions : []).filter(validDecision);
      restoreSources(sources);
      restoreDecisions(decisions);
      console.log(`[trailers] mémoire des aperçus reprise : ${decisions.length} décision(s), ${sources.length} source(s)`);
    }
    stale = true;
  } catch {
    // Absente (premier démarrage) ou illisible : on repart de rien.
  }
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      save(file);
    }, SAVE_DELAY_MS);
    timer.unref();
  };
  onRelaySourcesChange(schedule);
  onPreviewDecisionsChange(schedule);
  // Le fichier lu au démarrage garde ses lignes échues : il est réécrit sans elles.
  if (stale) schedule();
}

/** Pour les tests : tout écrire tout de suite, ou repartir d'un processus « neuf ». */
export function flushPreviewMemory(file = PREVIEW_MEMORY_FILE): void {
  if (timer) clearTimeout(timer);
  timer = null;
  save(file);
}

export function resetPreviewMemory(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  started = false;
  onRelaySourcesChange(null);
  onPreviewDecisionsChange(null);
}
