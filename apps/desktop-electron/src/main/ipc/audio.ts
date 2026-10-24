/**
 * Octave — les commandes du moteur audio natif, exposées à la page
 * (`audio_*`, évènement `audio://event`). Contrat : `audio/audioBridgeContract.ts`.
 *
 * Mêmes deux gardes que toute commande (`registry.ts`) : l'émetteur est notre
 * page, les arguments passent un schéma zod. Une troisième, propre au son :
 * une SOURCE ne vient que du serveur Tentacle réglé au démarrage, en http(s)
 * (`refuseSource`) — c'est sur ces requêtes que le principal pose le jeton.
 *
 * Sans libmpv chargeable, rien n'est déclaré : `supportsNativeAudio()` côté page
 * devient faux, et la musique prend le moteur `<audio>` du web.
 */

import { app } from "electron";
import { z } from "zod";
import { NativeAudioEngine } from "../audio/audioEngine";
import { refuseSource } from "../audio/audioSources";
import type { Platform } from "../audio/audioOptions";
import { libmpvAvailable } from "../video/mpvFfi";
import { sendToPage } from "../pageEvents";
import type { CommandRegistry } from "./registry";

const KEY = z.string().min(1).max(512);
const MS = z.number().finite().nonnegative();
const FORMAT = z.object({
  codec: z.string().max(32),
  container: z.string().max(128).nullable(),
  sampleRate: z.number().nullable(),
  bitDepth: z.number().nullable(),
  bitrate: z.number().nullable(),
  channels: z.number().nullable(),
  lossless: z.boolean(),
});
const TRACK = z.object({ trackKey: KEY, albumKey: KEY.nullable(), durationMs: MS.nullable(), format: FORMAT.nullable() });
const GAIN = z.number().finite().nullable();
const SOURCE = z.object({
  url: z.string().min(1).max(4096),
  origin: z.enum(["library", "plugin"]),
  complete: z.boolean(),
  sizeBytes: MS.nullable(),
  durationMs: MS.nullable(),
  replayGain: z.object({ trackGainDb: GAIN, trackPeak: GAIN, albumGainDb: GAIN, albumPeak: GAIN }).nullable(),
  expiresAt: z.number().finite().nullable(),
});
const RG_MODE = z.enum(["off", "track", "album", "auto"]);
const START = z.object({
  serverOrigin: z.string().min(1).max(2048),
  headers: z.record(z.string().max(4096)),
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
  replayGain: RG_MODE,
  deviceId: z.string().max(512).nullable(),
  exclusive: z.boolean(),
});
const CONTROL = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("stop") }),
  z.object({ action: z.literal("seek"), value: MS }),
  z.object({ action: z.literal("volume"), value: z.number().min(0).max(1) }),
  z.object({ action: z.literal("muted"), value: z.boolean() }),
  z.object({ action: z.literal("replayGain"), mode: RG_MODE }),
]);
const NO_ARGS = z.object({}).passthrough();

let engine: NativeAudioEngine | null = null;
let serverOrigin: string | null = null;

function platform(): Platform {
  return process.platform === "win32" || process.platform === "linux" ? process.platform : "darwin";
}

/**
 * Développement seulement : `TENTACLE_AUDIO_MPV_LOG=<fichier>` écrit le journal
 * verbeux de l'instance audio (diagnostic d'un clic lent). Jamais dans un paquet.
 */
function devLogOptions(): Record<string, string> {
  const file = process.env["TENTACLE_AUDIO_MPV_LOG"];
  return !app.isPackaged && file ? { "log-file": file, "msg-level": "all=v" } : {};
}

function running(): NativeAudioEngine {
  if (engine === null) throw new Error("moteur audio non démarré");
  return engine;
}

/** La source n'est confiée à mpv que si elle vient du serveur réglé. */
function checked(source: z.infer<typeof SOURCE>): z.infer<typeof SOURCE> {
  const refusal = refuseSource(source.url, serverOrigin);
  if (refusal !== null) throw new Error(refusal);
  return source;
}

export function registerAudioCommands(registry: CommandRegistry): void {
  if (!libmpvAvailable()) {
    console.warn("[audio] aucune libmpv chargeable : la musique prendra le moteur web");
    return;
  }
  registry
    .add("audio_engine_start", {
      schema: START,
      run: async (args) => {
        engine ??= new NativeAudioEngine({ platform: platform(), extraOptions: devLogOptions() }, (event) => sendToPage("audio://event", event));
        serverOrigin = args.serverOrigin;
        return engine.start(args);
      },
    })
    .add("audio_engine_stop", {
      schema: NO_ARGS,
      run: async () => {
        const stopping = engine;
        engine = null;
        serverOrigin = null;
        await stopping?.dispose();
      },
    })
    .add("audio_play", {
      schema: z.object({ track: TRACK, source: SOURCE, startMs: MS }),
      run: ({ track, source, startMs }) => running().play(track, checked(source), startMs),
    })
    .add("audio_set_next", {
      schema: z.object({ track: TRACK.nullable(), source: SOURCE.nullable() }),
      run: ({ track, source }) => running().setNext(track, source === null ? null : checked(source)),
    })
    .add("audio_swap_source", {
      schema: z.object({ trackKey: KEY, source: SOURCE }),
      run: ({ trackKey, source }) => running().swap(trackKey, checked(source)),
    })
    .add("audio_control", { schema: CONTROL, run: (c) => running().control(c) })
    .add("audio_list_outputs", { schema: NO_ARGS, run: () => running().listOutputs() })
    .add("audio_set_output", {
      schema: z.object({ deviceId: z.string().max(512).nullable(), exclusive: z.boolean() }),
      run: ({ deviceId, exclusive }) => running().setOutput(deviceId, exclusive),
    });
}

/**
 * À la fermeture : la lecture s'arrête et la sortie (le mode exclusif avec) est
 * rendue tout de suite, sans attendre la fin du processus.
 */
export function stopAudio(): void {
  engine?.control({ action: "stop" });
}
