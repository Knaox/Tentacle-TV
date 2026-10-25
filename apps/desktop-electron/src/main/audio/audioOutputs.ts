/**
 * Les sorties audio que mpv voit (`audio-device-list`), réduites à celles
 * qu'on PROPOSE, et ce que chacune permet.
 *
 * Pur. mpv énumère chaque périphérique une fois par pilote de sortie : sur le
 * Mac, les haut-parleurs paraissent en `coreaudio/…` ET en `avfoundation/…`
 * (relevé sur la libmpv 0.40 livrée). On ne garde que la famille qui fait le
 * travail sur chaque système — sinon l'interface aurait deux fois chaque
 * sortie, dont une sans mode exclusif.
 */

import type { AudioBridgeOutput } from "./audioBridgeContract";
import type { Platform } from "./audioOptions";

interface MpvDevice {
  name: string;
  description: string;
}

/** Les familles proposées, par système. */
const FAMILIES: Readonly<Record<Platform, readonly string[]>> = {
  darwin: ["coreaudio/"],
  win32: ["wasapi/"],
  // PipeWire d'abord ; ALSA pour la sortie DIRECTE d'une carte (`hw:`).
  linux: ["pipewire/", "pulse/", "alsa/"],
};

/**
 * La sortie exclusive est-elle possible sur ce périphérique ?
 *
 * - `coreaudio/` : hog mode (`coreaudio_exclusive`) — vérifié sur ce Mac.
 * - `wasapi/` : mode exclusif WASAPI — code seulement, non vérifié ici.
 * - `pipewire/` : flux exclusif — code seulement, non vérifié ici.
 * - `alsa/hw:` : la carte en direct, sans mélangeur. `plughw`, `default`,
 *   `dmix` convertissent ou mélangent : pas exclusifs.
 * - `pulse/` : PulseAudio mélange toujours.
 * - `auto` : la sortie par défaut du système, exclusive là où sa famille l'est.
 */
export function exclusiveCapable(platform: Platform, deviceName: string): boolean {
  if (deviceName === "auto") return true;
  if (deviceName.startsWith("coreaudio/")) return platform === "darwin";
  if (deviceName.startsWith("wasapi/")) return platform === "win32";
  if (deviceName.startsWith("pipewire/")) return platform === "linux";
  if (deviceName.startsWith("alsa/")) return platform === "linux" && /^alsa\/hw:/.test(deviceName);
  return false;
}

function isDevice(value: unknown): value is MpvDevice {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v["name"] === "string" && typeof v["description"] === "string";
}

/** Le JSON de `audio-device-list` → les sorties proposées, `auto` en tête. */
export function parseOutputs(platform: Platform, json: string | null): AudioBridgeOutput[] {
  let raw: unknown;
  try {
    raw = json === null ? [] : JSON.parse(json);
  } catch {
    raw = [];
  }
  const devices = Array.isArray(raw) ? raw.filter(isDevice) : [];
  const families = FAMILIES[platform];
  const kept = devices.filter((d) => d.name === "auto" || families.some((f) => d.name.startsWith(f)));
  // Une seule famille sur Linux quand PipeWire est là : PulseAudio n'en est
  // alors que l'émulation, les mêmes sorties en double.
  const hasPipewire = kept.some((d) => d.name.startsWith("pipewire/"));
  const deduped = hasPipewire ? kept.filter((d) => !d.name.startsWith("pulse/")) : kept;
  const outputs = deduped.map((d) => ({
    id: d.name,
    name: d.description,
    exclusiveCapable: exclusiveCapable(platform, d.name),
  }));
  if (!outputs.some((o) => o.id === "auto")) {
    outputs.unshift({ id: "auto", name: "", exclusiveCapable: exclusiveCapable(platform, "auto") });
  }
  return outputs.sort((a, b) => (a.id === "auto" ? -1 : b.id === "auto" ? 1 : 0));
}
