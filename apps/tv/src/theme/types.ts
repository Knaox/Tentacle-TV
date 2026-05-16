import type { PartialThemeTokens } from "@tentacle-tv/theme";

/** Theme state served by `GET /api/theme`. Mirrors the backend `ThemeState`. */
export interface BackendThemeState {
  id: string;
  name: string;
  tokens: PartialThemeTokens;
  customCss: {
    source: "inline" | "url" | null;
    url: string | null;
    hash: string | null;
    hasContent: boolean;
  };
}
