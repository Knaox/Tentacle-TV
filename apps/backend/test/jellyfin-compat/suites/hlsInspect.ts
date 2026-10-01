/**
 * Ce qu'un remux HLS a réellement produit, vu de l'extérieur : l'entrée
 * d'échantillon du segment d'initialisation fMP4, et la commande ffmpeg que
 * Jellyfin a consignée dans son journal (une copie y dit `-codec:v:0 copy`).
 */

import { docker } from "../docker";
import { ctx } from "./support";

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
