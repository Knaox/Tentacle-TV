import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { cls } from "../../../pages/adminUtils";
import {
  clearThemeCustomCss,
  clearThemeTokens,
  updateThemeCustomCss,
  updateThemeTokens,
  useTheme,
} from "../../../theme";
import type { PartialThemeTokens } from "@tentacle-tv/theme";
import { backendUrl } from "../../../main";
import { PRESETS, type ThemePreset } from "../../../theme/presets";

/**
 * One-click preset picker. Applying a preset:
 *   1. PUT `/api/theme/tokens` with the preset's seasonal overrides (so
 *      mobile/TV — which can't read CustomCSS — still pick up the brand
 *      shift via `applyThemeOverride`)
 *   2. PUT `/api/theme/custom-css` with the preset's full bundle (web/desktop
 *      decoration: ornaments, particles, ambient halos)
 *   3. invalidate the theme query so the live UI reflects immediately.
 *
 * "default" preset has neither tokens nor css → both endpoints are cleared.
 */
export function ThemePresetSection() {
  const { t } = useTranslation("adminTheme");
  const queryClient = useQueryClient();
  const { refresh } = useTheme();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyMutation = useMutation({
    mutationFn: async (preset: ThemePreset) => {
      if (preset.tokens) {
        await updateThemeTokens(
          backendUrl,
          preset.tokens as PartialThemeTokens,
        );
      } else {
        await clearThemeTokens(backendUrl).catch(() => {});
      }
      if (!preset.css) {
        await clearThemeCustomCss(backendUrl);
      } else {
        await updateThemeCustomCss(backendUrl, {
          source: "inline",
          content: preset.css,
        });
      }
      return preset;
    },
    onSuccess: (preset) => {
      setError(null);
      setActiveId(preset.id);
      queryClient.invalidateQueries({ queryKey: ["theme"] });
      queryClient.invalidateQueries({ queryKey: ["theme-css"] });
      refresh();
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : String(err)),
  });

  return (
    <div className={cls.card}>
      <h2 className="mb-1 text-lg font-semibold text-white">
        {t("presetSectionTitle")}
      </h2>
      <p className="mb-4 text-sm text-white/55">
        {t("presetSectionHelp")}
      </p>

      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        role="radiogroup"
        aria-label={t("presetSectionTitle")}
      >
        {PRESETS.map((preset) => {
          const selected = activeId === preset.id;
          const pending =
            applyMutation.isPending && applyMutation.variables?.id === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => applyMutation.mutate(preset)}
              disabled={applyMutation.isPending}
              className={`group relative flex h-full flex-col items-stretch overflow-hidden rounded-xl border p-0 text-left transition-all duration-200 disabled:opacity-60 ${
                selected
                  ? "border-[var(--brand)] ring-2 ring-[rgba(var(--brand-rgb),0.4)]"
                  : "border-white/[0.08] hover:border-white/[0.18] hover:scale-[1.02]"
              }`}
              style={{
                background:
                  "linear-gradient(135deg, " +
                  preset.swatch[0] +
                  " 0%, " +
                  preset.swatch[1] +
                  " 60%, " +
                  preset.swatch[2] +
                  " 100%)",
              }}
            >
              <div
                className="flex h-20 items-end justify-end gap-1 p-2"
                aria-hidden
              >
                {preset.swatch.map((color, i) => (
                  <span
                    key={i}
                    className="h-5 w-5 rounded-full border border-white/30 shadow"
                    style={{ background: color }}
                  />
                ))}
              </div>
              <div className="flex-1 bg-black/55 p-3 backdrop-blur-sm">
                <p className="text-sm font-semibold text-white">
                  {t(preset.nameKey)}
                </p>
                <p className="mt-0.5 text-xs text-white/70">
                  {t(preset.descriptionKey)}
                </p>
                {pending && (
                  <p className="mt-2 text-[11px] font-medium text-white/85">
                    {t("saving")}
                  </p>
                )}
                {selected && !pending && (
                  <p className="mt-2 text-[11px] font-medium text-white">
                    {t("presetActive")}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-3 text-xs text-[var(--status-error-fg)]">
          {t("errorPrefix")}: {error}
        </p>
      )}
    </div>
  );
}
