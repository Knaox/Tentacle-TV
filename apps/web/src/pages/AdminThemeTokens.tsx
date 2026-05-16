import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageTransition } from "../components/PageTransition";
import { cls } from "./adminUtils";
import { getUserInfo } from "../components/userMenu/menuItems";
import {
  fetchThemeState,
  updateThemeTokens,
  useTheme,
} from "../theme";
import { backendUrl } from "../main";
import { TOKEN_CATEGORIES } from "../theme/tokenCatalog";
import { buildTokenPatch } from "../theme/tokenUtils";
import { TokenCategorySection } from "../components/admin/theme/tokens/TokenCategorySection";

const CATEGORY_HELP: Record<string, string> = {
  color: "Surfaces, brand, texte, CTA, bordures et status.",
  blur: "Intensité des flous (backdrop-filter) pour overlays.",
  shadow: "Échelle d'élévation et ombres modales.",
  radius: "Rayons d'arrondi (xs → pill).",
  motion: "Durées, easings et hover (cubic-bezier).",
  layout: "Hauteurs de chrome et gouttières.",
  component: "Tailles de composants (logo, etc.).",
  spacing: "Échelle d'espacement 4-pt (mobile/TV via tokens TS).",
  typography: "Familles et tailles de police (mobile/TV via tokens TS).",
};

export function AdminThemeTokens() {
  const { t } = useTranslation("adminTheme");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refresh } = useTheme();
  const { isAdmin } = getUserInfo();
  const [savingPath, setSavingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError, error: queryError } = useQuery({
    queryKey: ["theme", backendUrl],
    queryFn: () => fetchThemeState(backendUrl),
    enabled: isAdmin,
  });

  const mutation = useMutation({
    mutationFn: ({ path, value }: { path: string; value: string }) => {
      setSavingPath(path);
      return updateThemeTokens(backendUrl, buildTokenPatch(path, value));
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["theme"] });
      refresh();
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : String(err)),
    onSettled: () => setSavingPath(null),
  });

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <PageTransition>
      <div className="px-4 pt-6 pb-16 md:px-12">
        <div className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={() => navigate("/admin/theme")}
            className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-white/55 transition hover:text-white"
          >
            ← {t("tokensBackToTheme")}
          </button>
          <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-white">
            {t("tokensPageTitle")}
          </h1>
          <p className="mb-8 text-sm text-white/55">{t("tokensPageHelp")}</p>

          {isLoading && (
            <div className={cls.card}>
              <p className="text-sm text-white/55">{t("saving")}</p>
            </div>
          )}

          {isError && (
            <div className={cls.card}>
              <p className="text-sm text-[var(--status-error-fg)]">
                {t("errorPrefix")}:{" "}
                {queryError instanceof Error
                  ? queryError.message
                  : String(queryError)}
              </p>
            </div>
          )}

          {error && (
            <div className={`${cls.card} border-[var(--status-error)]/30 bg-[var(--status-error-bg)]`}>
              <p className="text-sm text-[var(--status-error-fg)]">
                {t("errorPrefix")}: {error}
              </p>
            </div>
          )}

          {data && (
            <div className="space-y-3">
              {TOKEN_CATEGORIES.map((cat) => (
                <TokenCategorySection
                  key={cat}
                  state={data}
                  category={cat}
                  title={t(`tokensCategory_${cat}`)}
                  description={CATEGORY_HELP[cat] ?? ""}
                  defaultOpen={cat === "color"}
                  savingPath={savingPath}
                  onApply={(path, value) => mutation.mutate({ path, value })}
                  onReset={(path, defaultValue) =>
                    mutation.mutate({ path, value: defaultValue })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
