import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DEFAULT_THEME } from "@tentacle-tv/theme";
import { cls } from "../../../pages/adminUtils";
import { updateThemeTokens, type BackendThemeState } from "../../../theme";
import { backendUrl } from "../../../main";
import { useTheme } from "../../../theme";
import {
  hexToRgb,
  rgbToHex,
  rgbToTriplet,
  shiftLightness,
} from "../../../theme/colorUtils";

const HEX_RX = /^#[0-9a-fA-F]{6}$/;

interface ThemeAccentColorSectionProps {
  state: BackendThemeState;
}

export function ThemeAccentColorSection({
  state,
}: ThemeAccentColorSectionProps) {
  const { t } = useTranslation("adminTheme");
  const queryClient = useQueryClient();
  const { refresh } = useTheme();

  const currentAccent =
    state.tokens.color?.brand?.accent ?? DEFAULT_THEME.tokens.color.brand.accent;
  const isOverridden = useMemo(
    () =>
      currentAccent.toLowerCase() !==
      DEFAULT_THEME.tokens.color.brand.accent.toLowerCase(),
    [currentAccent],
  );

  const [value, setValue] = useState(currentAccent.toLowerCase());
  const [error, setError] = useState<string | null>(null);

  const applyMutation = useMutation({
    mutationFn: (hex: string) => {
      const rgb = hexToRgb(hex);
      if (!rgb) throw new Error(t("brandColorInvalid"));
      const base = rgbToHex(rgb);
      const accentLight = shiftLightness(base, 12) ?? base;
      return updateThemeTokens(backendUrl, {
        color: {
          brand: {
            accent: base,
            accentRgb: rgbToTriplet(rgb),
            accentLight,
          },
        },
      });
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["theme"] });
      refresh();
    },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      updateThemeTokens(backendUrl, {
        color: {
          brand: {
            accent: DEFAULT_THEME.tokens.color.brand.accent,
            accentRgb: DEFAULT_THEME.tokens.color.brand.accentRgb,
            accentLight: DEFAULT_THEME.tokens.color.brand.accentLight,
          },
        },
      }),
    onSuccess: () => {
      setError(null);
      setValue(DEFAULT_THEME.tokens.color.brand.accent.toLowerCase());
      queryClient.invalidateQueries({ queryKey: ["theme"] });
      refresh();
    },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  });

  const onApply = () => {
    if (!HEX_RX.test(value)) {
      setError(t("brandColorInvalid"));
      return;
    }
    applyMutation.mutate(value);
  };

  const busy = applyMutation.isPending || resetMutation.isPending;

  return (
    <div className={cls.sub}>
      <h3 className="text-base font-semibold text-white">
        {t("accentSectionTitle")}
      </h3>
      <p className="text-xs text-white/55">{t("accentSectionHelp")}</p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label className={cls.lbl}>{t("brandColorLabel")}</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value}
              onChange={(e) => setValue(e.target.value.toLowerCase())}
              className="h-11 w-12 cursor-pointer rounded-lg border border-white/[0.08] bg-transparent"
            />
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={`${cls.inp} w-32 font-mono uppercase`}
              maxLength={7}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onApply}
            disabled={busy}
            className={cls.bbrand}
          >
            {applyMutation.isPending ? t("saving") : t("brandColorApply")}
          </button>
          {isOverridden && (
            <button
              type="button"
              onClick={() => resetMutation.mutate()}
              disabled={busy}
              className={cls.bs}
            >
              {resetMutation.isPending ? t("saving") : t("brandColorReset")}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-xs text-[var(--status-error-fg)]">
          {t("errorPrefix")}: {error}
        </p>
      )}
    </div>
  );
}
