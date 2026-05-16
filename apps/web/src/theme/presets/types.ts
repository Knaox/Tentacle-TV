/**
 * Theme preset = a self-contained Custom CSS bundle the admin can apply in
 * one click. Each preset overrides brand tokens, surfaces, fonts and ambient
 * effects, and toggles seasonal ornaments on the Tentacle logo via the
 * `--xmas-display` / `--easter-display` / `--halloween-display` variables.
 */

export type PresetId =
  | "default"
  | "christmas"
  | "easter"
  | "halloween";

export interface ThemePreset {
  id: PresetId;
  /** i18n key under the `adminTheme` namespace. */
  nameKey: string;
  /** i18n key for the description. */
  descriptionKey: string;
  /** Three hex colors for the small swatch in the picker UI. */
  swatch: readonly [string, string, string];
  /** Full Custom CSS to PUT on `/api/theme/custom-css` when applied. */
  css: string;
  /**
   * Partial token override to PUT on `/api/theme/tokens` when applied.
   * This is the bridge to mobile/TV — they can't apply CSS but they do
   * read the token override and feed it to `applyThemeOverride()`.
   * Use to shift brand.glow / border.focus / etc. to seasonal hues so
   * mobile/TV "feel" the preset (without the decorative particles).
   */
  tokens?: Record<string, unknown>;
}
