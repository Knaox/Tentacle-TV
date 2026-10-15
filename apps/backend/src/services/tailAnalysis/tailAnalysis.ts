/**
 * L'analyse de FIN DE MÉDIA : quand la lancer, et où ranger sa réponse.
 *
 * Elle prend la suite de l'analyse des vignettes (`frameAnalysis.ts`, retirée)
 * avec les mêmes trois règles — à la demande au lancement, une fois par média,
 * le lecteur n'attend JAMAIS (`analysisPending`) — et deux de plus :
 *
 *  1. **tout média, pas seulement ceux que personne n'a décrits** : films et
 *     épisodes, fournisseurs ou non. Les métadonnées existantes sont des
 *     INDICES (un début de générique), pas des réponses : c'est ce qui permet
 *     de corriger un générique qui avale une scène mi-générique ;
 *  2. **rien n'est rangé quand rien n'est trouvé** (`tailStore.ts`) : un
 *     refroidissement en mémoire évite de refaire l'analyse à chaque lecture.
 *
 * Elle ne lit que les VIGNETTES : l'écoute de la fin du fichier est retirée
 * avec l'analyse audio. Un verdict rangé est définitif — y compris ceux d'avant
 * le retrait, qui avaient écouté (`audio: true`) ou non.
 */

import { resolvePlaybackSegments } from "../../playback/resolveSegments";
import type { TailVerdict } from "../../playback/tailVerdict";
import type { SegmentSourceBundle } from "../jellyfinSegments";
import { collectFrameSamples, type TrickplayManifest } from "../trickplayFrames";
import { classifyCell, type ThumbnailMeasure } from "./tailCells";
import { readTail } from "./tailReading";
import { storeTailVerdict } from "./tailStore";
import type { CellMeasure, ProviderSpan, TailInput } from "./tailTimeline";

export const NOTHING_FOUND_COOLDOWN_MS = 24 * 3600_000;
export const FAILURE_COOLDOWN_MS = 3600_000;
const MAX_COOLDOWNS = 1_000;

export interface TailAnalysisRequest {
  itemId: string;
  runtimeMs: number;
  mediaSourceId: string | null;
  trickplay: TrickplayManifest | null;
  providerSpans: ProviderSpan[];
  jellyfinUrl: string;
  apiKey: string;
}

const inFlight = new Set<string>();
const cooldownUntil = new Map<string, number>();

/** Pour les tests : analyses en cours et refroidissements. */
export function resetTailAnalysisForTests(): void {
  inFlight.clear();
  cooldownUntil.clear();
}

function coolDown(itemId: string, ms: number): void {
  if (cooldownUntil.size >= MAX_COOLDOWNS) {
    const oldest = cooldownUntil.keys().next().value;
    if (oldest !== undefined) cooldownUntil.delete(oldest);
  }
  cooldownUntil.set(itemId, Date.now() + ms);
}

/**
 * Les génériques annoncés par les fournisseurs : les marqueurs Jellyfin bruts
 * (même ceux que le résolveur écarte — un début reste un indice) et les Outro
 * résolus sans l'analyse (chapitres, greffons), sans doublon.
 */
export function providerSpans(itemId: string, bundle: SegmentSourceBundle): ProviderSpan[] {
  const base = resolvePlaybackSegments(itemId, bundle.runtimeMs, { ...bundle.sources }, "");
  const native = (bundle.sources.mediaSegments?.Items ?? [])
    .filter((item) => item.Type === "Outro" && typeof item.StartTicks === "number" && typeof item.EndTicks === "number")
    .map((item) => ({ startMs: Math.round((item.StartTicks as number) / 10_000), endMs: Math.round((item.EndTicks as number) / 10_000) }));
  const resolved = base.segments
    .filter((s) => s.type === "Outro")
    .map((s) => ({ startMs: Math.round(s.startMs), endMs: Math.round(s.endMs) }));
  const byKey = new Map<string, ProviderSpan>();
  for (const span of [...native, ...resolved]) {
    const key = `${String(span.startMs)}-${String(span.endMs)}`;
    if (!byKey.has(key)) byKey.set(key, span);
  }
  return [...byKey.values()];
}

/** Faut-il lancer l'analyse ? Jamais sur un média qui a déjà son verdict. */
export function needsTailAnalysis(
  itemId: string,
  runtimeMs: number,
  hasTrickplay: boolean,
  stored: TailVerdict | undefined,
  now = Date.now(),
): boolean {
  if (runtimeMs <= 0 || !hasTrickplay) return false;
  if (inFlight.has(itemId) || (cooldownUntil.get(itemId) ?? 0) > now) return false;
  return stored === undefined;
}

/** Une analyse est-elle en cours (ou différée) pour ce média ? */
export function tailAnalysisPending(itemId: string): boolean {
  return inFlight.has(itemId);
}

/** Lance l'analyse en arrière-plan. Rend la main tout de suite. */
export function startTailAnalysis(request: TailAnalysisRequest): void {
  if (inFlight.has(request.itemId)) return;
  inFlight.add(request.itemId);
  void run(request);
}

/** La frise d'image, une lettre par vignette ; `?` là où une planche manquait — et ses mesures. */
function cellStrip(samples: readonly ThumbnailMeasure[], intervalMs: number): { cells: string; measures: Array<CellMeasure | null> } {
  const byMs = new Map(samples.map((s) => [s.ms, s]));
  let cells = "";
  const measures: Array<CellMeasure | null> = [];
  if (samples.length === 0) return { cells, measures };
  for (let ms = samples[0].ms; ms <= samples[samples.length - 1].ms; ms += intervalMs) {
    const m = byMs.get(ms);
    cells += m ? classifyCell(m) : "?";
    measures.push(m ? { dark: m.dark, modal: m.modal } : null);
  }
  return { cells, measures };
}

const mmss = (ms: number): string =>
  `${String(Math.floor(ms / 60_000))}:${String(Math.floor((ms / 1000) % 60)).padStart(2, "0")}`;

async function run(request: TailAnalysisRequest): Promise<void> {
  const { itemId, runtimeMs } = request;
  try {
    const { samples, intervalMs } = await collectFrameSamples({
      itemId,
      manifest: request.trickplay,
      ...(request.mediaSourceId !== null ? { mediaSourceId: request.mediaSourceId } : {}),
      runtimeMs,
      jellyfinUrl: request.jellyfinUrl,
      apiKey: request.apiKey,
    });
    if (samples.length === 0 || intervalMs <= 0) {
      coolDown(itemId, NOTHING_FOUND_COOLDOWN_MS);
      return;
    }
    const input: TailInput = {
      runtimeMs,
      intervalMs,
      cellsFromMs: samples[0].ms,
      ...cellStrip(samples, intervalMs),
      providerSpans: request.providerSpans,
    };
    const verdict = readTail(input);
    if (verdict === null) {
      coolDown(itemId, NOTHING_FOUND_COOLDOWN_MS);
      console.info(`[fin] ${itemId} : rien de sûr — rien d'enregistré`);
      return;
    }
    await storeTailVerdict(itemId, runtimeMs, verdict);
    const scenes = verdict.scenes.map((s) => mmss(s.startMs)).join(", ");
    console.info(
      `[fin] ${itemId} : générique ${mmss(verdict.creditsStartMs)}, ` +
        `${verdict.scenes.length > 0 ? `scène(s) ${scenes}` : "pas de scène après"}`,
    );
  } catch (error) {
    console.warn(`[fin] ${itemId} : analyse abandonnée (${String(error)})`);
    coolDown(itemId, FAILURE_COOLDOWN_MS);
  } finally {
    inFlight.delete(itemId);
  }
}
