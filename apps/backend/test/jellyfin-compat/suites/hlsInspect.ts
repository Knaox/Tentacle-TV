/**
 * Ce qu'un remux HLS a réellement produit, vu de l'extérieur : l'entrée
 * d'échantillon du segment d'initialisation fMP4, et la commande ffmpeg que
 * Jellyfin a consignée dans son journal (une copie y dit `-codec:v:0 copy`).
 */

import { expect } from "vitest";
import type { MediaSource } from "../../../../../packages/shared/src/types/media";
import { docker } from "../docker";
import { AVFOUNDATION_PROFILE } from "./profiles";
import { ctx, expectStatus, installedAppHeaders, proxy, tentacleClient } from "./support";

/** La première URI (ligne non commentée) d'un manifeste, résolue sur son adresse. */
export function firstUri(manifest: string, base: string): string {
  const line = manifest.split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#"));
  if (!line) throw new Error(`manifeste sans URI :\n${manifest.slice(0, 300)}`);
  return new URL(line, base).toString();
}

/** Le segment d'initialisation (`#EXT-X-MAP`) d'une variante fMP4. */
export function initUri(variant: string, base: string): string {
  const line = variant.split("\n").find((l) => l.startsWith("#EXT-X-MAP:"));
  const uri = line ? /URI="([^"]+)"/.exec(line)?.[1] : undefined;
  if (!uri) throw new Error(`variante sans segment d'initialisation :\n${variant.slice(0, 300)}`);
  return new URL(uri, base).toString();
}

/** Les entrées HEVC (`hvc1`, `hev1`…) que nomme un segment d'initialisation. */
export function hevcSampleEntries(init: ArrayBuffer): string[] {
  const text = Buffer.from(init).toString("latin1");
  return ["hvc1", "hev1", "dvh1", "dvhe"].filter((tag) => text.includes(tag));
}

/** Le journal ffmpeg le plus récent d'un titre : son nom (Remux / Transcode) et sa commande. */
export function lastFfmpegLog(itemId: string): { name: string; command: string } {
  const res = docker(["exec", ctx().jellyfin.container, "sh", "-c",
    `f=$(ls -t /config/log/FFmpeg.*${itemId}*.log 2>/dev/null | head -1); [ -n "$f" ] && basename "$f" && head -c 6000 "$f"`,
  ], { allowFail: true });
  if (res.code !== 0) throw new Error(`aucun journal ffmpeg pour ${itemId}`);
  const [name, ...rest] = res.stdout.split("\n");
  return { name, command: rest.join("\n") };
}

export interface AvFoundationPlay {
  /** L'étiquette que Jellyfin DIT (Jellyfin 12.1 ne la dit plus : `undefined`). */
  tag: string | undefined;
  direct: boolean;
  /** Remux : ses raisons, les entrées HEVC du segment d'init, le journal ffmpeg. */
  reasons?: string | null;
  entries?: string[];
  log?: { name: string; command: string };
}

/**
 * Ce que Jellyfin fait d'un titre pour un lecteur AVFoundation : lecture
 * directe, ou remux HLS — joué jusqu'au premier segment, inspecté, puis arrêté.
 */
export async function playForAvFoundation(itemId: string): Promise<AvFoundationPlay> {
  const client = tentacleClient(ctx().user.token);
  const info = await client.getPlaybackInfo(itemId, { userId: ctx().user.id, deviceProfile: AVFOUNDATION_PROFILE });
  const ms: MediaSource = info.MediaSources[0]!;
  const tag = ms.MediaStreams.find((s) => s.Type === "Video")?.CodecTag ?? undefined;
  if (ms.SupportsDirectPlay && !ms.TranscodingUrl) return { tag, direct: true };
  const master = `${ctx().backend.url}/api/jellyfin${ms.TranscodingUrl}`;
  const variantUrl = firstUri(await (await fetch(master)).text(), master);
  const variant = await (await fetch(variantUrl)).text();
  const entries = hevcSampleEntries(await (await fetch(initUri(variant, variantUrl))).arrayBuffer());
  expectStatus(await fetch(firstUri(variant, variantUrl)), 200);
  const log = lastFfmpegLog(itemId);
  await proxy(`Videos/ActiveEncodings?deviceId=${encodeURIComponent(client.getDeviceId())}&playSessionId=${info.PlaySessionId}`, {
    method: "DELETE", headers: installedAppHeaders(ctx().user.token),
  });
  return { tag, direct: false, reasons: new URL(master).searchParams.get("TranscodeReasons"), entries, log };
}

/** Un remux qui COPIE l'image et la ré-étiquette `hvc1` : ce qu'AVFoundation affiche. */
export function expectCopiedAsHvc1(play: AvFoundationPlay): void {
  expect(play.direct).toBe(false);
  expect(play.entries).toEqual(["hvc1"]);
  expect(play.log?.name).toMatch(/^FFmpeg\.Remux/);
  expect(play.log?.command).toContain("-codec:v:0 copy");
  expect(play.log?.command).toContain("-tag:v:0 hvc1");
}
