import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { cls } from "../../../pages/adminUtils";
import { updateThemeName, type BackendThemeState } from "../../../theme";
import { backendUrl } from "../../../main";
import { useTheme } from "../../../theme";

interface ThemeNameSectionProps {
  state: BackendThemeState;
}

export function ThemeNameSection({ state }: ThemeNameSectionProps) {
  const { t } = useTranslation("adminTheme");
  const queryClient = useQueryClient();
  const { refresh } = useTheme();
  const [name, setName] = useState(state.name);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(state.name);
  }, [state.name]);

  const mutation = useMutation({
    mutationFn: (next: string) => updateThemeName(backendUrl, next),
    onSuccess: () => {
      setError(null);
      setSavedAt(Date.now());
      queryClient.invalidateQueries({ queryKey: ["theme"] });
      refresh();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : String(err));
    },
  });

  const onSubmit = () => {
    if (name.trim() === state.name) return;
    mutation.mutate(name.trim());
  };

  return (
    <div className={cls.sub}>
      <h3 className="text-base font-semibold text-white">
        {t("nameSectionTitle")}
      </h3>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className={cls.lbl}>{t("nameLabel")}</label>
          <input
            type="text"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className={cls.inp}
          />
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={mutation.isPending || name.trim() === state.name}
          className={cls.bbrand}
        >
          {mutation.isPending ? t("saving") : t("nameSave")}
        </button>
      </div>
      {error && (
        <p className="text-xs text-[var(--status-error-fg)]">
          {t("errorPrefix")}: {error}
        </p>
      )}
      {savedAt && !error && !mutation.isPending && (
        <p className="text-xs text-[var(--status-success-fg)]">{t("nameSaved")}</p>
      )}
    </div>
  );
}
