/**
 * La validation d'un lot de verre, côté principal.
 *
 * La page n'est jamais crue sur parole (`ipc/registry.ts` pour la règle
 * générale) : un nombre non fini ou démesuré passé à `setFrame:` peut faire
 * lever AppKit, et une exception Objective-C ne se rattrape pas depuis
 * JavaScript — elle tue le processus.
 *
 * Région par région : une région invalide est écartée, les autres passent. Un lot
 * rejeté en bloc laisserait aussi passer à la trappe les RETRAITS qu'il portait,
 * et le verre d'un panneau fermé resterait à l'écran.
 */

import { z } from "zod";
import {
  GLASS_APPEARANCES,
  GLASS_LEVELS,
  MAX_ID_LENGTH,
  MAX_REGIONS,
  MAX_SAMPLE_RECTS,
  MAX_TRANSITION_MS,
  SAMPLE_UNDER,
  type GlassSampleRect,
  type LiquidGlassBatch,
  type NativeGlassRegion,
} from "./protocol";

/** Au-delà, ce n'est plus une fenêtre : c'est une valeur folle. */
const COORD_LIMIT = 100_000;

const finite = z.number().finite();
const coord = finite.min(-COORD_LIMIT).max(COORD_LIMIT);
const size = finite.min(0).max(COORD_LIMIT);
const id = z.string().min(1).max(MAX_ID_LENGTH);
const unit = finite.min(0).max(1);
/** Une Bézier rabotée à [0, 1] — l'animateur d'AppKit n'en prend pas d'autre. */
const ease = z.tuple([unit, unit, unit, unit]);

/** `#RRGGBB` ou `#RRGGBBAA` — la forme que `nativeGlass.ts` sait convertir. */
export const TINT_PATTERN = /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/;

const regionSchema = z.object({
  id,
  x: coord,
  y: coord,
  width: size,
  height: size,
  radius: finite.min(0).max(COORD_LIMIT),
  level: z.enum(GLASS_LEVELS),
  tint: z.string().regex(TINT_PATTERN).nullable(),
  interactive: z.boolean(),
  z: coord,
  group: id.optional(),
  spacing: finite.min(0).max(1000).optional(),
  transition: finite.min(0).max(MAX_TRANSITION_MS).optional(),
  spring: z.object({ response: finite.min(0.05).max(5), dampingFraction: finite.min(0.1).max(4) }).optional(),
  appearance: z.enum(GLASS_APPEARANCES).optional(),
  materialize: z
    .object({
      rise: finite.min(-200).max(200),
      scale: finite.min(0.5).max(1.5),
      originX: unit,
      originY: unit,
      delay: finite.min(0).max(MAX_TRANSITION_MS),
      exit: finite.min(0).max(MAX_TRANSITION_MS),
      enterEase: ease,
      exitEase: ease,
    })
    .optional(),
});

const batchSchema = z.object({
  enabled: z.boolean().optional(),
  upserts: z.array(z.unknown()).max(MAX_REGIONS * 4),
  removes: z.array(z.unknown()).max(MAX_REGIONS * 4),
});

/** Une région validée, aux seuls champs du protocole. */
function toRegion(parsed: z.infer<typeof regionSchema>): NativeGlassRegion {
  const { group, spacing, transition, spring, appearance, materialize, ...base } = parsed;
  return {
    ...base,
    ...(group === undefined ? {} : { group }),
    ...(spacing === undefined ? {} : { spacing }),
    ...(transition === undefined ? {} : { transition }),
    ...(spring === undefined ? {} : { spring }),
    ...(appearance === undefined ? {} : { appearance }),
    ...(materialize === undefined ? {} : { materialize }),
  };
}

export interface ParsedBatch {
  batch: LiquidGlassBatch;
  /** Régions et identifiants écartés — journalisés par l'appelant, jamais muets. */
  rejected: number;
}

/** Le lot, nettoyé ; `null` si sa forme même est fausse. */
export function parseBatch(raw: unknown): ParsedBatch | null {
  const shape = batchSchema.safeParse(raw);
  if (!shape.success) return null;
  let rejected = 0;
  const upserts: NativeGlassRegion[] = [];
  for (const candidate of shape.data.upserts) {
    const region = regionSchema.safeParse(candidate);
    if (region.success) upserts.push(toRegion(region.data));
    else rejected += 1;
  }
  const removes: string[] = [];
  for (const candidate of shape.data.removes) {
    const valid = id.safeParse(candidate);
    if (valid.success) removes.push(valid.data);
    else rejected += 1;
  }
  const enabled = shape.data.enabled;
  return {
    batch: { ...(enabled === undefined ? {} : { enabled }), upserts, removes },
    rejected,
  };
}

const sampleRectsSchema = z
  .array(z.object({ x: coord, y: coord, width: size, height: size, under: z.enum(SAMPLE_UNDER).optional() }))
  .max(MAX_SAMPLE_RECTS);

/** Les rectangles de `sample`, aux seuls champs du protocole, ou `null` si leur forme est fausse. */
export function parseSampleRects(raw: unknown): GlassSampleRect[] | null {
  const parsed = sampleRectsSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data.map(({ under, ...rect }) => (under === undefined ? rect : { ...rect, under }));
}
