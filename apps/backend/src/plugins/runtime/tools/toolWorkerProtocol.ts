import { resolve, sep } from "path";
import { z } from "zod";
import type { WorkerMessage, WorkerRequest } from "../pluginServerRuntime";

/**
 * La porte du protocole de l'ouvrier (contrat `WorkerRequest`) : chaque ligne
 * que l'invité écrit est relue ICI, par Zod, avant d'atteindre Python. Une
 * requête invalide reçoit `invalid` de l'hôte et n'atteint jamais l'ouvrier.
 * Les options sont la liste FERMÉE du contrat ; `output` est rendu ABSOLU
 * sous le dossier de données (jamais `..`, jamais un nom de module natif,
 * jamais un `%` que yt-dlp lirait comme un modèle).
 */

const id = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const youtubeUrl = /^https:\/\/((www|music|m)\.)?youtube\.com\/[^\s\0]{1,1500}$|^https:\/\/youtu\.be\/[^\s\0]{1,200}$/;
const search = /^ytsearch\d{1,2}:[^\n\r\0]{1,200}$/;
const key = z.string().regex(/^[a-z0-9_]{1,30}$/);

const plainValue = z.string().max(100).regex(/^[^\n\r\0]*$/);
// Le visitorData d'InnerTube (~450 caractères) : la SEULE valeur longue, alphabet borné.
const VISITOR_DATA = /^[A-Za-z0-9_%=-]{20,1024}$/;

/** Chaque valeur d'`extractorArgs` : 100 caractères au plus, sauf `youtube.visitor_data` (une seule, bornée). */
function extractorArgsValid(args: Record<string, Record<string, string[]>>): boolean {
  return Object.entries(args).every(([ie, byKey]) =>
    Object.entries(byKey).every(([name, values]) =>
      ie === "youtube" && name === "visitor_data"
        ? values.length === 1 && VISITOR_DATA.test(values[0])
        : values.every((v) => plainValue.safeParse(v).success),
    ),
  );
}

const options = z
  .object({
    extractorArgs: z
      .record(key, z.record(key, z.array(z.string().max(1024)).max(10)))
      .refine(extractorArgsValid, "valeur refusée")
      .optional(),
    format: z.string().max(200).regex(/^[A-Za-z0-9_\-+/[\]=<>!*.,:^$?~ ]+$/).optional(),
    socketTimeoutS: z.number().int().min(1).max(120).optional(),
    retries: z.number().int().min(0).max(20).optional(),
    concurrentFragments: z.number().int().min(1).max(8).optional(),
    flat: z.boolean().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict()
  .refine((o) => !o.extractorArgs || Object.keys(o.extractorArgs).length <= 5, "trop d'extracteurs");

const request = z.discriminatedUnion("op", [
  z.object({ id, op: z.literal("version") }).strict(),
  z.object({ id, op: z.literal("extract"), target: z.string().refine((t) => youtubeUrl.test(t) || search.test(t)), options: options.optional() }).strict(),
  z
    .object({
      id,
      op: z.literal("download"),
      url: z.string().regex(youtubeUrl),
      formatId: z.string().regex(/^[A-Za-z0-9_\-+]{1,40}$/),
      output: z.string().regex(/^(?!\/)(?!.*\.\.)[A-Za-z0-9_\-./]{1,200}$/),
      options: options.optional(),
    })
    .strict(),
  z.object({ id, op: z.literal("cancel"), target: id }).strict(),
]);

const NATIVE = /\.(so|pyd|dylib|dll)$/i;
export const MAX_REQUEST_LINE = 64 * 1024;

export type CheckedLine = { forward: string } | { reply: WorkerMessage };

/** Une ligne de l'invité : la ligne à passer à Python, ou la réponse de refus de l'hôte. */
export function checkWorkerLine(line: string, dataDir: string): CheckedLine | null {
  if (line.trim() === "") return null;
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  const parsed = line.length <= MAX_REQUEST_LINE ? request.safeParse(raw) : null;
  const rawId = raw && typeof raw === "object" ? (raw as { id?: unknown }).id : undefined;
  const replyId = typeof rawId === "number" && Number.isSafeInteger(rawId) ? rawId : -1;
  const refuse = (message: string): CheckedLine => ({ reply: { id: replyId, ok: false, error: { code: "invalid", message } } });
  if (!parsed?.success) return refuse("requête refusée par l'hôte");
  const req: WorkerRequest = parsed.data;
  if (req.op !== "download") return { forward: JSON.stringify(req) };
  const base = resolve(dataDir);
  const output = resolve(base, req.output);
  if (!output.startsWith(base + sep) || NATIVE.test(output)) return refuse("sortie hors du dossier de données");
  return { forward: JSON.stringify({ ...req, output }) };
}
