import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { cls } from "../../../pages/adminUtils";
import {
  clearThemeCustomCss,
  fetchThemeCss,
  updateThemeCustomCss,
  useTheme,
  type BackendThemeState,
} from "../../../theme";
import { backendUrl } from "../../../main";

interface ThemeCustomCssSectionProps {
  state: BackendThemeState;
}

export function ThemeCustomCssSection({ state }: ThemeCustomCssSectionProps) {
  const { t } = useTranslation("adminTheme");
  const queryClient = useQueryClient();
  const { refresh } = useTheme();

  const initialSource = state.customCss.source ?? "inline";
  const [source, setSource] = useState<"inline" | "url">(initialSource);
  const [content, setContent] = useState("");
  const [url, setUrl] = useState(state.customCss.url ?? "");
  const [error, setError] = useState<string | null>(null);

  const { data: existingCss } = useQuery({
    queryKey: ["theme-css", backendUrl, state.customCss.hash ?? ""],
    queryFn: () => fetchThemeCss(backendUrl, state.customCss.hash),
    enabled: state.customCss.hasContent,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (source === "inline" && existingCss !== undefined && content === "") {
      setContent(existingCss);
    }
  }, [existingCss, source, content]);

  useEffect(() => {
    setUrl(state.customCss.url ?? "");
  }, [state.customCss.url]);

  const applyMutation = useMutation({
    mutationFn: () => {
      if (source === "inline") {
        return updateThemeCustomCss(backendUrl, { source: "inline", content });
      }
      return updateThemeCustomCss(backendUrl, { source: "url", url });
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["theme"] });
      queryClient.invalidateQueries({ queryKey: ["theme-css"] });
      refresh();
    },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  });

  const clearMutation = useMutation({
    mutationFn: () => clearThemeCustomCss(backendUrl),
    onSuccess: () => {
      setError(null);
      setContent("");
      setUrl("");
      queryClient.invalidateQueries({ queryKey: ["theme"] });
      queryClient.invalidateQueries({ queryKey: ["theme-css"] });
      refresh();
    },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  });

  const busy = applyMutation.isPending || clearMutation.isPending;

  return (
    <div className={cls.card}>
      <h2 className="mb-1 text-lg font-semibold text-white">
        {t("customCssTitle")}
      </h2>
      <p className="mb-4 text-sm text-white/55">{t("customCssHelp")}</p>

      <div className="mb-4 rounded-lg border border-[var(--status-warning)]/35 bg-[var(--status-warning-bg)] p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--status-warning-fg)]">
          {t("customCssRiskTitle")}
        </h4>
        <p className="mt-1 text-xs text-white/65">{t("customCssRisk")}</p>
      </div>

      <div className="mb-4">
        <label className={cls.lbl}>{t("sourceLabel")}</label>
        <div className="flex gap-2">
          <SourceToggle
            label={t("sourceInline")}
            active={source === "inline"}
            onClick={() => setSource("inline")}
          />
          <SourceToggle
            label={t("sourceUrl")}
            active={source === "url"}
            onClick={() => setSource("url")}
          />
        </div>
      </div>

      {source === "inline" ? (
        <div className="mb-4">
          <label className={cls.lbl}>{t("inlineLabel")}</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("inlinePlaceholder")}
            rows={12}
            className={`${cls.inp} h-auto resize-y py-3 font-mono text-xs`}
          />
        </div>
      ) : (
        <div className="mb-4">
          <label className={cls.lbl}>{t("urlLabel")}</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("urlPlaceholder")}
            maxLength={4096}
            className={cls.inp}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => applyMutation.mutate()}
          disabled={busy}
          className={cls.bp}
          style={cls.bpStyle}
        >
          {applyMutation.isPending ? t("saving") : t("customCssApply")}
        </button>
        {state.customCss.hasContent && (
          <button
            type="button"
            onClick={() => clearMutation.mutate()}
            disabled={busy}
            className={cls.bd}
          >
            {clearMutation.isPending ? t("saving") : t("customCssClear")}
          </button>
        )}
      </div>

      <div className="mt-4 text-xs text-white/45">
        {state.customCss.hasContent ? (
          <>
            <span className={`${cls.chip} bg-[var(--status-success-bg)] text-[var(--status-success-fg)]`}>
              {t("customCssCurrent")} · {state.customCss.source}
            </span>
            {state.customCss.hash && (
              <span className="ml-2 font-mono">
                {t("customCssHash")}: {state.customCss.hash}
              </span>
            )}
          </>
        ) : (
          <span className={`${cls.chip} bg-white/[0.06] text-white/55`}>
            {t("customCssNone")}
          </span>
        )}
      </div>

      {error && (
        <p className="mt-3 text-xs text-[var(--status-error-fg)]">
          {t("errorPrefix")}: {error}
        </p>
      )}
    </div>
  );
}

function SourceToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-lg px-3 text-xs font-semibold transition ${
        active
          ? "bg-[var(--brand)] text-white"
          : "bg-white/[0.06] text-white/60 hover:bg-white/[0.10] hover:text-white/80"
      }`}
    >
      {label}
    </button>
  );
}
