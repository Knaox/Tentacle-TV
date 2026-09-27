/**
 * L'analyse de FIN DE MÉDIA : quand la lancer, et où ranger sa réponse.
 *
 * Elle prend la suite de l'analyse des vignettes (`frameAnalysis.ts`, retirée)
 * avec les mêmes trois règles — à la demande au lancement, une fois par média,
 * le lecteur n'attend JAMAIS (`analysisPending`) — et trois de plus :
 *
 *  1. **tout média, pas seulement ceux que personne n'a décrits** : films et
 *     épisodes, fournisseurs ou non. Les métadonnées existantes sont des
 *     INDICES (un début de générique), pas des réponses : c'est ce qui permet
 *     de corriger un générique qui avale une scène mi-générique ;
 *  2. **l'audio passe par le créneau commun** (`audioJobs.ts`) : un transcodage
 *     à la fois, jamais pendant qu'un autre spectateur transcode une vidéo —
 *     différé deux minutes, cinq fois, puis remis à plus tard ;
 *  3. **rien n'est rangé quand rien n'est trouvé** (`tailStore.ts`) : un
 *     refroidissement en mémoire évite de refaire l'analyse à chaque lecture.
 *
 * Sans ffmpeg, ou l'analyse audio coupée par l'administrateur, elle se contente
 * des vignettes ; le verdict le dit (`audio: false`) et sera refait le jour où
 * l'audio redevient possible.
 */

import { resolvePlaybackSegments } from "../../playback/resolveSegments";
import { isCreditsChapterName } from "../../playback/segmentChapters";
import type { TailVerdict } from "../../playback/tailVerdict";
import { countAudioDeferral, countAudioJob, countAudioOutcome, countAudioWindow, otherViewerTranscoding, withAudioSlot } from "../audioJobs";
import { isAudioAnalysisEnabled } from "../configStore";
import type { SegmentSourceBundle } from "../jellyfinSegments";
import { collectFrameSamples, type TrickplayManifest } from "../trickplayFrames";
import { decoderKnownMissing, detectDecoder, listenToTail } from "./tailAudio";
import { classifyCell, type ThumbnailMeasure } from "./tailCells";
import { readTail } from "./tailReading";
import { audioWindowStart, findSkeleton } from "./tailSkeleton";
import { storeTailVerdict } from "./tailStore";
import { Timeline, type ProviderSpan, type TailInput } from "./tailTimeline";

export const NOTHING_FOUND_COOLDOWN_MS = 24 * 3600_000;
export const FAILURE_COOLDOWN_MS = 3600_000;
export const BUSY_DEFER_MS = 120_000;
export const BUSY_MAX_DEFERRALS = 5;
const MAX_COOLDOWNS = 1_000;
/** Un segment qui commence à deux secondes d'un chapitre nommé « générique » en vient. */
const NAMED_MATCH_MS = 2_000;

export interface TailAnalysisRequest {
  itemId: string;
  runtimeMs: number;
  mediaSourceId: string | null;
  trickplay: TrickplayManifest | null;
  providerSpans: ProviderSpan[];
  /** Un épisode : son générique peut se clore sur l'aperçu du suivant. */
  isEpisode: boolean;
  jellyfinUrl: string;
  apiKey: string;
}

const inFlight = new Set<string>();
const cooldownUntil = new Map<string, number>();
let deferMs = BUSY_DEFER_MS;

/** Pour les tests : file, refroidissements, et le délai de report. */
export function resetTailAnalysisForTests(options: { deferMs?: number } = {}): void {
  inFlight.clear();
  cooldownUntil.clear();
  deferMs = options.deferMs ?? BUSY_DEFER_MS;
}

function coolDown(itemId: string, ms: number): void {
  if (cooldownUntil.size >= MAX_COOLDOWNS) {
    const oldest = cooldownUntil.keys().next().value;
    if (oldest !== undefined) cooldownUntil.delete(oldest);
  }
  cooldownUntil.set(itemId, Date.now() + ms);
}

const audioAvailable = (): boolean => isAudioAnalysisEnabled() && !decoderKnownMissing();

/**
 * Les génériques annoncés par les fournisseurs : les marqueurs Jellyfin bruts
 * (même ceux que le résolveur écarte — un début reste un indice) et les Outro
 * résolus sans l'analyse (chapitres, greffons). Un chapitre NOMMÉ générique
 * (« End Credits », « Générique de fin ») est marqué : c'est le seul marqueur
 * qui dit où commence le générique illustré, là où les détecteurs de noir ne
 * voient que le défilement.
 */
