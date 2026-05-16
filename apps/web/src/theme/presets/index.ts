import type { ThemePreset } from "./types";
import { CHRISTMAS_PRESET } from "./christmas";
import { EASTER_PRESET } from "./easter";
import { HALLOWEEN_PRESET } from "./halloween";

/**
 * Default preset = no custom CSS. Selecting it from the admin clears any
 * active preset and reverts to the canonical Tentacle look.
 */
const DEFAULT_PRESET: ThemePreset = {
  id: "default",
  nameKey: "presetDefaultName",
  descriptionKey: "presetDefaultDesc",
  swatch: ["#8B5CF6", "#EC4899", "#0a0a0a"],
  css: "",
};

export const PRESETS: readonly ThemePreset[] = [
  DEFAULT_PRESET,
  CHRISTMAS_PRESET,
  EASTER_PRESET,
  HALLOWEEN_PRESET,
];

export type { ThemePreset, PresetId } from "./types";
export { DEFAULT_PRESET, CHRISTMAS_PRESET, EASTER_PRESET, HALLOWEEN_PRESET };
