import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { cls } from "../../../pages/adminUtils";
import {
  clearThemeCustomCss,
  clearThemeTokens,
  useTheme,
} from "../../../theme";
import { backendUrl } from "../../../main";

export function ThemeResetSection() {
  const { t } = useTranslation("adminTheme");
  const queryClient = useQueryClient();
  const { refresh } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      await clearThemeTokens(backendUrl);
      await clearThemeCustomCss(backendUrl);
    },
    onSuccess: () => {
      setError(null);
      setConfirming(false);
      queryClient.invalidateQueries({ queryKey: ["theme"] });
      queryClient.invalidateQueries({ queryKey: ["theme-css"] });
      refresh();
    },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  });

  return (
    <div className={cls.sub}>
      <h3 className="text-base font-semibold text-white">
        {t("resetAllSectionTitle")}
      </h3>
      <p className="text-xs text-white/55">{t("resetAllLabel")}</p>
      {confirming ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className={cls.bd}
          >
            {mutation.isPending ? t("saving") : t("resetAllConfirm")}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className={cls.bs}
          >
            {t("brandColorReset")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={cls.bd}
        >
          {t("resetAllButton")}
        </button>
      )}
      {error && (
        <p className="text-xs text-[var(--status-error-fg)]">
          {t("errorPrefix")}: {error}
        </p>
      )}
    </div>
  );
}