export function providerSpans(itemId: string, bundle: SegmentSourceBundle): ProviderSpan[] {
  const base = resolvePlaybackSegments(itemId, bundle.runtimeMs, { ...bundle.sources }, "");
  const native = (bundle.sources.mediaSegments?.Items ?? [])
    .filter((item) => item.Type === "Outro" && typeof item.StartTicks === "number" && typeof item.EndTicks === "number")
    .map((item) => ({ startMs: Math.round((item.StartTicks as number) / 10_000), endMs: Math.round((item.EndTicks as number) / 10_000) }));
  const resolved = base.segments
    .filter((s) => s.type === "Outro")
    .map((s) => ({ startMs: Math.round(s.startMs), endMs: Math.round(s.endMs), ...(s.source === "chapters" ? { named: true } : {}) }));
  // Jellyfin convertit parfois lui-même ce chapitre en segment natif, qui masque alors
  // les chapitres au résolveur : on le reconnaît à son début (« L'Incroyable Hulk »).
  const chapters = bundle.sources.chapters ?? [];
  const named: ProviderSpan[] = chapters
    .map((c, i) => ({ c, next: chapters[i + 1] }))
    .filter(({ c }) => isCreditsChapterName(c.Name))
    .map(({ c, next }) => ({
      startMs: Math.round(c.StartPositionTicks / 10_000),
      endMs: next ? Math.round(next.StartPositionTicks / 10_000) : Math.round(bundle.runtimeMs),
      named: true,
    }));
  const byKey = new Map<string, ProviderSpan>();
  for (const span of [...native, ...resolved].map((s) => (named.some((n) => Math.abs(n.startMs - s.startMs) <= NAMED_MATCH_MS) ? { ...s, named: true } : s))) {
    const key = `${String(span.startMs)}-${String(span.endMs)}`;
    const known = byKey.get(key);
    if (known === undefined) byKey.set(key, span);
    else if ("named" in span) byKey.set(key, { ...known, named: true });
  }
  return [...byKey.values()];
}

/** Faut-il (re)lancer l'analyse ? Un verdict des seules vignettes se refait quand l'audio redevient possible. */
export function needsTailAnalysis(
  itemId: string,
  runtimeMs: number,
  hasTrickplay: boolean,
  stored: TailVerdict | undefined,
  now = Date.now(),
): boolean {
  if (runtimeMs <= 0 || !hasTrickplay) return false;
  if (inFlight.has(itemId) || (cooldownUntil.get(itemId) ?? 0) > now) return false;
  return stored === undefined || (!stored.audio && audioAvailable());
}

/** Une analyse est-elle en cours (ou différée) pour ce média ? */
export function tailAnalysisPending(itemId: string): boolean {
  return inFlight.has(itemId);
}

/** Lance l'analyse en arrière-plan. Rend la main tout de suite. */
export function startTailAnalysis(request: TailAnalysisRequest): void {
  if (inFlight.has(request.itemId)) return;
  inFlight.add(request.itemId);
  void run(request, 0);
}

/** La frise d'image, une lettre par vignette ; `?` là où une planche manquait. */
function cellString(samples: readonly ThumbnailMeasure[], intervalMs: number): string {
  if (samples.length === 0) return "";
  const kinds = new Map(samples.map((s) => [s.ms, classifyCell(s)]));
  let out = "";
  for (let ms = samples[0].ms; ms <= samples[samples.length - 1].ms; ms += intervalMs) out += kinds.get(ms) ?? "?";
  return out;
}

const mmss = (ms: number): string =>
  `${String(Math.floor(ms / 60_000))}:${String(Math.floor((ms / 1000) % 60)).padStart(2, "0")}`;

async function run(request: TailAnalysisRequest, deferrals: number): Promise<void> {
  const { itemId, runtimeMs } = request;
  let deferred = false;
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
      cells: cellString(samples, intervalMs),
      audio: null,
      providerSpans: request.providerSpans,
      episode: request.isEpisode,
    };
    const from = audioWindowStart(findSkeleton(new Timeline(input)), runtimeMs);
    let audioNote = "vignettes seules";
    if (from !== null && audioAvailable() && (await detectDecoder())) {
      if (await otherViewerTranscoding(itemId)) {
        if (deferrals < BUSY_MAX_DEFERRALS) {
          countAudioDeferral();
          deferred = true;
          setTimeout(() => void run(request, deferrals + 1), deferMs);
          return;
        }
        coolDown(itemId, FAILURE_COOLDOWN_MS);
        return;
      }
      countAudioJob();
      const heard = await withAudioSlot(() =>
        listenToTail({ itemId, mediaSourceId: request.mediaSourceId, runtimeMs, fromMs: from, jellyfinUrl: request.jellyfinUrl, apiKey: request.apiKey }),
      );
      if (heard.ok) {
        countAudioWindow(heard.bytes, heard.elapsedMs);
        input.audio = { fromMs: heard.fromMs, classes: heard.classes };
        audioNote = `audio ${(heard.bytes / 1e6).toFixed(1)} Mo en ${(heard.elapsedMs / 1000).toFixed(1)} s`;
      } else {
        // Les vignettes seules ; le verdict le dira, et l'audio sera retenté plus tard.
        audioNote = `audio indisponible (${heard.failure})`;
        coolDown(itemId, FAILURE_COOLDOWN_MS);
      }
    }
    const verdict = readTail(input);
    if (input.audio !== null) countAudioOutcome(verdict !== null && verdict.scenes.length > 0);
    if (verdict === null) {
      coolDown(itemId, NOTHING_FOUND_COOLDOWN_MS);
      console.info(`[fin] ${itemId} : rien de sûr (${audioNote}) — rien d'enregistré`);
      return;
    }
    await storeTailVerdict(itemId, runtimeMs, verdict);
    const scenes = verdict.scenes.map((s) => mmss(s.startMs)).join(", ");
    console.info(
      `[fin] ${itemId} : générique ${mmss(verdict.creditsStartMs)}, ` +
        `${verdict.scenes.length > 0 ? `scène(s) ${scenes}` : "pas de scène après"} (${audioNote})`,
    );
  } catch (error) {
    console.warn(`[fin] ${itemId} : analyse abandonnée (${String(error)})`);
    coolDown(itemId, FAILURE_COOLDOWN_MS);
  } finally {
    if (!deferred) inFlight.delete(itemId);
  }
}
